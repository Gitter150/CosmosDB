import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import ESIGauge from "../components/ESIGauge";
import ZoneTracker from "../components/ZoneTracker";

const API = "http://localhost:8000";

const na = (v: any, suffix = ""): string => {
  if (v === null || v === undefined || (typeof v === "number" && isNaN(v)))
    return "N/A";
  if (typeof v === "number") return `${v}${suffix}`;
  return `${v}${suffix}`;
};

const fmt = (v: number | null, decimals = 4, suffix = ""): string => {
  if (v === null || v === undefined) return "N/A";
  return `${v.toFixed(decimals)}${suffix}`;
};

interface ESIData {
  star_luminosity: number | null;
  orbit_distance: number | null;
  planet_density: number | null;
  surface_temp: number | null;
  escape_velocity: number | null;
  hz_inner: number | null;
  hz_outer: number | null;
  is_habitable: boolean;
  esi_interior: number | null;
  esi_surface: number | null;
  base_esi: number | null;
  final_esi: number | null;
}

interface PlanetDetail {
  planet_id: number;
  planet_name: string;
  system_id: number;
  system_name: string;
  system_ra: number | null;
  system_dec: number | null;
  num_stars: number;
  num_planets: number;
  num_moons: number;
  distance_pc: number | null;
  constellation_id: number | null;
  constellation_name: string | null;
  // Star
  star_id: number | null;
  star_name: string | null;
  spectral_type: string | null;
  star_temp: number | null;
  star_radius: number | null;
  star_mass: number | null;
  star_metallicity: number | null;
  star_luminosity: number | null;
  star_gravity: number | null;
  star_age: number | null;
  star_brightness: number | null;
  // Planet
  is_circumbinary: boolean;
  orbital_period: number | null;
  orbit_radius: number | null;
  radius_earth: number | null;
  mass_earth: number | null;
  planet_density: number | null;
  eccentricity: number | null;
  insolation_flux: number | null;
  planet_temp: number | null;
  ttv_obs: boolean;
  // Discovery
  discovery_year: number | null;
  discovery_method: string | null;
  discovery_locale: string | null;
  discovery_facility: string | null;
  discovery_telescope: string | null;
  discovery_instrument: string | null;
  // ESI
  esi: ESIData;
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-white/[0.04]">
      <span className="text-[11px] text-white/30 tracking-wider uppercase shrink-0">
        {label}
      </span>
      <span className="text-[13px] text-white/75 text-right ml-4 font-mono">
        {value}
      </span>
    </div>
  );
}

/** Mini circular breakdown gauge for the ESI composition */
function MiniGauge({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <ESIGauge score={score} size={60} />
      <span className="text-[10px] text-white/30 tracking-wider uppercase text-center">
        {label}
      </span>
    </div>
  );
}

