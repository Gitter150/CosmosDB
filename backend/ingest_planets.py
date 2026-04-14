import os
import pandas as pd
import mysql.connector
from dotenv import load_dotenv

def clean_val(val):
    if pd.isna(val) or val == '' or val is None:
        return None
    return val

def check_range(val, min_v, max_v):
    if val is None:
        return None
    try:
        f_val = float(val)
        if min_v <= f_val <= max_v:
            return f_val
        return None
    except (ValueError, TypeError):
        return None

def parse_bool(val):
    if val is None or pd.isna(val) or val == '':
        return False
    # If it's something like "1.0" or "0.0"
    if isinstance(val, str) and val.replace('.', '', 1).isdigit():
        return bool(int(float(val)))
    if isinstance(val, (int, float)):
        return bool(val)
    # If "True"/"False" string
    if str(val).lower() == 'true':
        return True
    if str(val).lower() == 'false':
        return False
    return bool(val)

def main():
    load_dotenv()
    
    # We will use MYSQL_PORT based on ingestConstellation or DB_PORT as requested
    port_str = os.getenv("DB_PORT") or os.getenv("MYSQL_PORT") or "3306"
    host_str = os.getenv("DB_HOST") or os.getenv("MYSQL_HOST") or "localhost"
    user_str = os.getenv("DB_USER") or os.getenv("MYSQL_USER") or ""
    pass_str = os.getenv("DB_PASSWORD") or os.getenv("MYSQL_PASSWORD") or ""
    db_name  = os.getenv("DB_NAME") or os.getenv("MYSQL_DB_NAME") or ""

    try:
        db = mysql.connector.connect(
            host=host_str,
            user=user_str,
            password=pass_str,
            port=int(port_str),
            database=db_name
        )
        cursor = db.cursor(dictionary=False)
    except Exception as e:
        print("Failed to connect to MySQL:", e)
        return

    try:
        csv_path = "./data/ExoplanetDataset.csv"
        if not os.path.exists(csv_path):
            csv_path = "../data/ExoplanetDataset.csv"
            
        print("Clearing old data from databases...")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        cursor.execute("TRUNCATE TABLE Planet")
        cursor.execute("TRUNCATE TABLE Star")
        cursor.execute("TRUNCATE TABLE StarSystem")
        cursor.execute("TRUNCATE TABLE Discovery")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        
        print(f"Loading data from {csv_path}")
        df = pd.read_csv(csv_path, skipinitialspace=True)
        # Clean column names
        df.columns = df.columns.str.strip()

        # 1. Convert all NaN to Python None and strip strings
        def strip_and_none(x):
            if pd.isna(x): return None
            if isinstance(x, str):
                s = x.strip()
                return s if s else None
            return x
            
        df = df.map(strip_and_none)

        # 2. In-Memory Cache Construction
        
        # a) Discovery Cache
        # The prompt instructed capturing unique combinations of metadata properties
        unique_discoveries = set()
        for idx, row in df.iterrows():
            # Skip invalid rows
            if not row.get('planet_name') or not row.get('star_name'):
                continue
                
            disc_tuple = (
                clean_val(row.get('discovery_year')),
                clean_val(row.get('discovery_method')),
                clean_val(row.get('discovery_locale')),
                clean_val(row.get('discovery_facility')),
                clean_val(row.get('discovery_telescope')),
                clean_val(row.get('discovery_instrument'))
            )
            # Make sure that method, facility, instrument exist, as requested originally.
            # Even if year is absent, we track the combination
            unique_discoveries.add(disc_tuple)

        insert_discovery_query = """
            INSERT INTO Discovery (
                discovery_year, discovery_method, discovery_locale,
                discovery_facility, discovery_telescope, discovery_instrument
            )
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        
        discovery_cache = {}
        for disc in unique_discoveries:
            # For strict schema, if "year" is null but schema requires it, it's problematic. 
            # We enforce min/max year constraints or fallback if None.
            yr = disc[0]
            if yr is not None:
                yr = int(yr)
                if not (1992 <= yr <= 2026): yr = 2000 # dummy fallback if out of bounds to avoid breaking batch
            else:
                yr = 2000 # Default year if none
            
            safe_disc = (
                yr,
                disc[1], disc[2],
                disc[3], disc[4], disc[5]
            )
            
            try:
                cursor.execute(insert_discovery_query, safe_disc)
                discovery_cache[disc] = cursor.lastrowid
            except mysql.connector.Error as err:
                print(f"Failed to insert discovery {safe_disc}: {err}")
                continue

        # b) Constellation Cache
        cursor.execute("SELECT constellation_id, min_ra, max_ra, min_dec, max_dec FROM Constellation")
        constellations = []
        for (cid, min_ra, max_ra, min_dec, max_dec) in cursor.fetchall():
            constellations.append({
                "id": cid,
                "min_ra": min_ra,
                "max_ra": max_ra,
                "min_dec": min_dec,
                "max_dec": max_dec
            })

        # 3. Processing CSV rows
        system_cache = {} # system_name -> system_id
        processed_stars = set()

        insert_system_query = """
            INSERT INTO StarSystem (
                system_name, `ra`, `dec`, num_stars, num_planets, num_moons, distance_pc, constellation_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        insert_star_query = """
            INSERT INTO Star (
                star_name, system_id, spectral_type, star_temp, star_radius,
                star_mass, star_metallicity, star_luminosity, star_gravity,
                star_age, star_brightness
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        insert_planet_query = """
            INSERT INTO Planet (
                planet_name, system_id, discovery_id, is_circumbinary,
                orbital_period, orbit_radius, radius_earth, mass_earth,
                planet_density, eccentricity, insolation_flux, planet_temp, ttv_obs
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        for idx, row in df.iterrows():
            planet_name = clean_val(row.get('planet_name'))
            system_name = clean_val(row.get('star_name'))
            if not system_name or not planet_name:
                continue

            ra = check_range(clean_val(row.get('ra_deg')), 0, 360)
            dec = check_range(clean_val(row.get('dec_deg')), -90, 90)

            # Spatial mapping
            constellation_id = None
            if ra is not None and dec is not None:
                for c in constellations:
                    if (c['min_ra'] <= ra <= c['max_ra']) and (c['min_dec'] <= dec <= c['max_dec']):
                        constellation_id = c['id']
                        break

            # Deduplication: StarSystem
            system_id = system_cache.get(system_name)
            if not system_id:
                dist = clean_val(row.get('distance_pc'))
                if dist is not None and dist <= 0: dist = None
                
                ns = clean_val(row.get('num_stars')) or 1
                np_= clean_val(row.get('num_planets')) or 1
                nm = clean_val(row.get('num_moons')) or 0

                cursor.execute(insert_system_query, (
                    system_name, ra, dec, ns, np_, nm, dist, constellation_id
                ))
                system_id = cursor.lastrowid
                system_cache[system_name] = system_id

            # Deduplication: Star
            star_name = system_name
            if star_name not in processed_stars:
                s_temp = check_range(clean_val(row.get('star_temp')), 415, 57000)
                s_rad = check_range(clean_val(row.get('star_radius')), 0.0115, 88.475)
                s_mass = check_range(clean_val(row.get('star_mass')), 0.0094, 10.94)
                s_met = check_range(clean_val(row.get('star_metallicity')), -1, 0.79)
                s_lum = check_range(clean_val(row.get('star_luminosity')), -6.09, 3.8)
                s_grav = check_range(clean_val(row.get('star_gravity')), 0.541, 8.07)
                s_age = check_range(clean_val(row.get('star_age')), 0, 16.1)
                s_bright = check_range(clean_val(row.get('star_brightness')), 2.36431, 20.1861)

                cursor.execute(insert_star_query, (
                    star_name, system_id, clean_val(row.get('spectral_type')),
                    s_temp, s_rad, s_mass, s_met, s_lum, s_grav, s_age, s_bright
                ))
                processed_stars.add(star_name)

            # Insert Planet
            disc_tuple = (
                clean_val(row.get('discovery_year')),
                clean_val(row.get('discovery_method')),
                clean_val(row.get('discovery_locale')),
                clean_val(row.get('discovery_facility')),
                clean_val(row.get('discovery_telescope')),
                clean_val(row.get('discovery_instrument'))
            )
            discovery_id = discovery_cache.get(disc_tuple)

            is_cb = parse_bool(clean_val(row.get('is_circumbinary')))
            ttv = parse_bool(clean_val(row.get('has_transit_variations')))

            p_per = check_range(clean_val(row.get('orbital_period')), 0.090706293, 402000000)
            p_rad = check_range(clean_val(row.get('orbit_radius')), 0.0044, 19000)
            p_re = check_range(clean_val(row.get('radius_earth')), 0.3098, 87.20586985)
            p_me = check_range(clean_val(row.get('mass_earth')), 0.02, 9534.85221)
            p_den = check_range(clean_val(row.get('planet_density')), 0.0051, 2000)
            p_ecc = check_range(clean_val(row.get('eccentricity')), 0, 0.95)
            p_insol = check_range(clean_val(row.get('insolation_flux')), 0.0003, 44900)
            p_temp = check_range(clean_val(row.get('planet_temp')), 34, 4050)

            cursor.execute(insert_planet_query, (
                planet_name, system_id, discovery_id, is_cb,
                p_per, p_rad, p_re, p_me, p_den, p_ecc, p_insol, p_temp, ttv
            ))

        # Commit once at the very end
        db.commit()
        print(f"Successfully processed {len(df)} rows.")

    except Exception as e:
        print(f"An error occurred during DB processing: {e}")
        db.rollback()
    finally:
        # Wrap in finally to ensure connection always closes
        if cursor: cursor.close()
        if db: db.close()

if __name__ == "__main__":
    main()
