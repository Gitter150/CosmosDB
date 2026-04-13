"""
Analytics router – pre-aggregated data endpoints for the Dashboard.

On first request the full Planet ⟶ Star ⟶ StarSystem ⟶ Discovery JOIN is
loaded into a Pandas DataFrame, ESI is computed for every row, and the
result is cached in-process memory for the remainder of the session.
"""

from __future__ import annotations

import math
import os
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter
import mysql.connector
from dotenv import load_dotenv

from utils import calculate_esi, _safe_float

load_dotenv()
if not os.getenv("MYSQL_HOST"):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# ── In-memory cache ──────────────────────────────────────────────────────────
_df_cache: pd.DataFrame | None = None


def _get_db():
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


def _load_dataframe() -> pd.DataFrame:
    """Load the full unified dataset and compute ESI once."""
    global _df_cache
    if _df_cache is not None:
        return _df_cache

    db = _get_db()
    query = """
        SELECT
            p.planet_id, p.planet_name, p.radius_earth, p.mass_earth,
            p.planet_density, p.planet_temp, p.orbit_radius, p.orbital_period,
            p.eccentricity, p.insolation_flux, p.is_circumbinary,
            s.system_id, s.system_name, s.num_stars, s.num_planets,
            s.num_moons, s.distance_pc,
            c.constellation_id, c.constellation_name,
            d.discovery_id, d.discovery_year, d.discovery_method,
            d.discovery_locale, d.discovery_facility,
            d.discovery_telescope, d.discovery_instrument,
            st.star_id, st.star_name, st.spectral_type, st.star_temp,
            st.star_radius, st.star_mass, st.star_metallicity,
            st.star_luminosity, st.star_gravity, st.star_age,
            st.star_brightness
        FROM planet p
        LEFT JOIN starsystem s   ON p.system_id    = s.system_id
        LEFT JOIN constellation c ON s.constellation_id = c.constellation_id
        LEFT JOIN discovery d    ON p.discovery_id  = d.discovery_id
        LEFT JOIN star st        ON st.system_id    = s.system_id
    """
    df = pd.read_sql(query, db)
    db.close()

    # De-duplicate in case a system has multiple stars (take first star per planet)
    df = df.drop_duplicates(subset=["planet_id"], keep="first")

    # ── Compute ESI for every planet ─────────────────────────────────────────
    esi_results = []
    for _, row in df.iterrows():
        row_dict = row.to_dict()
        esi = calculate_esi(row_dict, row_dict)
        esi_results.append(esi)

    esi_df = pd.DataFrame(esi_results)
    df = pd.concat([df.reset_index(drop=True), esi_df.reset_index(drop=True)], axis=1)

    # ── ESI Tier classification ──────────────────────────────────────────────
    def _esi_tier(val):
        if val is None or (isinstance(val, float) and math.isnan(val)):
            return "Unknown"
        if val >= 0.8:
            return "Earth-like"
        if val >= 0.6:
            return "Potential"
        if val >= 0.4:
            return "Extreme"
        return "Inhospitable"

    df["esi_tier"] = df["final_esi"].apply(_esi_tier)

    # ── Spectral class (first letter) ────────────────────────────────────────
    def _spectral_class(st):
        if pd.isna(st) or not isinstance(st, str) or len(st) == 0:
            return "Unknown"
        first = st[0].upper()
        return first if first in "OBAFGKM" else "Other"

    df["spectral_class"] = df["spectral_type"].apply(_spectral_class)

    _df_cache = df
    return df


# ═════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

