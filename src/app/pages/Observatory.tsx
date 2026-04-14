import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import ESIGauge from "../components/ESIGauge";

const API = "http://localhost:8000";

interface PlanetRow {
  planet_id: number;
  planet_name: string;
  radius_earth: number | null;
  mass_earth: number | null;
  planet_temp: number | null;
  orbit_radius: number | null;
  system_name: string;
  system_id: number;
  distance_ly: number | null;
  constellation_name: string | null;
  discovery_method: string | null;
  discovery_year: number | null;
  esi_score: number | null;
  esi_data?: {
    is_habitable: boolean;
    hz_inner: number | null;
    hz_outer: number | null;
  };
}

interface ConstellationItem {
  constellation_id: number;
  constellation_name: string;
  system_count: number;
}

const SORT_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "esi_score", label: "ESI Score" },
  { value: "mass", label: "Mass" },
  { value: "radius", label: "Radius" },
  { value: "temp", label: "Temperature" },
  { value: "distance", label: "Distance" },
] as const;

const na = (v: any, suffix = ""): string => {
  if (v === null || v === undefined || (typeof v === "number" && isNaN(v)))
    return "N/A";
  return `${typeof v === "number" ? v.toFixed(2) : v}${suffix}`;
};

export default function Observatory() {
  const navigate = useNavigate();

  const [planets, setPlanets] = useState<PlanetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters & sort
  const [sortBy, setSortBy] = useState("esi_score");
  const [order, setOrder] = useState("desc");
  const [filterConstellation, setFilterConstellation] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Dropdown data
  const [constellations, setConstellations] = useState<ConstellationItem[]>([]);
  const [methods, setMethods] = useState<string[]>([]);

  const limit = 50;

  // Load dropdown data once
  useEffect(() => {
    fetch(`${API}/api/constellations`)
      .then((r) => r.json())
      .then(setConstellations)
      .catch(() => {});

    fetch(`${API}/api/discovery_methods`)
      .then((r) => r.json())
      .then(setMethods)
      .catch(() => {});
  }, []);

  // Fetch planets
  const fetchPlanets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort_by: sortBy,
      order,
    });
    if (filterConstellation)
      params.set("filter_constellation", filterConstellation);
    if (filterMethod) params.set("filter_method", filterMethod);
    if (searchQuery) params.set("q", searchQuery);

    fetch(`${API}/api/planets?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPlanets(data.planets || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, sortBy, order, filterConstellation, filterMethod, searchQuery]);

  useEffect(() => {
    fetchPlanets();
  }, [fetchPlanets]);

  const resetFilters = () => {
    setFilterConstellation("");
    setFilterMethod("");
    setSearchQuery("");
    setSortBy("esi_score");
    setOrder("desc");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-black text-white pt-14">
      {/* Control Bar */}
      <div className="sticky top-14 z-40 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search planets..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/20 w-36 sm:w-48"
            />
          </div>

          <div className="w-[1px] h-5 bg-white/[0.06]" />

          {/* Sort */}
          <div className="flex items-center gap-2">
            <label
              className="text-[11px] text-white/30 tracking-wider uppercase"
              htmlFor="sort-select"
            >
              Sort
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-white/70 focus:outline-none focus:border-white/20 cursor-pointer appearance-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-black">
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
              className="px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[12px] text-white/50 hover:text-white/80 cursor-pointer transition-colors"
              id="order-toggle"
              title={order === "asc" ? "Ascending" : "Descending"}
            >
              {order === "asc" ? "↑" : "↓"}
            </button>
          </div>

          <div className="w-[1px] h-5 bg-white/[0.06]" />

          {/* Constellation filter */}
          <select
            id="filter-constellation"
            value={filterConstellation}
            onChange={(e) => {
              setFilterConstellation(e.target.value);
              setPage(1);
            }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-white/70 focus:outline-none focus:border-white/20 cursor-pointer appearance-none max-w-[200px]"
          >
            <option value="" className="bg-black">
              All Constellations
            </option>
            {constellations.map((c) => (
              <option
                key={c.constellation_id}
                value={c.constellation_name}
                className="bg-black"
              >
                {c.constellation_name} ({c.system_count})
              </option>
            ))}
          </select>

          {/* Method filter */}
          <select
            id="filter-method"
            value={filterMethod}
            onChange={(e) => {
              setFilterMethod(e.target.value);
              setPage(1);
            }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-white/70 focus:outline-none focus:border-white/20 cursor-pointer appearance-none max-w-[200px]"
          >
            <option value="" className="bg-black">
              All Methods
            </option>
            {methods.map((m) => (
              <option key={m} value={m} className="bg-black">
                {m}
              </option>
            ))}
          </select>

          {/* Reset */}
          {(filterConstellation || filterMethod || searchQuery || sortBy !== "esi_score") && (
            <button
              onClick={resetFilters}
              className="text-[11px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
              id="reset-filters-btn"
            >
              ✕ Reset
            </button>
          )}

          {/* Spacer + count */}
          <div className="ml-auto text-[11px] text-white/25 tracking-wider">
            {total.toLocaleString()} planets
          </div>
        </div>
      </div>

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-white/10 border-t-amber-400/60 rounded-full animate-spin" />
          </div>
        ) : planets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/30">
            <p className="text-lg mb-2">No planets found</p>
            <p className="text-sm">Try different filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {planets.map((p) => (
                <button
                  key={p.planet_id}
                  onClick={() => navigate(`/system/${p.system_id}?planet=${p.planet_id}`)}
                  className="group text-left bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300 cursor-pointer relative overflow-hidden"
                  id={`planet-card-${p.planet_id}`}
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div className="relative z-10 flex items-start gap-3">
                    {/* ESI Gauge */}
                    <ESIGauge score={p.esi_score} size={48} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-medium text-white/90 truncate group-hover:text-white transition-colors">
                        {p.planet_name}
                      </h3>
                      <p className="text-[11px] text-white/30 tracking-wider uppercase mt-0.5">
                        {p.constellation_name || "Unknown"}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="relative z-10 mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                    <div>
                      <span className="text-white/25">Mass</span>
                      <span className="ml-1.5 text-white/60">
                        {na(p.mass_earth, " M⊕")}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/25">Radius</span>
                      <span className="ml-1.5 text-white/60">
                        {na(p.radius_earth, " R⊕")}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/25">Temp</span>
                      <span className="ml-1.5 text-white/60">
                        {na(p.planet_temp, " K")}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/25">Dist</span>
                      <span className="ml-1.5 text-white/60">
                        {na(p.distance_ly, " ly")}
                      </span>
                    </div>
                  </div>

                  {/* Habitable badge */}
                  {p.esi_data?.is_habitable && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-500/[0.1] border border-emerald-500/20 text-emerald-400/80 text-[9px] tracking-wider uppercase">
                      HZ
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-4 py-2 text-sm text-white/40 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  id="prev-page-btn"
                >
                  ← Prev
                </button>
                <span className="text-white/30 text-sm tracking-wider">
                  {page} / {pages}
                </span>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                  className="px-4 py-2 text-sm text-white/40 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  id="next-page-btn"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
