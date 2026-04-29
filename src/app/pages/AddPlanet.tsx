import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

const API = "http://localhost:8000";

const PRESETS = {
  "Extremely Habitable": { radius_earth: 1.2, mass_earth: 1.5, planet_density: 5.5, planet_temp: 288, orbital_period: 365, eccentricity: 0.02, insolation_flux: 1.0, orbit_radius: 1.0 },
  "Moderately Habitable": { radius_earth: 1.8, mass_earth: 3.5, planet_density: 4.8, planet_temp: 310, orbital_period: 150, eccentricity: 0.1, insolation_flux: 1.5, orbit_radius: 0.6 },
  "Barely Habitable": { radius_earth: 2.5, mass_earth: 8.0, planet_density: 3.0, planet_temp: 220, orbital_period: 800, eccentricity: 0.2, insolation_flux: 0.4, orbit_radius: 2.0 },
  "Neutral Zone": { radius_earth: 10.0, mass_earth: 150, planet_density: 1.2, planet_temp: 150, orbital_period: 4000, eccentricity: 0.0, insolation_flux: 0.05, orbit_radius: 5.0 },
  "Toxic Inferno": { radius_earth: 0.8, mass_earth: 0.5, planet_density: 6.0, planet_temp: 800, orbital_period: 10, eccentricity: 0.01, insolation_flux: 50.0, orbit_radius: 0.05 },
  "Uninhabitable Giant": { radius_earth: 15.0, mass_earth: 300, planet_density: 0.8, planet_temp: 2000, orbital_period: 3, eccentricity: 0.5, insolation_flux: 1000.0, orbit_radius: 0.02 }
};

