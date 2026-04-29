import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import ESIGauge from "../components/ESIGauge";
import ZoneTracker from "../components/ZoneTracker";

const API = "http://localhost:8000";

const na = (v: any, suffix = ""): string => {
  if (v === null || v === undefined || (typeof v === "number" && isNaN(v))) return "N/A";
  if (typeof v === "number") return `${v}${suffix}`;
  return `${v}${suffix}`;
};

const fmt = (v: number | null, decimals = 4, suffix = ""): string => {
  if (v === null || v === undefined || isNaN(v)) return "N/A";
  return `${v.toFixed(decimals)}${suffix}`;
};

function calculateESIFrontEnd(planet: any, star: any) {
  let L = null;
  if (star.star_luminosity !== null && star.star_luminosity !== undefined) {
      L = Math.pow(10, parseFloat(star.star_luminosity));
  } else if (star.star_radius && star.star_temp) {
      L = Math.pow(star.star_radius, 2) * Math.pow(star.star_temp / 5778.0, 4);
  }

  const d = planet.orbit_radius || (planet.orbital_period && star.star_mass ? Math.pow(Math.pow(planet.orbital_period / 365.25, 2) * star.star_mass, 1/3) : null);
  const D = planet.planet_density || (planet.mass_earth && planet.radius_earth ? (planet.mass_earth / Math.pow(planet.radius_earth, 3)) * 5.51 : null);
  const T = planet.planet_temp || (L && d ? 278.0 * Math.pow(L / Math.pow(d, 2), 0.25) : null);
  const V = planet.mass_earth && planet.radius_earth ? Math.sqrt(planet.mass_earth / planet.radius_earth) * 11.19 : null;

  const hz_inner = L ? Math.sqrt(L / 1.1) : null;
  const hz_outer = L ? Math.sqrt(L / 0.53) : null;
  const is_habitable = hz_inner && hz_outer && d ? (d >= hz_inner && d <= hz_outer) : false;

  let esi_interior = null, esi_surface = null, base_esi = null, final_esi = null;
  
  if (planet.radius_earth && D) {
      const r_term = Math.pow(1 - Math.abs(planet.radius_earth - 1) / (planet.radius_earth + 1), 0.57);
      const d_term = Math.pow(1 - Math.abs(D - 5.51) / (D + 5.51), 1.07);
      esi_interior = Math.sqrt(Math.max(0, r_term * d_term));
  }
  
  if (V && T) {
      const v_term = Math.pow(1 - Math.abs(V - 11.19) / (V + 11.19), 0.70);
      const t_term = Math.pow(1 - Math.abs(T - 288.0) / (T + 288.0), 5.58);
      esi_surface = Math.sqrt(Math.max(0, v_term * t_term));
  }
  
  if (esi_interior && esi_surface) {
      base_esi = Math.sqrt(esi_interior * esi_surface);
      final_esi = base_esi;
  }

  return { star_luminosity: L, orbit_distance: d, planet_density: D, surface_temp: T, escape_velocity: V, hz_inner, hz_outer, is_habitable, esi_interior, esi_surface, base_esi, final_esi };
}

function MiniGauge({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <ESIGauge score={score} size={60} />
      <span className="text-[10px] text-white/30 tracking-wider uppercase text-center">{label}</span>
    </div>
  );
}