export default function PlanetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<PlanetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    fetch(`${API}/api/planets/${id}/details`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/10 border-t-amber-400/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white/40 gap-4">
        <p className="text-lg">Planet not found</p>
        <button
          onClick={() => navigate("/observatory")}
          className="text-sm text-amber-400/60 hover:text-amber-400 transition-colors cursor-pointer"
          id="back-to-observatory"
        >
          ← Back to Observatory
        </button>
      </div>
    );
  }

  const esi = data.esi;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate("/observatory")}
            className="text-[13px] text-white/30 hover:text-white/70 transition-colors cursor-pointer flex items-center gap-2"
            id="detail-back-btn"
          >
            ← Observatory
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[10px] tracking-[0.3em] text-white/20 uppercase">
              Mission Control
            </span>
            <div className="w-[1px] h-4 bg-white/[0.08]" />
            <span className="text-[10px] tracking-[0.2em] text-amber-400/40 uppercase font-mono">
              Technical Spec
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start gap-6 mb-10">
          <ESIGauge score={esi.final_esi} size={80} />
          <div>
            <h1 className="text-[28px] font-light tracking-wide text-white/95">
              {data.planet_name}
            </h1>
            <p className="text-[14px] text-white/40 mt-1">
              {data.system_name} · {data.constellation_name || "Unknown Constellation"}
              {data.distance_pc
                ? ` · ${data.distance_pc.toFixed(1)} pc`
                : ""}
            </p>
            {esi.is_habitable && (
              <span className="inline-block mt-2 px-3 py-1 rounded-full bg-emerald-500/[0.1] border border-emerald-500/20 text-emerald-400 text-[11px] tracking-wider uppercase">
                Within Habitable Zone
              </span>
            )}
          </div>
        </div>

        {/* Zone Tracker */}
        <div className="mb-10 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <ZoneTracker
            hzInner={esi.hz_inner}
            hzOuter={esi.hz_outer}
            orbitDistance={esi.orbit_distance}
            starLuminosity={esi.star_luminosity}
          />
        </div>

        {/* ESI Composition Breakdown */}
        <div className="mb-10 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <h3 className="text-[12px] tracking-[0.2em] text-white/30 uppercase mb-5">
            ESI Composition Breakdown
          </h3>
          <div className="flex items-center justify-center gap-12 flex-wrap">
            <MiniGauge label="Physical Similarity" score={esi.esi_interior} />
            <div className="text-white/10 text-xl font-light">×</div>
            <MiniGauge label="Thermal Similarity" score={esi.esi_surface} />
            <div className="text-white/10 text-xl font-light">=</div>
            <MiniGauge label="Final ESI" score={esi.final_esi} />
          </div>
          {!esi.is_habitable && esi.base_esi !== null && (
            <p className="text-center mt-4 text-[11px] text-red-400/60">
              Goldilocks penalty applied: base ESI {fmt(esi.base_esi, 4)} → {fmt(esi.final_esi, 4)} (×0.1)
            </p>
          )}
        </div>

        {/* Data Grid — 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Star Data */}
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-[12px] tracking-[0.2em] text-amber-400/50 uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/40" />
              Star Data
            </h3>
            <DataRow label="Name" value={na(data.star_name)} />
            <DataRow label="Spectral Type" value={na(data.spectral_type)} />
            <DataRow label="Temperature" value={na(data.star_temp, " K")} />
            <DataRow label="Radius" value={na(data.star_radius, " R☉")} />
            <DataRow label="Mass" value={na(data.star_mass, " M☉")} />
            <DataRow label="Luminosity (log)" value={na(data.star_luminosity, " L☉")} />
            <DataRow label="Luminosity (abs)" value={fmt(esi.star_luminosity, 4, " L☉")} />
            <DataRow label="Gravity" value={na(data.star_gravity, " log g")} />
            <DataRow label="Metallicity" value={na(data.star_metallicity)} />
            <DataRow label="Age" value={na(data.star_age, " Gyr")} />
            <DataRow label="Brightness" value={na(data.star_brightness, " mag")} />
          </div>

          {/* Planet Data */}
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-[12px] tracking-[0.2em] text-emerald-400/50 uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/40" />
              Planet Data
            </h3>
            <DataRow label="Name" value={na(data.planet_name)} />
            <DataRow label="Radius" value={na(data.radius_earth, " R⊕")} />
            <DataRow label="Mass" value={na(data.mass_earth, " M⊕")} />
            <DataRow label="Density" value={na(data.planet_density, " g/cm³")} />
            <DataRow label="Calc. Density" value={fmt(esi.planet_density, 2, " g/cm³")} />
            <DataRow label="Temperature" value={na(data.planet_temp, " K")} />
            <DataRow label="Calc. Temp" value={fmt(esi.surface_temp, 1, " K")} />
            <DataRow label="Escape Vel." value={fmt(esi.escape_velocity, 2, " km/s")} />
            <DataRow label="Orbital Period" value={na(data.orbital_period, " days")} />
            <DataRow label="Orbit Radius" value={na(data.orbit_radius, " AU")} />
            <DataRow label="Calc. Orbit" value={fmt(esi.orbit_distance, 4, " AU")} />
            <DataRow label="Eccentricity" value={na(data.eccentricity)} />
            <DataRow label="Insolation" value={na(data.insolation_flux, " S⊕")} />
            <DataRow label="Circumbinary" value={data.is_circumbinary ? "Yes" : "No"} />
            <DataRow label="TTV Observed" value={data.ttv_obs ? "Yes" : "No"} />
          </div>

          {/* System & Discovery Data */}
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-[12px] tracking-[0.2em] text-blue-400/50 uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400/40" />
              System & Discovery
            </h3>
            <DataRow label="System" value={na(data.system_name)} />
            <DataRow label="RA" value={na(data.system_ra, "°")} />
            <DataRow label="Dec" value={na(data.system_dec, "°")} />
            <DataRow label="Stars" value={na(data.num_stars)} />
            <DataRow label="Planets" value={na(data.num_planets)} />
            <DataRow label="Moons" value={na(data.num_moons)} />
            <DataRow label="Distance" value={na(data.distance_pc, " pc")} />
            <DataRow label="Constellation" value={na(data.constellation_name)} />

            <div className="mt-4 mb-2 border-t border-white/[0.06]" />
            <h4 className="text-[11px] text-white/20 tracking-wider uppercase mb-2">
              Discovery
            </h4>
            <DataRow label="Year" value={na(data.discovery_year)} />
            <DataRow label="Method" value={na(data.discovery_method)} />
            <DataRow label="Locale" value={na(data.discovery_locale)} />
            <DataRow label="Facility" value={na(data.discovery_facility)} />
            <DataRow label="Telescope" value={na(data.discovery_telescope)} />
            <DataRow label="Instrument" value={na(data.discovery_instrument)} />

            <div className="mt-4 mb-2 border-t border-white/[0.06]" />
            <h4 className="text-[11px] text-white/20 tracking-wider uppercase mb-2">
              Habitable Zone
            </h4>
            <DataRow label="HZ Inner" value={fmt(esi.hz_inner, 3, " AU")} />
            <DataRow label="HZ Outer" value={fmt(esi.hz_outer, 3, " AU")} />
            <DataRow
              label="In HZ?"
              value={esi.is_habitable ? "✓ Yes" : "✗ No"}
            />
          </div>
        </div>

        {/* Navigate to system visualizer */}
        <div className="text-center pb-12">
          <button
            onClick={() => navigate(`/system/${data.system_id}`)}
            className="px-6 py-2.5 rounded-full text-[12px] tracking-widest uppercase border border-white/[0.08] text-white/40 hover:text-amber-400/80 hover:border-amber-400/20 transition-all duration-500 cursor-pointer"
            id="view-system-btn"
          >
            View System Orbit Visualizer →
          </button>
        </div>
      </div>
    </div>
  );
}