export default function AddPlanet() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [constellations, setConstellations] = useState<any[]>([]);
  
  // Search State for Existing Systems
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<any>(null);

  const [form, setForm] = useState<any>({
    system_name: "",
    constellation_id: "",
    star_name: "",
    spectral_type: "G",
    star_temp: 5700,
    star_radius: 1.0,
    star_mass: 1.0,
    star_metallicity: 0.0,
    star_luminosity: 0.0,
    star_gravity: 4.4,
    star_age: 4.5,
    star_brightness: 5.0,

    discovery_year: 2024,
    discovery_method: "Transit",
    discovery_locale: "Space",
    discovery_facility: "Kepler",
    discovery_telescope: "Kepler",
    discovery_instrument: "Kepler Photometer",

    planet_name: "",
    is_circumbinary: false,
    ttv_obs: false,
    num_stars: 1,
    num_moons: 0,
    num_planets: 0,
    distance_ly: "",
    orbital_period: "",
    orbit_radius: "",
    radius_earth: "",
    mass_earth: "",
    planet_density: "",
    eccentricity: "",
    insolation_flux: "",
    planet_temp: ""
  });

  useEffect(() => {
    fetch(`${API}/api/constellations`).then(r => r.json()).then(data => setConstellations(data || []));
  }, []);

  // Debounced Search Effect
  useEffect(() => {
    if(mode !== "existing") return;
    if(!searchQuery || searchQuery.trim() === "") {
        setSearchResults([]);
        return;
    }
    const timeout = setTimeout(async () => {
        setSearching(true);
        try {
            const res = await fetch(`${API}/api/search?q=${encodeURIComponent(searchQuery)}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data || []);
            }
        } catch(err) {
            console.error("Search failed");
        } finally {
            setSearching(false);
        }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery, mode]);

  const handleChange = (e: any) => {
    let val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (e.target.type === "number") val = val ? parseFloat(val) : "";
    setForm({ ...form, [e.target.name]: val });
  };

  const setHabitability = (tier: keyof typeof PRESETS) => {
    setForm((prev: any) => ({ ...prev, ...PRESETS[tier] }));
  };

  const submit = async () => {
    if (mode === "existing" && !selectedSystem) {
        alert("Please search and select a host system first!");
        return;
    }
    
    try {
      const payload = {
        mode: mode === "new" ? "new" : "existing",
        ...form,
        system_id: mode === "existing" ? selectedSystem.system_id : undefined,
        constellation_id: mode === "new" ? parseInt(form.constellation_id) || undefined : undefined,
        num_stars: mode === "new" ? parseInt(form.num_stars) || 1 : undefined,
        num_moons: mode === "new" ? parseInt(form.num_moons) || 0 : undefined,
        num_planets: mode === "new" ? parseInt(form.num_planets) || 0 : undefined,
        distance_ly: mode === "new" ? parseFloat(form.distance_ly) || null : undefined,
        orbital_period: parseFloat(form.orbital_period) || null,
        orbit_radius: parseFloat(form.orbit_radius) || null,
        radius_earth: parseFloat(form.radius_earth) || null,
        mass_earth: parseFloat(form.mass_earth) || null,
        planet_density: parseFloat(form.planet_density) || null,
        eccentricity: parseFloat(form.eccentricity) || null,
        insolation_flux: parseFloat(form.insolation_flux) || null,
        planet_temp: parseFloat(form.planet_temp) || null,
        star_temp: parseFloat(form.star_temp) || null,
        star_radius: parseFloat(form.star_radius) || null,
        star_mass: parseFloat(form.star_mass) || null,
        star_metallicity: parseFloat(form.star_metallicity) || null,
        star_luminosity: parseFloat(form.star_luminosity) || null,
        star_gravity: parseFloat(form.star_gravity) || null,
        star_age: parseFloat(form.star_age) || null,
        star_brightness: parseFloat(form.star_brightness) || null,
      };

      const res = await fetch(`${API}/api/crud/planets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      navigate(`/planet/${data.planet_id}`);
    } catch(err: any) {
      alert("Execution Error: " + err.message);
    }
  };

  // Prevent input unmounts by rendering fields via an inline function calling standard DOM elements natively
  const renderField = (label: string, name: string, type="number") => (
    <div className="flex flex-col mb-4">
      <label className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1 pl-2">{label}</label>
      <input type={type} step="any" className="w-full bg-white/[0.02] hover:bg-white/[0.05] focus:bg-white/[0.08] transition-colors border-b border-white/[0.1] focus:border-amber-400/50 rounded-t-lg p-2.5 text-white/90 text-[13px] font-mono outline-none placeholder:text-white/20" name={name} value={form[name] ?? ""} onChange={handleChange} placeholder={`Enter ${label.toLowerCase()}...`} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white relative flex flex-col font-sans">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="star-field" />
      </div>

      <div className="relative z-10 pt-24 pb-32 px-6 w-full max-w-5xl mx-auto flex-grow flex flex-col items-center">
        
        {/* Title */}
        <div className="w-full flex flex-col items-center mb-10 mt-6 blur-0 backdrop-blur-md">
            <h1 className="text-4xl tracking-[0.25em] text-white/95 uppercase font-light drop-shadow-md mb-3 text-center">New Planet <span className="text-amber-400">Ingestion</span></h1>
            <p className="text-sm font-mono tracking-widest text-white/40 uppercase">Mission Control • DB Architect</p>
        </div>

        {/* Mode Toggles */}
        <div className="flex bg-white/[0.03] border border-white/[0.08] rounded-full p-1.5 mb-12 shadow-2xl backdrop-blur-xl">
           <button className={`px-8 py-2.5 rounded-full text-[11px] tracking-[0.2em] uppercase transition-all duration-500 ease-out cursor-pointer ${mode === "existing" ? "bg-gradient-to-r from-emerald-500/80 to-teal-500/80 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] font-medium" : "text-white/40 hover:text-white/80"}`} onClick={() => setMode("existing")}>Mode A: Existing System</button>
           <button className={`px-8 py-2.5 rounded-full text-[11px] tracking-[0.2em] uppercase transition-all duration-500 ease-out cursor-pointer ${mode === "new" ? "bg-gradient-to-r from-amber-500/80 to-orange-500/80 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)] font-medium" : "text-white/40 hover:text-white/80"}`} onClick={() => setMode("new")}>Mode B: New System</button>
        </div>

        <div className="w-full space-y-10">
          {/* Section: System Definitions */}
          {mode === "existing" ? (
             <div className="p-8 rounded-2xl bg-black/60 border border-emerald-500/20 backdrop-blur-xl shadow-2xl overflow-hidden relative">
                 {/* Visual glow element */}
                 <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />
                 
                 <div className="flex items-center gap-4 mb-6">
                     <div className="h-4 w-1 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                     <h3 className="text-[14px] tracking-[0.25em] text-white/80 uppercase font-light">Target Host System Lookup</h3>
                 </div>
                 
                 {selectedSystem && (
                     <div className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex justify-between items-center transition-all">
                        <div>
                            <p className="text-xs tracking-widest text-emerald-400/80 uppercase mb-1">Target Locked</p>
                            <h4 className="text-xl font-light text-white">{selectedSystem.system_name}</h4>
                            <p className="text-xs text-white/40 mt-1">Host Planets: {selectedSystem.num_planets} • {selectedSystem.constellation_name} • Distance: {selectedSystem.distance_ly || "Unknown"} ly</p>
                        </div>
                        <button onClick={() => setSelectedSystem(null)} className="text-[10px] text-white/40 hover:text-white px-3 py-1 bg-white/5 rounded cursor-pointer uppercase tracking-widest border border-white/10">Change Target</button>
                     </div>
                 )}

                 {!selectedSystem && (
                   <div className="relative z-10">
                      <div className="relative mb-6">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-lg">⌕</span>
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by system name (e.g. Kepler-186)..." className="w-full bg-white/[0.04] border border-white/[0.1] focus:border-emerald-500/50 rounded-xl px-12 py-4 text-sm tracking-wide text-white focus:outline-none focus:bg-white/[0.06] transition-all" />
                      </div>
                      
                      <div className="h-[280px] overflow-y-auto pr-2 flex flex-col gap-2 relative">
                         {searching && <div className="absolute inset-0 flex items-center justify-center text-emerald-500/60 text-xs tracking-widest uppercase animate-pulse">Scanning DB...</div>}
                         {!searching && searchQuery !== "" && searchResults.length === 0 && <div className="text-center py-8 text-white/30 text-xs uppercase tracking-widest">No matching systems found.</div>}
                         {!searching && searchResults.map(sys => (
                             <button key={sys.system_id} onClick={() => setSelectedSystem(sys)} className="group flex justify-between items-center w-full p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all text-left cursor-pointer">
                                <div>
                                    <h4 className="text-sm tracking-widest text-emerald-400/60 group-hover:text-emerald-400 font-light mb-1">{sys.system_name}</h4>
                                    <p className="text-[10px] tracking-wider text-white/40 uppercase">{sys.constellation_name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] tracking-wider text-white/40 uppercase font-mono">{sys.num_planets} Planets</p>
                                    <p className="text-[10px] tracking-wider text-white/40 uppercase font-mono mt-1">{sys.distance_ly ? sys.distance_ly+" ly" : "UNK ly"}</p>
                                </div>
                             </button>
                         ))}
                      </div>
                   </div>
                 )}
             </div>
          ) : (
            <div className="p-8 rounded-2xl bg-black/60 border border-amber-500/20 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/5 blur-[120px] pointer-events-none rounded-full" />
                 
                 <div className="flex items-center gap-4 mb-8">
                     <div className="h-4 w-1 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                     <h3 className="text-[14px] tracking-[0.25em] text-white/80 uppercase font-light">New System Matrix</h3>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {renderField("Desired System Name", "system_name", "text")}
                    <div className="flex flex-col mb-4">
                      <label className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-1 pl-2">Constellation Jurisdiction</label>
                      <select name="constellation_id" value={form.constellation_id} onChange={handleChange} className="w-full bg-white/[0.02] hover:bg-white/[0.05] border-b border-white/[0.1] focus:border-amber-400/50 rounded-t-lg p-2.5 text-white/90 text-[13px] outline-none cursor-pointer">
                          <option value="" className="bg-black text-white/40">-- Auto-Calculate Coordinates based on Region --</option>
                          {constellations.map(c => <option key={c.constellation_id} value={c.constellation_id} className="bg-[#111]">{c.constellation_name}</option>)}
                      </select>
                    </div>
                    {renderField("Num Stars", "num_stars")}
                    {renderField("Num Moons", "num_moons")}
                    {renderField("Num Planets", "num_planets")}
                    {renderField("Distance (ly)", "distance_ly")}
                 </div>

                 <div className="py-6 border-t border-white/[0.06] border-b mb-4">
                     <p className="text-[11px] tracking-[0.2em] text-white/30 uppercase mb-6 flex items-center gap-3">
                         <span className="w-1.5 h-1.5 rounded-full bg-white/20" /> Host Star Mechanics
                     </p>
                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                         {renderField("Star Name (Optional)", "star_name", "text")}
                         {renderField("Spectral Type", "spectral_type", "text")}
                         {renderField("Star Temp (K)", "star_temp")}
                         {renderField("Radius (R☉)", "star_radius")}
                         {renderField("Mass (M☉)", "star_mass")}
                         {renderField("Luminosity (L☉)", "star_luminosity")}
                         {renderField("Gravity (log g)", "star_gravity")}
                         {renderField("Age (Gyr)", "star_age")}
                         {renderField("Metallicity", "star_metallicity")}
                         {renderField("Brightness (mag)", "star_brightness")}
                     </div>
                 </div>
            </div>
          )}

          {/* Discovery Metadata */}
          <div className="p-8 rounded-2xl bg-black/60 border border-blue-500/20 backdrop-blur-xl shadow-2xl relative overflow-hidden">
             <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/5 blur-[120px] pointer-events-none rounded-full" />
             <div className="flex items-center gap-4 mb-8">
                 <div className="h-4 w-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                 <h3 className="text-[14px] tracking-[0.25em] text-white/80 uppercase font-light">Discovery Telemetry</h3>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-3 gap-6 relative z-10">
                {renderField("Discovery Year", "discovery_year")}
                {renderField("Method (e.g. Transit)", "discovery_method", "text")}
                {renderField("Locale (e.g. Space)", "discovery_locale", "text")}
                {renderField("Facility (e.g. Kepler)", "discovery_facility", "text")}
                {renderField("Telescope", "discovery_telescope", "text")}
                {renderField("Instrument", "discovery_instrument", "text")}
             </div>
          </div>

          {/* Planet Payload Details */}
          <div className="p-8 rounded-2xl bg-black/60 border border-purple-500/20 backdrop-blur-xl shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-[120px] pointer-events-none rounded-full" />
             <div className="flex items-center justify-between mb-8 relative z-10">
                 <div className="flex items-center gap-4">
                     <div className="h-4 w-1 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
                     <h3 className="text-[14px] tracking-[0.25em] text-white/80 uppercase font-light">Planet Configuration Payload</h3>
                 </div>
             </div>
             
             <div className="mb-10 pb-6 border-b border-white/[0.08] relative z-10">
                 <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mb-4">Quick Habitability Presets:</p>
                 <div className="flex flex-wrap gap-2">
                    {Object.keys(PRESETS).map((tier: any) => (
                        <button key={tier} type="button" onClick={() => setHabitability(tier)} className="px-4 py-2 rounded-full border border-purple-500/20 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200/80 hover:text-purple-100 text-[10px] uppercase tracking-wider transition-all duration-300 font-mono cursor-pointer shadow-sm shadow-purple-900/20">
                            {tier}
                        </button>
                    ))}
                 </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 relative z-10">
                 <div className="col-span-2 md:col-span-4 mb-4">
                    {renderField("Target Planet Name", "planet_name", "text")}
                 </div>
                 
                 <div className="col-span-2 md:col-span-4 flex items-center gap-8 mb-6 bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                            <input type="checkbox" name="is_circumbinary" checked={form.is_circumbinary} onChange={handleChange} className="sr-only" />
                            <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${form.is_circumbinary ? "bg-purple-500 border-purple-400" : "bg-black border-white/20 group-hover:border-purple-500/50"}`}>
                                {form.is_circumbinary && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                            </div>
                        </div>
                        <span className="text-[11px] tracking-wider uppercase text-white/60 group-hover:text-white/90">Circumbinary</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                            <input type="checkbox" name="ttv_obs" checked={form.ttv_obs} onChange={handleChange} className="sr-only" />
                            <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${form.ttv_obs ? "bg-blue-500 border-blue-400" : "bg-black border-white/20 group-hover:border-blue-500/50"}`}>
                                {form.ttv_obs && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                            </div>
                        </div>
                        <span className="text-[11px] tracking-wider uppercase text-white/60 group-hover:text-white/90">TTV Observed</span>
                    </label>
                 </div>

                 {renderField("Radius (R⊕)", "radius_earth")}
                 {renderField("Mass (M⊕)", "mass_earth")}
                 {renderField("Density (g/cm³)", "planet_density")}
                 {renderField("Temp (K)", "planet_temp")}
                 {renderField("Orbital Period (d)", "orbital_period")}
                 {renderField("Orbit Radius (AU)", "orbit_radius")}
                 {renderField("Eccentricity", "eccentricity")}
                 {renderField("Insolation Flux", "insolation_flux")}
             </div>
          </div>

          <button onClick={submit} className="w-full flex items-center justify-center gap-4 py-5 mt-4 rounded-2xl bg-white/5 hover:bg-white text-white/90 hover:text-black font-semibold text-sm tracking-[0.25em] uppercase transition-all duration-500 border border-white/10 hover:border-white shadow-[0_0_0_transparent] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] cursor-pointer group">
             Initialize Integration Sequence <span className="transform group-hover:translate-x-2 transition-transform">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
