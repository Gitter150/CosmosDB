# CosmosDB: Comprehensive SQL Architecture & Context Summary

This document serves as the complete, end-to-end master guide to the SQL architecture powering the CosmosDB project. It encompasses the structured query design, implementation contexts (when and why queries are fired), and the Python logic that compiles them. This is the perfect guide to present the full depth of SQL concepts implemented across this full-stack application.

---

## 1. The Core Schema Definitions (`schema.sql`)
**Context:** When the project initializes, or during a complete database reset, the SQL definitions establish the rigid rules the application must follow.
**Key SQL Concepts:**
- **Relational Normalization:** Breaking data into 5 hierarchical tables (`constellation` -> `starsystem` -> `star` & `planet` via `discovery`).
- **Data Types & Precision:** Using `DOUBLE` for high-precision celestial coordinates like `distance_ly` preventing floating-point drift.
- **Constraints (`CHECK`, `UNIQUE`):** Guaranteeing physical impossibility errors don't occur (e.g., `CHECK (num_planets >= 0)` and `UNIQUE` tracking for duplicate system rows).

---

## 2. Large Scale ETL Ingestion (`ingest_planets.py`)
**Context:** Used exactly once to bootstrap the database, or triggered automatically by the "Master Reset" API. This script converts real-world NASA CSV data into structured SQL inserts.

**A. In-Memory Lookups for Relational Mapping:**
To avoid querying the database 5000 times to find parent IDs, Python queries the database ONCE and caches it into memory.
```sql
SELECT constellation_id, constellation_name FROM constellation;
```

**B. "Upserting" Relational Hierarchies (Batch Execution):**
When the CSV loops through multiple planets in the *same* star system (like Kepler-90), we don't want to create 8 identical "Kepler-90" systems. We use MySQL's native collision detection:
```sql
INSERT INTO starsystem (system_name, distance_ly, constellation_id, num_planets)
VALUES (%s, %s, %s, %s) 
ON DUPLICATE KEY UPDATE system_id=LAST_INSERT_ID(system_id);
```
> **What this proves:** Usage of `ON DUPLICATE KEY` to catch `UNIQUE` constraint blocks, seamlessly returning the exact parent `system_id` we need to link the child planet properly.

---

## 3. Data Retrieval Pipelines (`main.py`)
**Context:** Fired whenever a user opens the web application, visits the Observatory, or searches for a system.

**A. The Observatory "Mega-Join" (Pagination and Flattening Data):**
Fired when viewing the main "Observatory" tab. Uses a massive flat join to get everything necessary for the UI cards.
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
WHERE p.planet_name LIKE %s   -- Activated if the user searches for a planet
GROUP BY p.planet_id, s.system_id, c.constellation_name, d.discovery_method, d.discovery_year
ORDER BY {order_col} {order_dir} -- Dynamic UI Sorting
LIMIT %s OFFSET %s               -- Native Pagination (LIMIT 50 OFFSET 0)
```
> **What this proves:** Mastery of `LEFT JOIN`, explicit multi-table aggregation avoiding the N+1 ORM problem, and dodging the `ONLY_FULL_GROUP_BY` restriction safely using `ANY_VALUE()`.

**B. Search Dropdowns (Target Host System Lookup):**
Fired dynamically as the user types in the "Add Planet -> Existing System" UI search box. 
```sql
SELECT s.system_id, s.system_name, s.num_planets, s.distance_ly, c.constellation_name
FROM starsystem s
LEFT JOIN constellation c ON s.constellation_id = c.constellation_id
WHERE s.system_name LIKE %s   -- Example: '%Kepler%'
LIMIT 20
```
> **What this proves:** Efficient `LIKE` pattern matching scoped with a `LIMIT` to prevent crashing the browser on broad queries.

**C. Hierarchical Deep-Dive:**
Fired when the user clicks a card to enter `SystemView.tsx` (the Orbit Visualizer). Fetches isolated datasets cleanly using the powerful B-Tree primary-key index.
```sql
SELECT s.*, c.constellation_name FROM starsystem s LEFT JOIN constellation c ON s.constellation_id = c.constellation_id WHERE s.system_id = %s;
SELECT * FROM star WHERE system_id = %s;
SELECT p.*, d.discovery_year, d.discovery_method FROM planet p LEFT JOIN discovery d ON p.discovery_id = d.discovery_id WHERE p.system_id = %s ORDER BY p.orbital_period ASC;
```

---

## 4. State Mutations & Dynamic Cascades (`crud.py`)
**Context:** Fired when a user enters "System Edit Mode", "Creates a New System", or "Deletes a Planet".

**A. Administrator Destructive Purge (Master Reset API):**
When the application has been corrupted or needs a full CSV wipe, deleting 5000 rows iteratively is dangerous. 
```sql
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE planet;
TRUNCATE TABLE star;
TRUNCATE TABLE starsystem;
TRUNCATE TABLE discovery;
TRUNCATE TABLE constellation;
SET FOREIGN_KEY_CHECKS = 1;
```
> **What this proves:** Taking explicit transactional overrides. `TRUNCATE` is a DDL operation that drops the actual table state (instantly resetting data and primary key trackers) instead of iteratively logging deleted rows. Bypassing foreign-key locks temporarily allows destructive administrative action safely.

**B. Dynamic Partial Updating (`PUT` Fields):**
Fired in the "System Edit Mode". Changing one textbox out of 30 shouldn't overwrite the entire row. Python dynamically concatenates string definitions.
```python
# The string builder turns dirty dictionary kwargs into:
# "UPDATE planet SET radius_earth = %s, ttv_obs = %s WHERE planet_id = %s"
```

**C. Cascading Safe-Deletions (`DELETE`):**
Fired when the user deletes a specific planet via the "Delete Planet" button.
```sql
-- 1. Eliminate target
DELETE FROM planet WHERE planet_id = %s;
-- 2. Decrement the Tracker immediately
UPDATE starsystem SET num_planets = num_planets - 1 WHERE system_id = %s;
-- 3. Check for Orphaned Systems
SELECT num_planets FROM starsystem WHERE system_id = %s;
-- (If orphaned = True): Destroy the parent architecture
DELETE FROM star WHERE system_id = %s;
DELETE FROM starsystem WHERE system_id = %s;
```
> **What this proves:** Executing programmatic logic tests to maintain hierarchy instead of letting empty "num_planets = 0" Systems pollute the visualizers.

---

## 5. Statistical Analytics Engine (`analytics.py`)
**Context:** Fired when loading the graphs in the `Analytics` tab.

**A. Targeted High-Volume Pulls:**
Instead of `SELECT *` dragging millions of bytes across the network to build a histogram, we only ask the DB for exactly what the X/Y axes require, null-stripping automatically.
```sql
SELECT mass_earth, radius_earth 
FROM planet 
WHERE mass_earth IS NOT NULL AND radius_earth IS NOT NULL;
```
**B. Mathematical Aggregations:**
```sql
SELECT MIN(distance_ly) AS min_dist, MAX(distance_ly) AS max_dist FROM starsystem;
```
> **What this proves:** Filtering missing statistical variants directly at the Database level via `IS NOT NULL`, offloading work from the python RAM.
