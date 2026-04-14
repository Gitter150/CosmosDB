import os
import sys
import subprocess
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import mysql.connector

router = APIRouter(prefix="/api/admin", tags=["admin"])
crud_router = APIRouter(prefix="/api/crud", tags=["crud"])

def get_db():
    host = os.getenv("MYSQL_HOST", "127.0.0.1")
    if host == "localhost":
        host = "127.0.0.1"
    return mysql.connector.connect(
        host=host,
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DB_NAME", "CosmosDB"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        connect_timeout=5,
    )

@router.post("/reset")
def reset_db():
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        cur.execute("TRUNCATE TABLE Planet")
        cur.execute("TRUNCATE TABLE Star")
        cur.execute("TRUNCATE TABLE StarSystem")
        cur.execute("TRUNCATE TABLE Discovery")
        cur.execute("TRUNCATE TABLE Constellation")
        cur.execute("SET FOREIGN_KEY_CHECKS = 1")
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Database truncation failed: {e}")
    finally:
        cur.close()
        db.close()
        
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = script_dir
        root_dir = os.path.join(script_dir, "..")
        
        r1 = subprocess.run([sys.executable, os.path.join(backend_dir, "ingestConstellation.py")], cwd=root_dir, capture_output=True, text=True)
        if r1.returncode != 0:
            raise HTTPException(500, f"Constellation ingestion failed: {r1.stderr}")
        
        r2 = subprocess.run([sys.executable, os.path.join(backend_dir, "ingest_planets.py")], cwd=root_dir, capture_output=True, text=True)
        if r2.returncode != 0:
            raise HTTPException(500, f"Planet ingestion failed: {r2.stderr}")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(500, f"Ingestion execution failed: {e}")
        
    return {"status": "Successfully Deleted"}

class PlanetPayload(BaseModel):
    mode: str
    system_id: Optional[int] = None
    system_name: Optional[str] = None
    constellation_id: Optional[int] = None
    
    discovery_year: int
    discovery_method: str
    discovery_locale: str
    discovery_facility: str
    discovery_telescope: str
    discovery_instrument: str
    
    planet_name: str
    is_circumbinary: bool
    ttv_obs: bool
    
    orbital_period: Optional[float] = None
    orbit_radius: Optional[float] = None
    radius_earth: Optional[float] = None
    mass_earth: Optional[float] = None
    planet_density: Optional[float] = None
    eccentricity: Optional[float] = None
    insolation_flux: Optional[float] = None
    planet_temp: Optional[float] = None

    star_name: Optional[str] = None
    spectral_type: Optional[str] = None
    star_temp: Optional[float] = None
    star_radius: Optional[float] = None
    star_mass: Optional[float] = None
    star_metallicity: Optional[float] = None
    star_luminosity: Optional[float] = None
    star_gravity: Optional[float] = None
    star_age: Optional[float] = None
    star_brightness: Optional[float] = None


