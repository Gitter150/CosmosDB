# CosmosDB: Application SQL Queries & Database Architecture

This document maps out how the CosmosDB application interacts with the MySQL database under the hood. While our backend leverages Python/FastAPI, **we utilize pure Raw SQL and parameterized `mysql.connector.cursor` execution** instead of an ORM (like SQLAlchemy) to guarantee strict performance, security against SQL-injection, and explicit control over multi-table relational cascading.

Below are the primary conceptual queries executed by our backend systems to power the application.

---

## 1. Data Retrieval (The `SELECT` Queries)

Data retrieval primarily occurs inside `main.py`, where FastAPI parses incoming HTTP requests and proxies them down to the MySQL Database connection pool.

### The Observatory "Mega-Join" Query (Pagination & Sorting)
To hydrate the Observatory gallery viewing, we execute a comprehensive `LEFT JOIN` integrating five different tables simultaneously. This retrieves a flattened representation of a planet's total environment, avoiding the "N+1 query problem" (where a naive ORM might query the DB 50 separate times).

```sql
SELECT 
    p.planet_id, p.planet_name, p.radius_earth, p.mass_earth, p.planet_temp,
    s.system_id, s.system_name, s.distance_ly, s.num_planets,
    c.constellation_name, d.discovery_method, d.discovery_year,
    ANY_VALUE(st.star_temp) AS star_temp, ANY_VALUE(st.star_luminosity) AS star_luminosity
FROM planet p
LEFT JOIN starsystem s ON p.system_id = s.system_id
LEFT JOIN constellation c ON s.constellation_id = c.constellation_id
LEFT JOIN discovery d ON p.discovery_id = d.discovery_id
LEFT JOIN star st ON st.system_id = s.system_id
WHERE p.planet_name LIKE %s   -- Dynamic Search Filters
GROUP BY p.planet_id, s.system_id, c.constellation_name, d.discovery_method, d.discovery_year
ORDER BY {order_col} {order_dir} -- Dynamic Ordering (e.g., mass_earth DESC)
LIMIT %s OFFSET %s               -- Classic API Pagination
```

> [!NOTE]
> Uses `ANY_VALUE()` aggregator to satisfy `ONLY_FULL_GROUP_BY` MySQL restrictions when condensing star variants in multi-star (binary) systems while keeping the primary data deterministic. 

### The Deep-Dive System Fetch
When a user clicks on a star system (bringing up the Orbit Visualizer), we run three highly targeted sequential lookups rather than one massive join. This scales rapidly because filtering by a Primary Key (`system_id`) uses a highly optimized B-Tree index lookup.

**1. System & Constellation Data:**
```sql
SELECT s.*, c.constellation_name
FROM starsystem s
LEFT JOIN constellation c ON s.constellation_id = c.constellation_id
WHERE s.system_id = %s
```

**2. Retrieve all System Stars:**
```sql
SELECT * FROM star WHERE system_id = %s
```

**3. Retrieve all System Planets w/ Discovery context:**
```sql
SELECT p.*, d.discovery_year, d.discovery_method
FROM planet p
LEFT JOIN discovery d ON p.discovery_id = d.discovery_id
WHERE p.system_id = %s
ORDER BY p.orbital_period ASC  -- Guarantees inner planets render first in the visualizer
```

---

## 2. Dynamic Modification (The CRUD Sub-Routines)

Located inside `crud.py`, these queries handle state mutation (Creating, Updating, Deleting). Because Python handles web-requests asynchronously, database constraints limit what changes can occur.

### Dynamic Updates (`PUT`)
Because an administrator might only edit *one* field (e.g. `planet_temp`) and leave the rest blank, writing a hardcoded `UPDATE` is inefficient. The backend dynamically compiles the active column arguments into `k=v` placeholder strings.

```python
# Conceptual Python Builder:
# fields = ["planet_temp=%s", "mass_earth=%s", "ttv_obs=%s"]
# values = [800, 14.5, 1, planet_id]
```
Outputs structural SQL:
```sql
UPDATE planet 
SET planet_temp = %s, mass_earth = %s, ttv_obs = %s
WHERE planet_id = %s;
```

### The Ingestion Cascade (`POST` / Insert)
When creating a brand new planet through the web UI's "Mission Control", we often need to spawn foreign-key hierarchical data (the chain: Constellation -> StarSystem -> Star -> Discovery -> Planet).

We leverage `lastrowid` mapped to `LAST_INSERT_ID()` to bridge Foreign Keys dynamically inside the same transaction:

```sql
-- Step 1: Log the Discovery
INSERT INTO discovery (discovery_year, discovery_method, discovery_facility) 
VALUES (%s, %s, %s);
-- RETRIEVE id -> NEW_DISCOVERY_ID

-- Step 2: Establish the System Environment
INSERT INTO starsystem (system_name, constellation_id, distance_ly, num_planets) 
VALUES (%s, %s, %s, %s);
-- RETRIEVE id -> NEW_SYSTEM_ID

-- Step 3: Ignite the Host Star
INSERT INTO star (star_name, system_id, star_temp, star_radius, star_mass) 
VALUES (%s, %s, %s, %s, %s);

-- Step 4: Inject the Planet Entity (Linking everything together)
INSERT INTO planet (
    planet_name, system_id, discovery_id, 
    orbit_radius, orbital_period, radius_earth, mass_earth
) VALUES (
    %s, %s, %s, 
    %s, %s, %s, %s
);
```

### Constrained Cascade Deletion (`DELETE`)
Deleting an exoplanet isn't as simple as dropping a row; it requires maintaining internal database integrity constraints.
When deleting a planet, we execute a cascading verification check:

```sql
-- 1. Eliminate the planet node
DELETE FROM planet WHERE planet_id = %s;

-- 2. Decrement the tracker in the parent System node
UPDATE starsystem SET num_planets = num_planets - 1 WHERE system_id = %s;

-- 3. Run a validation check (If num_planets reaches 0)
SELECT num_planets FROM starsystem WHERE system_id = %s;

-- If returned 0, system is declared orphan and is purged:
DELETE FROM star WHERE system_id = %s;
DELETE FROM starsystem WHERE system_id = %s;
```

---

## 3. Large-Scale ETL Ingestion (`ingest_planets.py`)

When tearing down and refreshing the Master DB from NASA exoplanet CSV datasets, performance is bottlenecked by the network if queries are pushed row-by-row.

To optimize the `INSERT` speed of 5000+ planets, Python calculates constraints in an in-memory dictionary payload, applies formulas locally (e.g. `FLOAT(parsecs) * 3.26156 -> distance_ly`), and executes bulk batch insertions natively via connection pools:

```sql
-- Rapid In-Memory Lookup
SELECT constellation_id, constellation_name FROM constellation;

-- Continuous Execution Batch Pattern
INSERT INTO starsystem (system_name, distance_ly, constellation_id, num_planets)
VALUES (%s, %s, %s, %s) 
ON DUPLICATE KEY UPDATE system_id=LAST_INSERT_ID(system_id);
```

> [!TIP]
> `ON DUPLICATE KEY UPDATE` is utilized heavily here. If NASA CSVs contain repeats of the same "Kepler-16" star system, MySQL blocks the clash via the `UNIQUE` constraint, and Python seamlessly retrieves the existing `system_id` so child planets link correctly rather than destroying the table scope.