export default function PlanetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/api/planets/${id}/details`)
      .then((r) => { if (!r.ok) throw new Error(""); return r.json(); })
      .then((d) => { setData(d); setForm(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [id]);

  const handleChange = (e: any) => {
    let val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (e.target.type === "number") val = val ? parseFloat(val) : null;
    setForm({ ...form, [e.target.name]: val });
  };

  const handleStep = (name: string, direction: number) => {
    let val = parseFloat(form[name]);
    if (isNaN(val)) val = 0;
    let step = 0.1;
    if(name === "num_planets" || name === "discovery_year" || name === "num_stars" || name === "num_moons") step = 1;
    else if(name === "mass_earth" || name === "radius_earth" || name === "star_mass" || name === "star_radius") step = 0.05;
    const newval = parseFloat((val + direction * step).toFixed(6));
    setForm((prev: any) => ({ ...prev, [name]: newval }));
  };

  const handleSave = async () => {
    try {
       await fetch(`${API}/api/crud/planets/${data.planet_id}`, {
           method: "PUT", headers: { "Content-Type": "application/json" },
           body: JSON.stringify(form)
       });
       await fetch(`${API}/api/crud/stars/${data.star_id}`, {
           method: "PUT", headers: { "Content-Type": "application/json" },
           body: JSON.stringify(form)
       });
       await fetch(`${API}/api/crud/systems/${data.system_id}`, {
           method: "PUT", headers: { "Content-Type": "application/json" },
           body: JSON.stringify(form)
       });
       setData({ ...data, ...form });
       setEditMode(false);
    } catch(err) {
       alert("Failed to save changes");
    }
  };

  const handleDelete = async () => {
     if(!window.confirm("Are you sure you want to delete this planet? System deletion cascades if child planets count drops to zero.")) return;
     try {
       await fetch(`${API}/api/crud/planets/${data.planet_id}`, { method: "DELETE" });
       navigate("/observatory");
     } catch(err) {
       alert("Deletion failed");
     }
  };

  if (loading) return <div className="min-h-screen bg-black flex justify-center items-center"><div className="animate-spin w-6 h-6 border-t-amber-400 border-2 rounded-full border-white/10" /></div>;
  if (error || !data) return <div className="min-h-screen bg-black flex justify-center items-center text-white/50">Planet Not Found</div>;

  const currentData = editMode ? form : data;
  const esi = calculateESIFrontEnd(currentData, currentData);

  const renderDataRow = (label: string, name: string, isNum=true) => {
    const val = editMode ? form[name] : data[name];
    return (
      <div className={`flex items-center justify-between py-1.5 border-b ${editMode ? "border-amber-500/20" : "border-white/[0.04]"}`}>
        <span className="text-[11px] text-white/30 tracking-wider uppercase w-1/3">{label}</span>
        {editMode && name !== "num_planets" ? (
             isNum ? 
             <div className="w-1/2 relative group flex">
               <input type="number" step="any" name={name} value={val ?? ""} onChange={handleChange} className="w-full bg-black/40 text-amber-200 pl-2 pr-6 py-1 rounded text-sm font-mono text-right outline-none border border-white/5 focus:border-amber-500/50 focus:bg-amber-500/5 transition-all shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
               <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <button type="button" onClick={() => handleStep(name, 1)} className="text-white/30 hover:text-amber-400 p-[1px] cursor-pointer"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6"/></svg></button>
                 <button type="button" onClick={() => handleStep(name, -1)} className="text-white/30 hover:text-amber-400 p-[1px] cursor-pointer"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg></button>
               </div>
             </div>
             :
             <input type="text" name={name} value={val ?? ""} onChange={handleChange} className="w-1/2 bg-black/40 text-amber-200 px-2 py-1 rounded text-sm font-mono text-right outline-none border border-white/5 focus:border-amber-500/50 focus:bg-amber-500/5 transition-all shadow-inner" />
        ) : (
             <span className="text-[13px] text-white/75 text-right font-mono">
               {typeof val === 'boolean' || val === 1 || val === 0 ? (val ? "Yes" : "No") : (val ?? "N/A")}
             </span>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/observatory")} className="text-[13px] text-white/30 hover:text-white/70">← Observatory</button>
          
          <div className="flex items-center gap-4">
             {editMode ? (
                 <>
                    <button onClick={() => setEditMode(false)} className="text-xs px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/15 text-white/70 uppercase tracking-widest rounded-full transition-all cursor-pointer">Cancel</button>
                    <button onClick={handleSave} className="text-xs px-6 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 hover:border-amber-500/60 uppercase tracking-widest rounded-full shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all flex items-center cursor-pointer">Save Changes</button>
                 </>
             ) : (
                 <>
                    <button onClick={handleDelete} className="text-[10px] px-4 py-1.5 bg-red-500/10 border border-red-500/20 text-red-500/70 hover:bg-red-500/20 hover:text-red-400 uppercase tracking-widest rounded-full transition-all cursor-pointer">Delete Planet</button>
                    <button onClick={() => setEditMode(true)} className="text-[10px] px-5 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 uppercase tracking-widest rounded-full shadow-[0_0_15px_rgba(59,130,246,0.1)] transition-all flex items-center gap-2 cursor-pointer">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      System Edit
                    </button>
                 </>
             )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-start gap-6 mb-10">
          <ESIGauge score={esi.final_esi} size={80} />
          <div>
            <h1 className="text-[28px] font-light tracking-wide text-white/95">{currentData.planet_name}</h1>
            <p className="text-[14px] text-white/40 mt-1">{currentData.system_name} · {currentData.constellation_name} {currentData.distance_ly ? `· ${currentData.distance_ly} ly` : ""}</p>
            <div className="flex flex-wrap gap-2 mt-3">
               {esi.is_habitable && <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/[0.1] border border-emerald-500/20 text-emerald-400 text-[11px] uppercase tracking-wider">Within Habitable Zone</span>}
               {currentData.is_circumbinary ? <span className="inline-block px-3 py-1 rounded-full bg-purple-500/[0.1] border border-purple-500/30 text-purple-400 text-[11px] uppercase tracking-wider shadow-[0_0_10px_rgba(168,85,247,0.15)] glow">Circumbinary Orbit</span> : null}
               {currentData.ttv_obs ? <span className="inline-block px-3 py-1 rounded-full bg-blue-500/[0.1] border border-blue-500/30 text-blue-400 text-[11px] uppercase tracking-wider shadow-[0_0_10px_rgba(59,130,246,0.15)] glow">TTV Observed</span> : null}
            </div>
          </div>
        </div>

        <div className="mb-10 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <ZoneTracker hzInner={esi.hz_inner} hzOuter={esi.hz_outer} orbitDistance={esi.orbit_distance} starLuminosity={esi.star_luminosity} />
        </div>

        <div className="mb-10 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-center gap-12 flex-wrap">
            <MiniGauge label="Physical Similarity" score={esi.esi_interior} />
            <div className="text-white/10 text-xl font-light">×</div>
            <MiniGauge label="Thermal Similarity" score={esi.esi_surface} />
            <div className="text-white/10 text-xl font-light">=</div>
            <MiniGauge label="Final ESI" score={esi.final_esi} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Planet */}
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-emerald-400 mb-4 tracking-widest text-xs uppercase">Planet Data</h3>
            {renderDataRow("Name", "planet_name", false)}
            {renderDataRow("Radius (R⊕)", "radius_earth")}
            {renderDataRow("Mass (M⊕)", "mass_earth")}
            {renderDataRow("Density", "planet_density")}
            {renderDataRow("Temp (K)", "planet_temp")}
            {renderDataRow("Orbital Period", "orbital_period")}
            {renderDataRow("Orbit Radius", "orbit_radius")}
            {renderDataRow("Eccentricity", "eccentricity")}
            {renderDataRow("Insolation", "insolation_flux")}
            {editMode ? (
               <>
                   <div className="flex justify-between items-center py-2 border-b border-amber-500/20"><span className="text-[11px] uppercase tracking-widest text-white/30">Circumbinary</span><input type="checkbox" name="is_circumbinary" checked={form.is_circumbinary} onChange={handleChange} className="accent-amber-500 w-4 h-4 rounded border-white/20 bg-black cursor-pointer" /></div>
                   <div className="flex justify-between items-center py-2 border-b border-amber-500/20"><span className="text-[11px] uppercase tracking-widest text-white/30">TTV Obs</span><input type="checkbox" name="ttv_obs" checked={form.ttv_obs} onChange={handleChange} className="accent-amber-500 w-4 h-4 rounded border-white/20 bg-black cursor-pointer" /></div>
               </>
            ) : (
               <>
                   {renderDataRow("Circumbinary", "is_circumbinary", false)}
                   {renderDataRow("TTV Observed", "ttv_obs", false)}
               </>
            )}
          </div>

          {/* Star */}
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <h3 className="text-amber-400 mb-4 tracking-widest text-xs uppercase">Star Data</h3>
            {renderDataRow("Name", "star_name", false)}
            {renderDataRow("Spectral", "spectral_type", false)}
            {renderDataRow("Temp (K)", "star_temp")}
            {renderDataRow("Radius (R☉)", "star_radius")}
            {renderDataRow("Mass (M☉)", "star_mass")}
            {renderDataRow("Luminosity", "star_luminosity")}
            {renderDataRow("Gravity", "star_gravity")}
            {renderDataRow("Metallicity", "star_metallicity")}
            {renderDataRow("Age (Gyr)", "star_age")}
            {renderDataRow("Brightness", "star_brightness")}
          </div>

          {/* System */}
          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
             <h3 className="text-blue-400 mb-4 text-xs tracking-widest uppercase">System Metadata</h3>
             {renderDataRow("System Name", "system_name", false)}
             {renderDataRow("Num Stars", "num_stars")}
             {renderDataRow("Num Moons", "num_moons")}
             {renderDataRow("Distance (ly)", "distance_ly")}
             {renderDataRow("Num Planets", "num_planets")}
             {editMode && (
                 <div className="my-8 text-[11px] text-amber-500/80 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl leading-relaxed hidden md:block">
                   Entering System Edit Mode allows modifying planet, star, and positional attributes independently. Note that changes to distance and stars impacts the entire host system for all parallel planets. Click save on the top to persist changes down to the MySQL Database.
                 </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