@crud_router.post("/planets")
def create_planet(payload: PlanetPayload):
    db = get_db()
    cur = db.cursor(dictionary=True)
    
    try:
        # Discovery check
        cur.execute("""
            SELECT discovery_id FROM Discovery 
            WHERE discovery_year=%s AND discovery_method=%s AND discovery_locale=%s
            AND discovery_facility=%s AND discovery_telescope=%s AND discovery_instrument=%s
        """, (payload.discovery_year, payload.discovery_method, payload.discovery_locale, 
              payload.discovery_facility, payload.discovery_telescope, payload.discovery_instrument))
        disc = cur.fetchone()
        if disc:
            discovery_id = disc['discovery_id']
        else:
            cur.execute("""
                INSERT INTO Discovery 
                (discovery_year, discovery_method, discovery_locale, discovery_facility, discovery_telescope, discovery_instrument)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (payload.discovery_year, payload.discovery_method, payload.discovery_locale, 
                  payload.discovery_facility, payload.discovery_telescope, payload.discovery_instrument))
            discovery_id = cur.lastrowid
            
        sys_id = payload.system_id
        
        # New System Mode
        if payload.mode == "new":
            # Smart Ra/Dec
            cur.execute("SELECT min_ra, max_ra, min_dec, max_dec FROM Constellation WHERE constellation_id=%s", (payload.constellation_id,))
            const = cur.fetchone()
            if not const:
                raise HTTPException(400, "Invalid Constellation ID")
            
            ra = (const['min_ra'] + const['max_ra']) / 2
            dec = (const['min_dec'] + const['max_dec']) / 2
            
            cur.execute("""
                INSERT INTO StarSystem 
                (system_name, ra, dec, num_stars, num_planets, num_moons, distance_ly, constellation_id)
                VALUES (%s, %s, %s, 1, 0, 0, NULL, %s)
            """, (payload.system_name, ra, dec, payload.constellation_id))
            sys_id = cur.lastrowid
            
            cur.execute("""
                INSERT INTO Star
                (star_name, system_id, spectral_type, star_temp, star_radius, star_mass, star_metallicity, star_luminosity, star_gravity, star_age, star_brightness)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (payload.star_name or payload.system_name, sys_id, payload.spectral_type, payload.star_temp, payload.star_radius, 
                  payload.star_mass, payload.star_metallicity, payload.star_luminosity, payload.star_gravity, payload.star_age, payload.star_brightness))
        
        # Insert planet
        cur.execute("""
            INSERT INTO Planet
            (planet_name, system_id, discovery_id, is_circumbinary, orbital_period, orbit_radius, 
            radius_earth, mass_earth, planet_density, eccentricity, insolation_flux, planet_temp, ttv_obs)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (payload.planet_name, sys_id, discovery_id, payload.is_circumbinary, payload.orbital_period, 
              payload.orbit_radius, payload.radius_earth, payload.mass_earth, payload.planet_density, 
              payload.eccentricity, payload.insolation_flux, payload.planet_temp, payload.ttv_obs))
              
        new_planet_id = cur.lastrowid
        
        # update system count
        cur.execute("UPDATE StarSystem SET num_planets = num_planets + 1 WHERE system_id = %s", (sys_id,))
        
        db.commit()
        return {"status": "success", "planet_id": new_planet_id, "system_id": sys_id}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        cur.close()
        db.close()

class PlanetUpdate(BaseModel):
    planet_name: str
    orbital_period: Optional[float]
    orbit_radius: Optional[float]
    radius_earth: Optional[float]
    mass_earth: Optional[float]
    planet_density: Optional[float]
    eccentricity: Optional[float]
    insolation_flux: Optional[float]
    planet_temp: Optional[float]
    is_circumbinary: bool
    ttv_obs: bool

class StarUpdate(BaseModel):
    star_name: str
    spectral_type: Optional[str]
    star_temp: Optional[float]
    star_radius: Optional[float]
    star_mass: Optional[float]
    star_metallicity: Optional[float]
    star_luminosity: Optional[float]
    star_gravity: Optional[float]
    star_age: Optional[float]
    star_brightness: Optional[float]

class SystemUpdate(BaseModel):
    system_name: str
    num_stars: int
    num_moons: int
    distance_ly: Optional[float]


@crud_router.put("/planets/{planet_id}")
def update_planet(planet_id: int, p: PlanetUpdate):
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("""
            UPDATE Planet SET 
            planet_name=%s, orbital_period=%s, orbit_radius=%s,
            radius_earth=%s, mass_earth=%s, planet_density=%s,
            eccentricity=%s, insolation_flux=%s, planet_temp=%s,
            is_circumbinary=%s, ttv_obs=%s
            WHERE planet_id=%s
        """, (p.planet_name, p.orbital_period, p.orbit_radius, p.radius_earth, p.mass_earth,
              p.planet_density, p.eccentricity, p.insolation_flux, p.planet_temp, p.is_circumbinary, p.ttv_obs, planet_id))
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        cur.close()
        db.close()

@crud_router.put("/stars/{star_id}")
def update_star(star_id: int, s: StarUpdate):
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("""
            UPDATE Star SET 
            star_name=%s, spectral_type=%s, star_temp=%s, star_radius=%s,
            star_mass=%s, star_metallicity=%s, star_luminosity=%s,
            star_gravity=%s, star_age=%s, star_brightness=%s
            WHERE star_id=%s
        """, (s.star_name, s.spectral_type, s.star_temp, s.star_radius, s.star_mass,
              s.star_metallicity, s.star_luminosity, s.star_gravity, s.star_age, s.star_brightness, star_id))
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        cur.close()
        db.close()

@crud_router.put("/systems/{system_id}")
def update_system(system_id: int, s: SystemUpdate):
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("""
            UPDATE StarSystem SET 
            system_name=%s, num_stars=%s, num_moons=%s, distance_ly=%s
            WHERE system_id=%s
        """, (s.system_name, s.num_stars, s.num_moons, s.distance_ly, system_id))
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        cur.close()
        db.close()

@crud_router.delete("/planets/{planet_id}")
def delete_planet(planet_id: int):
    db = get_db()
    cur = db.cursor(dictionary=True)
    try:
        cur.execute("SELECT system_id FROM Planet WHERE planet_id=%s", (planet_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Planet not found")
        sys_id = row['system_id']
        
        cur.execute("DELETE FROM Planet WHERE planet_id=%s", (planet_id,))
        
        cur.execute("UPDATE StarSystem SET num_planets = num_planets - 1 WHERE system_id = %s", (sys_id,))
        
        cur.execute("SELECT num_planets FROM StarSystem WHERE system_id=%s", (sys_id,))
        sys_row = cur.fetchone()
        if sys_row and sys_row['num_planets'] <= 0:
            cur.execute("DELETE FROM Star WHERE system_id=%s", (sys_id,))
            cur.execute("DELETE FROM StarSystem WHERE system_id=%s", (sys_id,))
            
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, str(e))
    finally:
        cur.close()
        db.close()
