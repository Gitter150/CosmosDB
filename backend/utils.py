"""
Earth Similarity Index (ESI) calculator with Goldilocks-zone penalty.

All fallback formulae use standard astrophysical approximations so that the
ESI can be computed even when the database has NULLs for certain columns.
"""

from __future__ import annotations
import math
from typing import Any

# Earth reference constants
EARTH_RADIUS = 1.0       # R_earth
EARTH_DENSITY = 5.51     # g/cm^3
EARTH_ESCAPE_V = 11.19   # km/s
EARTH_TEMP = 288.0       # K
SUN_TEMP = 5778.0        # K


def _safe_float(val: Any) -> float | None:
    """Return a float or None if the value is missing / unconvertible."""
    if val is None:
        return None
    try:
        f = float(val)
        return f if math.isfinite(f) else None
    except (ValueError, TypeError):
        return None


def calculate_esi(planet: dict, star: dict) -> dict:
    """
    Compute a full ESI breakdown for a planet row joined with its host star.

    Returns a dict with:
        star_luminosity, orbit_distance, planet_density, surface_temp,
        escape_velocity, hz_inner, hz_outer, is_habitable,
        esi_interior, esi_surface, base_esi, final_esi
    All floats are rounded to 4 decimal places.
    """

    # ── Pull raw values ─────────────────────────────────────────────────────
    radius_earth  = _safe_float(planet.get("radius_earth"))
    mass_earth    = _safe_float(planet.get("mass_earth"))
    planet_density = _safe_float(planet.get("planet_density"))
    planet_temp   = _safe_float(planet.get("planet_temp"))
    orbit_radius  = _safe_float(planet.get("orbit_radius"))       # AU
    orbital_period = _safe_float(planet.get("orbital_period"))     # days

    star_radius   = _safe_float(star.get("star_radius"))           # R_sun
    star_temp     = _safe_float(star.get("star_temp"))             # K
    star_mass     = _safe_float(star.get("star_mass"))             # M_sun

    # star_luminosity in the DB is stored as log10(L/L_sun).
    raw_lum       = _safe_float(star.get("star_luminosity"))
    star_luminosity = 10 ** raw_lum if raw_lum is not None else None

    # ── Fallback calculations ───────────────────────────────────────────────

    # Star Luminosity (L_sun)
    L = star_luminosity
    if L is None and star_radius is not None and star_temp is not None:
        L = (star_radius ** 2) * ((star_temp / SUN_TEMP) ** 4)

    # Orbit Distance (AU) via Kepler's 3rd Law
    d = orbit_radius
    if d is None and orbital_period is not None and star_mass is not None:
        period_yr = orbital_period / 365.25
        d = ((period_yr ** 2) * star_mass) ** (1 / 3)

    # Planet Density (g/cm^3)
    D = planet_density
    if D is None and mass_earth is not None and radius_earth is not None and radius_earth > 0:
        D = (mass_earth / (radius_earth ** 3)) * 5.51

    # Surface Temperature (K)
    T = planet_temp
    if T is None and L is not None and d is not None and d > 0:
        T = 278.0 * ((L / (d ** 2)) ** 0.25)

    # Escape Velocity (km/s)
    V = None
    if mass_earth is not None and radius_earth is not None and radius_earth > 0:
        V = math.sqrt(mass_earth / radius_earth) * 11.19

    # ── Habitable Zone (Goldilocks) ─────────────────────────────────────────
    hz_inner = None
    hz_outer = None
    is_habitable = False

    if L is not None and L > 0:
        hz_inner = math.sqrt(L / 1.1)
        hz_outer = math.sqrt(L / 0.53)
        if d is not None:
            is_habitable = (hz_inner <= d <= hz_outer)

    # ── ESI calculation ─────────────────────────────────────────────────────
    # We need all four parameters to compute the full ESI.
    esi_interior = None
    esi_surface  = None
    base_esi     = None
    final_esi    = None

    can_interior = (radius_earth is not None and D is not None)
    can_surface  = (V is not None and T is not None)

    if can_interior:
        r_term = (1 - abs(radius_earth - 1) / (radius_earth + 1)) ** 0.57
        d_term = (1 - abs(D - 5.51) / (D + 5.51)) ** 1.07
        esi_interior = math.sqrt(max(0, r_term * d_term))

    if can_surface:
        v_term = (1 - abs(V - 11.19) / (V + 11.19)) ** 0.70
        t_term = (1 - abs(T - EARTH_TEMP) / (T + EARTH_TEMP)) ** 5.58
        esi_surface = math.sqrt(max(0, v_term * t_term))

    if esi_interior is not None and esi_surface is not None:
        base_esi = math.sqrt(esi_interior * esi_surface)
        final_esi = base_esi

    # ── Assemble result ─────────────────────────────────────────────────────
    def _r(v: float | None) -> float | None:
        return round(v, 4) if v is not None else None

    return {
        "star_luminosity": _r(L),
        "orbit_distance":  _r(d),
        "planet_density":  _r(D),
        "surface_temp":    _r(T),
        "escape_velocity": _r(V),
        "hz_inner":        _r(hz_inner),
        "hz_outer":        _r(hz_outer),
        "is_habitable":    is_habitable,
        "esi_interior":    _r(esi_interior),
        "esi_surface":     _r(esi_surface),
        "base_esi":        _r(base_esi),
        "final_esi":       _r(final_esi),
    }
