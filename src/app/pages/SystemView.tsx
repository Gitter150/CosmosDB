import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { PlanetInfo } from "../components/PlanetInfo";
import { OrbitVisualizer } from "../components/OrbitVisualizer";

const API = "http://localhost:8000";

interface StarData {
  star_name: string;
  spectral_type: string | null;
  star_temp: number | null;
  star_radius: number | null;
  star_mass: number | null;
  star_luminosity: number | null;
  star_gravity: number | null;
  star_age: number | null;
}

interface PlanetData {
  planet_id: number;
  planet_name: string;
  orbital_period: number | null;
  orbit_radius: number | null;
  radius_earth: number | null;
  mass_earth: number | null;
  planet_temp: number | null;
  eccentricity: number | null;
  planet_density: number | null;
  discovery_year: number | null;
  discovery_method: string | null;
  discovery_facility: string | null;
}

interface SystemData {
  system_id: number;
  system_name: string;
  ra: number | null;
  dec: number | null;
  num_stars: number;
  num_planets: number;
  distance_pc: number | null;
  constellation_name: string | null;
  stars: StarData[];
  planets: PlanetData[];
}

function classifyPlanetType(p: PlanetData): string {
  const r = p.radius_earth;
  if (!r) return "Unknown";
  if (r < 1.25) return "Rocky (Terrestrial)";
  if (r < 2.0) return "Super-Earth";
  if (r < 6.0) return "Mini-Neptune";
  if (r < 15.0) return "Gas Giant";
  return "Super-Jupiter";
}

export default function SystemView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [system, setSystem] = useState<SystemData | null>(null);
  const initialPlanetId = searchParams.get("planet");
  const [selectedPlanet, setSelectedPlanet] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${API}/api/systems/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setSystem(data);
        let initialIdx = 0;
        if (initialPlanetId) {
          const idx = data.planets.findIndex((p: PlanetData) => String(p.planet_id) === initialPlanetId);
          if (idx !== -1) initialIdx = idx;
        }
        setSelectedPlanet(initialIdx);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="size-full bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-amber-400/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!system) {
    return (
      <div className="size-full bg-black flex flex-col items-center justify-center text-white/40 gap-4">
        <p className="text-lg">System not found</p>
        <button
          onClick={() => navigate("/")}
          className="text-sm text-amber-400/60 hover:text-amber-400 transition-colors cursor-pointer"
        >
          ← Back to gallery
        </button>
      </div>
    );
  }

  const planet = system.planets[selectedPlanet];
  const star = system.stars[0];

  // Build the planetData shape for the existing PlanetInfo component
  const planetDisplayData = planet
    ? {
        name: planet.planet_name,
        hostStar: system.system_name,
        description: `A ${classifyPlanetType(planet).toLowerCase()} exoplanet in the ${system.constellation_name || "unknown"} constellation, orbiting ${system.system_name} at ${planet.orbit_radius ? planet.orbit_radius.toFixed(3) + " AU" : "unknown distance"}.`,
        starType: star?.spectral_type || "Unknown",
        planetType: classifyPlanetType(planet),
        mass: planet.mass_earth ? `${planet.mass_earth.toFixed(2)} M⊕` : "—",
        radius: planet.radius_earth
          ? `${planet.radius_earth.toFixed(2)} R⊕`
          : "—",
        orbitalPeriod: planet.orbital_period
          ? `${planet.orbital_period.toFixed(1)} days`
          : "—",
        distance: system.distance_pc
          ? `${system.distance_pc.toFixed(1)} pc`
          : "—",
        temperature: planet.planet_temp
          ? `${Math.round(planet.planet_temp)} K`
          : "—",
        discoveryYear: planet.discovery_year
          ? String(planet.discovery_year)
          : "—",
        discoveryMethod: planet.discovery_method || "—",
      }
    : null;

  return (
    <div className="size-full bg-black relative overflow-hidden">
      {/* Background Visualization */}
      <div className="absolute inset-0 z-0">
        <OrbitVisualizer
          starTempK={star?.star_temp ?? 5800}
          numStars={system.num_stars}
          planetType={planet && planet.radius_earth && planet.radius_earth > 6 ? "Gas" : "Solid"}
          planetTempK={planet?.planet_temp ?? 300}
          isHabitable={
            planet?.planet_temp != null &&
            planet.planet_temp >= 200 &&
            planet.planet_temp <= 320 &&
            (planet.radius_earth ? planet.radius_earth < 2.5 : false)
          }
        />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 w-full h-full flex pointer-events-none">
        {/* Left Panel - Planet Information */}
        <div className="w-1/2 h-full flex flex-col justify-center p-12">
          {/* Back button */}
          <div className="pointer-events-auto mb-6">
            <button
              onClick={() => navigate("/")}
              className="text-[13px] text-white/30 hover:text-white/70 transition-colors flex items-center gap-2 cursor-pointer"
            >
              ← Back to Discovery Gallery
            </button>
          </div>

          {/* Planet info */}
          {planetDisplayData && (
            <div className="pointer-events-auto">
              <PlanetInfo planetData={planetDisplayData} />
            </div>
          )}

          {/* Action Row */}
          <div className="pointer-events-auto mt-8 ml-16 md:ml-24 flex flex-col md:flex-row items-start md:items-center gap-6 relative z-50">
            {planetDisplayData && (
              <button
                onClick={() => navigate(`/planet/${planet.planet_id}`)}
                className="px-6 py-2.5 rounded-full shrink-0 text-[13px] tracking-widest uppercase border border-amber-400/30 text-amber-400/90 hover:bg-amber-400/[0.08] hover:border-amber-400/50 transition-all cursor-pointer"
              >
                More Details →
              </button>
            )}

            {planetDisplayData && system.planets.length > 1 && (
              <div className="hidden md:block w-px h-6 bg-white/20 shrink-0"></div>
            )}

            {system.planets.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {system.planets.map((p, i) => (
                  <button
                    key={p.planet_id}
                    onClick={() => setSelectedPlanet(i)}
                    className={`px-3 py-1.5 rounded-full text-[12px] border transition-all cursor-pointer ${
                      i === selectedPlanet
                        ? "bg-amber-400/[0.12] border-amber-400/30 text-amber-400/90"
                        : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20"
                    }`}
                  >
                    {p.planet_name.replace(system.system_name, "").trim() ||
                      p.planet_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side empty for the star visualization */}
        <div className="w-1/2 h-full" />
      </div>
    </div>
  );
}