def _nan_to_none(obj):
    """Recursively convert NaN / numpy types to JSON-safe values."""
    if isinstance(obj, dict):
        return {k: _nan_to_none(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_nan_to_none(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if math.isnan(v) else v
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


# ── 1. Summary stats ────────────────────────────────────────────────────────
@router.get("/summary")
def analytics_summary():
    df = _load_dataframe()
    total_planets = len(df)

    # Multi-planet systems: systems with num_planets > 1
    systems = df.drop_duplicates(subset=["system_id"])
    multi_planet = int((systems["num_planets"] > 1).sum())

    unique_constellations = int(df["constellation_name"].dropna().nunique())

    # Top discovery facility
    top_facility = (
        df["discovery_facility"]
        .dropna()
        .value_counts()
        .head(1)
    )
    top_facility_name = top_facility.index[0] if len(top_facility) > 0 else "N/A"
    top_facility_count = int(top_facility.iloc[0]) if len(top_facility) > 0 else 0

    # Unique stars
    unique_stars = int(df["star_id"].dropna().nunique())

    # Discovery methods
    unique_methods = int(df["discovery_method"].dropna().nunique())

    return {
        "total_planets": total_planets,
        "multi_planet_systems": multi_planet,
        "constellations_cataloged": unique_constellations,
        "unique_stars": unique_stars,
        "discovery_methods": unique_methods,
        "top_discovery_facility": {
            "name": top_facility_name,
            "count": top_facility_count,
        },
    }


# ── 2. ESI Distribution ─────────────────────────────────────────────────────
@router.get("/esi-distribution")
def esi_distribution():
    df = _load_dataframe()
    counts = df["esi_tier"].value_counts().to_dict()
    # Ensure all tiers present
    tiers = ["Earth-like", "Potential", "Extreme", "Inhospitable", "Unknown"]
    result = [{"tier": t, "count": int(counts.get(t, 0))} for t in tiers]
    return result


# ── 3. Discovery Timeline ───────────────────────────────────────────────────
@router.get("/discovery-timeline")
def discovery_timeline():
    df = _load_dataframe()
    sub = df[df["discovery_year"].notna()].copy()
    sub["discovery_year"] = sub["discovery_year"].astype(int)

    pivot = (
        sub.groupby(["discovery_year", "discovery_method"])
        .size()
        .unstack(fill_value=0)
    )

    methods = list(pivot.columns)
    years = [int(y) for y in pivot.index]
    series = {}
    for m in methods:
        series[m] = [int(v) for v in pivot[m].tolist()]

    return {"years": years, "methods": methods, "series": series}


# ── 4. Mass-Radius scatter ───────────────────────────────────────────────────
@router.get("/mass-radius-scatter")
def mass_radius_scatter():
    df = _load_dataframe()
    sub = df[df["mass_earth"].notna() & df["radius_earth"].notna()].copy()
    points = []
    for _, r in sub.iterrows():
        points.append({
            "mass": float(r["mass_earth"]),
            "radius": float(r["radius_earth"]),
            "temp": float(r["planet_temp"]) if pd.notna(r["planet_temp"]) else None,
            "name": r["planet_name"],
        })
    return points


# ── 5. Spectral Types ───────────────────────────────────────────────────────
@router.get("/spectral-types")
def spectral_types():
    df = _load_dataframe()
    counts = df["spectral_class"].value_counts()
    order = ["O", "B", "A", "F", "G", "K", "M", "Other", "Unknown"]
    result = []
    for s in order:
        if s in counts.index:
            result.append({"type": s, "count": int(counts[s])})
    return result


# ── 6. System Complexity ─────────────────────────────────────────────────────
@router.get("/system-complexity")
def system_complexity():
    df = _load_dataframe()
    systems = df.drop_duplicates(subset=["system_id"])
    counts = systems["num_planets"].value_counts().sort_index()
    result = []
    for n in range(1, 9):
        result.append({"planet_count": n, "systems": int(counts.get(n, 0))})
    # 8+ bucket
    over8 = int(counts[counts.index >= 9].sum()) if (counts.index >= 9).any() else 0
    if over8 > 0:
        result.append({"planet_count": "8+", "systems": over8})
    return result


# ── 7. Eccentricity vs Orbital Period ────────────────────────────────────────
@router.get("/eccentricity-period")
def eccentricity_period():
    df = _load_dataframe()
    sub = df[df["eccentricity"].notna() & df["orbital_period"].notna()].copy()
    points = []
    for _, r in sub.iterrows():
        points.append({
            "period": float(r["orbital_period"]),
            "eccentricity": float(r["eccentricity"]),
            "name": r["planet_name"],
        })
    return points


# ── 8. Star Metallicity vs Planet Count ──────────────────────────────────────
@router.get("/metallicity-planets")
def metallicity_planets():
    df = _load_dataframe()
    sub = df[df["star_metallicity"].notna()].copy()
    # Group by system, take metallicity (first star) and num_planets
    sys_data = sub.drop_duplicates(subset=["system_id"])[
        ["system_id", "system_name", "star_metallicity", "num_planets"]
    ]
    points = []
    for _, r in sys_data.iterrows():
        points.append({
            "metallicity": float(r["star_metallicity"]),
            "num_planets": int(r["num_planets"]),
            "system": r["system_name"],
        })
    return points


# ── 9. Distance histogram ───────────────────────────────────────────────────
@router.get("/distance-histogram")
def distance_histogram():
    df = _load_dataframe()
    sub = df[df["distance_pc"].notna()]["distance_pc"].values
    if len(sub) == 0:
        return {"bins": [], "counts": []}

    # Use log-spaced bins for better visualisation
    min_d = max(float(np.nanmin(sub)), 0.1)
    max_d = float(np.nanmax(sub))
    edges = np.logspace(np.log10(min_d), np.log10(max_d), 30)
    counts, bin_edges = np.histogram(sub, bins=edges)
    bins = [round(float(b), 2) for b in bin_edges[:-1]]
    return {
        "bins": bins,
        "counts": [int(c) for c in counts],
        "bin_edges": [round(float(b), 2) for b in bin_edges],
    }
