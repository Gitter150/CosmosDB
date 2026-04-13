/*
Table: constellation
constellation_id (PK)
constellation_name, min_ra, max_ra, min_dec, max_dec, description, pop_rank

Table: discovery
discovery_id (PK)
discovery_year, discovery_method, discovery_locale, discovery_facility, discovery_telescope, discovery_instrument

Table: system
system_id (PK)
system_name (Unique - e.g., "Kepler-16")
num_stars, num_planets, num_moons,distance_pc
constellation_id (FK)

Table: star
star_id (PK)
star_name
system_id (FK)
spectral_type, star_temp, star_radius, star_mass, star_metallicity, star_luminosity, star_gravity, star_age, star_brightness

Table: planet
planet_id (PK)
planet_name
system_id (FK)
discovery_id (FK)
is_circumbinary, orbital_period, orbit_radius, radius_earth, mass_earth, planet_density, eccentricity, insolation_flux, planet_temp, ttv_obs
*/

CREATE TABLE Constellation (
    constellation_id INT AUTO_INCREMENT PRIMARY KEY,
    constellation_name VARCHAR(255) NOT NULL,
    min_ra FLOAT NOT NULL CHECK (min_ra BETWEEN 0 and 360),
    max_ra FLOAT NOT NULL CHECK (max_ra BETWEEN 0 and 360),
    min_dec FLOAT NOT NULL CHECK (min_dec BETWEEN -90 and 90),
    max_dec FLOAT NOT NULL CHECK (max_dec BETWEEN -90 and 90),
    description TEXT NOT NULL,
    pop_rank INT CHECK (pop_rank BETWEEN 1 AND 88) NOT NULL
);

CREATE TABLE StarSystem (
    system_id INT AUTO_INCREMENT PRIMARY KEY,
    system_name VARCHAR(255) UNIQUE NOT NULL,
    `ra` FLOAT CHECK (`ra` BETWEEN 0 AND 360 OR `ra` IS NULL),
    `dec` FLOAT CHECK (`dec` BETWEEN -90 AND 90 OR `dec` IS NULL),
    num_stars INT DEFAULT 1 CHECK (num_stars > 0),
    num_planets INT DEFAULT 1 CHECK (num_planets > 0),
    num_moons INT DEFAULT 0 CHECK (num_moons >= 0),
    distance_pc FLOAT CHECK (distance_pc > 0 OR distance_pc is NULL),
    constellation_id INT,
    CONSTRAINT fk_constellation
        FOREIGN KEY (constellation_id)
        REFERENCES Constellation(constellation_id)
        ON DELETE SET NULL
);

CREATE TABLE Discovery (
    discovery_id INT AUTO_INCREMENT PRIMARY KEY,
    discovery_year INT NOT NULL CHECK (discovery_year BETWEEN 1992 AND 2026),
    discovery_method VARCHAR(255) NOT NULL,
    discovery_locale VARCHAR(255) NOT NULL,
    discovery_facility VARCHAR(255) NOT NULL,
    discovery_telescope VARCHAR(255) NOT NULL,
    discovery_instrument VARCHAR(255) NOT NULL
);

CREATE TABLE Star (
    star_id INT AUTO_INCREMENT PRIMARY KEY,
    star_name VARCHAR(255) NOT NULL UNIQUE,
    system_id INT NOT NULL,
    CONSTRAINT fk_star_system
        FOREIGN KEY (system_id)
        REFERENCES StarSystem(system_id)
        ON DELETE CASCADE,
    spectral_type VARCHAR(20),
    star_temp INT CHECK ((star_temp BETWEEN 415 AND 57000) OR star_temp IS NULL),
    star_radius FLOAT CHECK ((star_radius BETWEEN 0.0115 AND 88.475) OR star_radius IS NULL),
    star_mass FLOAT CHECK ((star_mass BETWEEN 0.0094 AND 10.94) OR star_mass IS NULL),
    star_metallicity FLOAT CHECK((star_metallicity BETWEEN -1 AND 0.79) OR star_metallicity IS NULL),
    star_luminosity FLOAT CHECK ((star_luminosity BETWEEN -6.09 AND 3.8) OR star_luminosity IS NULL),
    star_gravity FLOAT CHECK((star_gravity BETWEEN 0.541 AND 8.07) OR star_gravity IS NULL),
    star_age FLOAT CHECK ((star_age BETWEEN 0 AND 16.1) OR star_age IS NULL),
    star_brightness FLOAT CHECK ((star_brightness BETWEEN 2.36431 AND 20.1861) OR star_brightness IS NULL)
);

CREATE TABLE Planet (
    planet_id INT AUTO_INCREMENT PRIMARY KEY,
    planet_name VARCHAR(255) NOT NULL UNIQUE,
    system_id INT NOT NULL,
    CONSTRAINT fk_planet_system
        FOREIGN KEY (system_id)
        REFERENCES StarSystem(system_id)
        ON DELETE CASCADE,
    discovery_id INT,
    CONSTRAINT fk_planet_discovery
        FOREIGN KEY (discovery_id)
        REFERENCES Discovery(discovery_id)
        ON DELETE SET NULL,
    is_circumbinary BOOLEAN NOT NULL,
    orbital_period FLOAT CHECK ((orbital_period BETWEEN 0.090706293 AND 402000000) OR orbital_period IS NULL),
    orbit_radius FLOAT CHECK ((orbit_radius BETWEEN 0.0044 AND 19000) OR orbit_radius IS NULL),
    radius_earth FLOAT CHECK ((radius_earth BETWEEN 0.3098 AND 87.20586985) OR radius_earth IS NULL),
    mass_earth FLOAT CHECK ((mass_earth BETWEEN 0.02 AND 9534.85221) OR mass_earth IS NULL),
    planet_density FLOAT CHECK ((planet_density BETWEEN 0.0051 AND 2000) OR planet_density IS NULL),
    eccentricity FLOAT CHECK ((eccentricity BETWEEN 0 AND 0.95) OR eccentricity IS NULL),
    insolation_flux FLOAT CHECK ((insolation_flux BETWEEN 0.0003 AND 44900) OR insolation_flux IS NULL),
    planet_temp FLOAT CHECK ((planet_temp BETWEEN 34 AND 4050) OR planet_temp IS NULL),
    ttv_obs BOOLEAN NOT NULL
);

