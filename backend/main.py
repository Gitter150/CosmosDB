import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from dotenv import load_dotenv
from utils import calculate_esi
from analytics import router as analytics_router
from crud import router as admin_router, crud_router

load_dotenv()
# If .env not found in current dir (e.g. running from /backend), try one level up
if not os.getenv("MYSQL_HOST"):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


app = FastAPI(title="CosmosDB Exoplanet API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics_router)
app.include_router(admin_router)
app.include_router(crud_router)

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


# ─── GET /api/systems?page=1&limit=20&constellation= ────────────────────────
@app.get("/api/systems")
def list_systems(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=5000),
    constellation: str | None = Query(None),
):
    db = get_db()
    cur = db.cursor(dictionary=True)

    offset = (page - 1) * limit

    # Build WHERE clause
    where = ""
    params: list = []
    if constellation:
        where = "WHERE c.constellation_name = %s"
        params = [constellation]

    # Total count
    cur.execute(
        f"SELECT COUNT(*) AS total FROM starsystem s LEFT JOIN constellation c ON s.constellation_id = c.constellation_id {where}",
        params,
    )

    total = cur.fetchone()["total"]

    # Fetch page
    cur.execute(
        f"""
        SELECT s.system_id, s.system_name, s.ra, s.`dec`, s.num_stars, s.num_planets,
               s.num_moons, s.distance_ly,
               c.constellation_name
        FROM starsystem s
        LEFT JOIN constellation c ON s.constellation_id = c.constellation_id
        {where}
        ORDER BY s.system_name
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )

    systems = cur.fetchall()

    cur.close()
    db.close()

    return {
        "systems": systems,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


# ─── GET /api/constellations ─────────────────────────────────────────────────
@app.get("/api/constellations")
def list_constellations():
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute(
        """
        SELECT MIN(c.constellation_id) AS constellation_id, c.constellation_name, SUM(CASE WHEN s.system_id IS NOT NULL THEN 1 ELSE 0 END) AS system_count
        FROM constellation c
        LEFT JOIN starsystem s ON s.constellation_id = c.constellation_id
        GROUP BY c.constellation_name
        ORDER BY c.constellation_name
        """
    )

    rows = cur.fetchall()
    cur.close()
    db.close()
    return rows


# ─── GET /api/systems/{system_id} ────────────────────────────────────────────
@app.get("/api/systems/{system_id}")
def get_system(system_id: int):
    db = get_db()
    cur = db.cursor(dictionary=True)

    # System
    cur.execute(
        """
        SELECT s.*, c.constellation_name
        FROM starsystem s
        LEFT JOIN constellation c ON s.constellation_id = c.constellation_id
        WHERE s.system_id = %s
        """,
        (system_id,),
    )

    system = cur.fetchone()
    if not system:
        cur.close()
        db.close()
        raise HTTPException(404, "System not found")

    # Stars
    cur.execute("SELECT * FROM star WHERE system_id = %s", (system_id,))

    stars = cur.fetchall()

    # Planets + discovery info
    cur.execute(
        """
        SELECT p.*, d.discovery_year, d.discovery_method,
               d.discovery_facility, d.discovery_telescope
        FROM planet p
        LEFT JOIN discovery d ON p.discovery_id = d.discovery_id
        WHERE p.system_id = %s
        ORDER BY p.orbital_period
        """,
        (system_id,),
    )

    planets = cur.fetchall()

    cur.close()
    db.close()

    system["stars"] = stars
    system["planets"] = planets
    return system


# ─── GET /api/search?q=kepler ────────────────────────────────────────────────
@app.get("/api/search")
def search_systems(q: str = Query(..., min_length=1)):
    db = get_db()
    cur = db.cursor(dictionary=True)
    pattern = f"%{q}%"
    cur.execute(
        """
        SELECT s.system_id, s.system_name, s.num_planets, s.distance_ly,
               c.constellation_name
        FROM starsystem s
        LEFT JOIN constellation c ON s.constellation_id = c.constellation_id
        WHERE s.system_name LIKE %s
        ORDER BY s.system_name
        LIMIT 30
        """,
        (pattern,),
    )

    results = cur.fetchall()
    cur.close()
    db.close()
    return results


# ─── GET /api/planets ────────────────────────────────────────────────────────
# Paginated planet list with ESI scores, sorting, and filtering
ALLOWED_SORT = {"mass", "radius", "temp", "distance", "esi_score", "name"}
ALLOWED_ORDER = {"asc", "desc"}

@app.get("/api/planets")
def list_planets(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    sort_by: str = Query("name"),
    order: str = Query("asc"),
    filter_constellation: str | None = Query(None),
    filter_method: str | None = Query(None),
    q: str | None = Query(None),
):
    if sort_by not in ALLOWED_SORT:
        sort_by = "name"
    if order not in ALLOWED_ORDER:
        order = "asc"

    db = get_db()
    cur = db.cursor(dictionary=True)

    # Build WHERE
    conditions: list[str] = []
    params: list = []
    if filter_constellation:
        conditions.append("c.constellation_name = %s")
        params.append(filter_constellation)
    if filter_method:
        conditions.append("d.discovery_method = %s")
        params.append(filter_method)
    if q:
        conditions.append("p.planet_name LIKE %s")
        params.append(f"%{q}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # Count
    cur.execute(
        f"""
        SELECT COUNT(*) AS total
        FROM planet p
        LEFT JOIN starsystem s ON p.system_id = s.system_id
        LEFT JOIN constellation c ON s.constellation_id = c.constellation_id
        LEFT JOIN discovery d ON p.discovery_id = d.discovery_id
        {where}
        """,
        params,
    )
    total = cur.fetchone()["total"]

    # Map sort key to SQL column for DB-side ordering
    sort_map = {
        "mass": "p.mass_earth",
        "radius": "p.radius_earth",
        "temp": "p.planet_temp",
        "distance": "s.distance_ly",
        "name": "p.planet_name",
        "esi_score": "p.planet_name",  # ESI is computed in Python; fallback sort
    }
    order_col = sort_map.get(sort_by, "p.planet_name")
    order_dir = "ASC" if order == "asc" else "DESC"

    # For ESI sorting we fetch ALL matching rows, compute ESI, sort in Python
    if sort_by == "esi_score":
        cur.execute(
            f"""
            SELECT p.planet_id, p.planet_name, p.radius_earth, p.mass_earth,
                   p.planet_density, p.planet_temp, p.orbit_radius, p.orbital_period,
                   p.eccentricity, p.insolation_flux,
                   s.system_id, s.system_name, s.distance_ly, s.num_planets,
                   c.constellation_name,
                   d.discovery_method, d.discovery_year,
                   ANY_VALUE(st.star_temp)       AS star_temp,
                   ANY_VALUE(st.star_radius)     AS star_radius,
                   ANY_VALUE(st.star_mass)       AS star_mass,
                   ANY_VALUE(st.star_luminosity)  AS star_luminosity
            FROM planet p
            LEFT JOIN starsystem s ON p.system_id = s.system_id
            LEFT JOIN constellation c ON s.constellation_id = c.constellation_id
            LEFT JOIN discovery d ON p.discovery_id = d.discovery_id
            LEFT JOIN star st ON st.system_id = s.system_id
            {where}
            GROUP BY p.planet_id, p.planet_name, p.radius_earth, p.mass_earth,
                     p.planet_density, p.planet_temp, p.orbit_radius, p.orbital_period,
                     p.eccentricity, p.insolation_flux,
                     s.system_id, s.system_name, s.distance_ly, s.num_planets,
                     c.constellation_name,
                     d.discovery_method, d.discovery_year
            """,
            params,
        )
        all_rows = cur.fetchall()

        # Compute ESI for each
        for row in all_rows:
            esi_data = calculate_esi(row, row)
            row["esi_score"] = esi_data["final_esi"]
            row["esi_data"] = esi_data

        # Sort in Python — None always goes to the bottom
        desc = order == "desc"
        def _esi_sort_key(r):
            s = r["esi_score"]
            if s is None:
                return (1, 0)           # always last
            return (0, -s if desc else s)

        all_rows.sort(key=_esi_sort_key)

        total = len(all_rows)
        offset = (page - 1) * limit
        paged = all_rows[offset:offset + limit]

        cur.close()
        db.close()

        return {
            "planets": paged,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit if total else 1,
        }

    # Normal DB-side sort
    offset = (page - 1) * limit
    cur.execute(
        f"""
        SELECT p.planet_id, p.planet_name, p.radius_earth, p.mass_earth,
               p.planet_density, p.planet_temp, p.orbit_radius, p.orbital_period,
               p.eccentricity, p.insolation_flux,
               s.system_id, s.system_name, s.distance_ly, s.num_planets,
               c.constellation_name,
               d.discovery_method, d.discovery_year,
               ANY_VALUE(st.star_temp)       AS star_temp,
               ANY_VALUE(st.star_radius)     AS star_radius,
               ANY_VALUE(st.star_mass)       AS star_mass,
               ANY_VALUE(st.star_luminosity)  AS star_luminosity
        FROM planet p
        LEFT JOIN starsystem s ON p.system_id = s.system_id
        LEFT JOIN constellation c ON s.constellation_id = c.constellation_id
        LEFT JOIN discovery d ON p.discovery_id = d.discovery_id
        LEFT JOIN star st ON st.system_id = s.system_id
        {where}
        GROUP BY p.planet_id, p.planet_name, p.radius_earth, p.mass_earth,
                 p.planet_density, p.planet_temp, p.orbit_radius, p.orbital_period,
                 p.eccentricity, p.insolation_flux,
                 s.system_id, s.system_name, s.distance_ly, s.num_planets,
                 c.constellation_name,
                 d.discovery_method, d.discovery_year
        ORDER BY {order_col} IS NULL, {order_col} {order_dir}
        LIMIT %s OFFSET %s
        """,
        params + [limit, offset],
    )
    rows = cur.fetchall()

    # Attach ESI to each planet
    for row in rows:
        esi_data = calculate_esi(row, row)
        row["esi_score"] = esi_data["final_esi"]
        row["esi_data"] = esi_data

    cur.close()
    db.close()

    return {
        "planets": rows,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total else 1,
    }


# ─── GET /api/planets/{planet_id}/details ────────────────────────────────────
# Returns EVERY column from Planet, Star, StarSystem + ESI breakdown
@app.get("/api/planets/{planet_id}/details")
def get_planet_details(planet_id: int):
    db = get_db()
    cur = db.cursor(dictionary=True)

    cur.execute(
        """
        SELECT p.*,
               s.system_name, s.ra AS system_ra, s.`dec` AS system_dec,
               s.num_stars, s.num_planets, s.num_moons, s.distance_ly,
               c.constellation_id, c.constellation_name,
               st.star_id, st.star_name, st.spectral_type, st.star_temp, st.star_radius,
               st.star_mass, st.star_metallicity, st.star_luminosity, st.star_gravity,
               st.star_age, st.star_brightness,
               d.discovery_year, d.discovery_method, d.discovery_locale,
               d.discovery_facility, d.discovery_telescope, d.discovery_instrument
        FROM planet p
        LEFT JOIN starsystem s ON p.system_id = s.system_id
        LEFT JOIN constellation c ON s.constellation_id = c.constellation_id
        LEFT JOIN star st ON st.system_id = s.system_id
        LEFT JOIN discovery d ON p.discovery_id = d.discovery_id
        WHERE p.planet_id = %s
        LIMIT 1
        """,
        (planet_id,),
    )

    row = cur.fetchone()
    if not row:
        cur.close()
        db.close()
        raise HTTPException(404, "Planet not found")

    # Compute ESI
    esi = calculate_esi(row, row)
    row["esi"] = esi

    cur.close()
    db.close()
    return row


# ─── GET /api/discovery_methods ──────────────────────────────────────────────
# Helper for filter dropdowns
@app.get("/api/discovery_methods")
def list_discovery_methods():
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute(
        "SELECT DISTINCT discovery_method FROM discovery ORDER BY discovery_method"
    )
    rows = cur.fetchall()
    cur.close()
    db.close()
    return [r["discovery_method"] for r in rows]
