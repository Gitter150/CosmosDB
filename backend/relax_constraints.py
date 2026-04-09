import mysql.connector, os
from dotenv import load_dotenv

load_dotenv()
db = mysql.connector.connect(
    host=os.getenv('DB_HOST') or os.getenv('MYSQL_HOST') or 'localhost',
    user=os.getenv('DB_USER') or os.getenv('MYSQL_USER') or '',
    password=os.getenv('DB_PASSWORD') or os.getenv('MYSQL_PASSWORD') or '',
    port=int(os.getenv('DB_PORT') or os.getenv('MYSQL_PORT') or 3306),
    database=os.getenv('DB_NAME') or os.getenv('MYSQL_DB_NAME') or ''
)
cursor = db.cursor()

alters = [
    "ALTER TABLE Planet DROP CHECK planet_chk_1;",
    "ALTER TABLE Planet ADD CONSTRAINT planet_chk_1 CHECK (orbital_period BETWEEN 0.05 AND 500000000 OR orbital_period IS NULL);",
    "ALTER TABLE Planet DROP CHECK planet_chk_2;",
    "ALTER TABLE Planet ADD CONSTRAINT planet_chk_2 CHECK (orbit_radius BETWEEN 0.001 AND 20000 OR orbit_radius IS NULL);",
    "ALTER TABLE Planet DROP CHECK planet_chk_3;",
    "ALTER TABLE Planet ADD CONSTRAINT planet_chk_3 CHECK (radius_earth BETWEEN 0.1 AND 100 OR radius_earth IS NULL);",
    "ALTER TABLE Planet DROP CHECK planet_chk_4;",
    "ALTER TABLE Planet ADD CONSTRAINT planet_chk_4 CHECK (mass_earth BETWEEN 0.01 AND 10000 OR mass_earth IS NULL);",
    "ALTER TABLE Planet DROP CHECK planet_chk_5;",
    "ALTER TABLE Planet ADD CONSTRAINT planet_chk_5 CHECK (planet_density BETWEEN 0.001 AND 2500 OR planet_density IS NULL);",
    "ALTER TABLE Planet DROP CHECK planet_chk_6;",
    "ALTER TABLE Planet ADD CONSTRAINT planet_chk_6 CHECK (eccentricity BETWEEN 0 AND 1.0 OR eccentricity IS NULL);",
    "ALTER TABLE Planet DROP CHECK planet_chk_7;",
    "ALTER TABLE Planet ADD CONSTRAINT planet_chk_7 CHECK (insolation_flux BETWEEN 0.0001 AND 50000 OR insolation_flux IS NULL);",

    "ALTER TABLE Star DROP CHECK star_chk_2;",
    "ALTER TABLE Star ADD CONSTRAINT star_chk_2 CHECK (star_radius BETWEEN 0.01 AND 100 OR star_radius IS NULL);",
    "ALTER TABLE Star DROP CHECK star_chk_3;",
    "ALTER TABLE Star ADD CONSTRAINT star_chk_3 CHECK (star_mass BETWEEN 0.005 AND 20 OR star_mass IS NULL);",
    "ALTER TABLE Star DROP CHECK star_chk_4;",
    "ALTER TABLE Star ADD CONSTRAINT star_chk_4 CHECK (star_metallicity BETWEEN -2 AND 2 OR star_metallicity IS NULL);",
    "ALTER TABLE Star DROP CHECK star_chk_5;",
    "ALTER TABLE Star ADD CONSTRAINT star_chk_5 CHECK (star_luminosity BETWEEN -10 AND 10 OR star_luminosity IS NULL);",
    "ALTER TABLE Star DROP CHECK star_chk_6;",
    "ALTER TABLE Star ADD CONSTRAINT star_chk_6 CHECK (star_gravity BETWEEN 0 AND 10 OR star_gravity IS NULL);",
    "ALTER TABLE Star DROP CHECK star_chk_8;",
    "ALTER TABLE Star ADD CONSTRAINT star_chk_8 CHECK (star_brightness BETWEEN 0 AND 30 OR star_brightness IS NULL);"
]

for alt in alters:
    try:
        cursor.execute(alt)
    except Exception as e:
        print("Failed:", alt, e)

db.commit()
print("Constraints relaxed.")
