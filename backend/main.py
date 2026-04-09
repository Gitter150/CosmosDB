import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CosmosDB Exoplanet API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DB_NAME", "CosmosDB"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
    )


# ─── GET /api/systems?page=1&limit=20&constellation= ────────────────────────
@app.get("/api/systems")
def list_systems(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
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
        f"SELECT COUNT(*) AS total FROM StarSystem s LEFT JOIN Constellation c ON s.constellation_id = c.constellation_id {where}",
        params,
    )
    total = cur.fetchone()["total"]

    # Fetch page
    cur.execute(
        f"""
        SELECT s.system_id, s.system_name, s.ra, s.`dec`, s.num_stars, s.num_planets,
               s.num_moons, s.distance_pc,
               c.constellation_name
        FROM StarSystem s
        LEFT JOIN Constellation c ON s.constellation_id = c.constellation_id
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
        SELECT c.constellation_id, c.constellation_name, COUNT(s.system_id) AS system_count
        FROM Constellation c
        LEFT JOIN StarSystem s ON s.constellation_id = c.constellation_id
        GROUP BY c.constellation_id, c.constellation_name
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
        FROM StarSystem s
        LEFT JOIN Constellation c ON s.constellation_id = c.constellation_id
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
    cur.execute("SELECT * FROM Star WHERE system_id = %s", (system_id,))
    stars = cur.fetchall()

    # Planets + discovery info
    cur.execute(
        """
        SELECT p.*, d.discovery_year, d.discovery_method,
               d.discovery_facility, d.discovery_telescope
        FROM Planet p
        LEFT JOIN Discovery d ON p.discovery_id = d.discovery_id
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
        SELECT s.system_id, s.system_name, s.num_planets, s.distance_pc,
               c.constellation_name
        FROM StarSystem s
        LEFT JOIN Constellation c ON s.constellation_id = c.constellation_id
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
