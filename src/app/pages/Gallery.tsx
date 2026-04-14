import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";

const API = "http://localhost:8000";

interface SystemCard {
  system_id: number;
  system_name: string;
  ra: number | null;
  dec: number | null;
  num_stars: number;
  num_planets: number;
  num_moons: number;
  distance_ly: number | null;
  constellation_name: string | null;
}

interface ConstellationItem {
  constellation_id: number;
  constellation_name: string;
  system_count: number;
}

export default function Gallery() {
  const navigate = useNavigate();
  const [systems, setSystems] = useState<SystemCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Search
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SystemCard[] | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Constellation filter
  const [constellations, setConstellations] = useState<ConstellationItem[]>([]);
  const [selectedConstellation, setSelectedConstellation] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState(false);

  const limit = 24;

  // Fetch constellations once
  useEffect(() => {
    fetch(`${API}/api/constellations`)
      .then((r) => r.json())
      .then(setConstellations)
      .catch(() => {});
  }, []);

  // Fetch systems
  const fetchSystems = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (selectedConstellation) params.set("constellation", selectedConstellation);

    fetch(`${API}/api/systems?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setSystems(data.systems);
        setTotal(data.total);
        setPages(data.pages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, selectedConstellation]);

  useEffect(() => {
    if (!query) fetchSystems();
  }, [fetchSystems, query]);

  // Search debounce
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetch(`${API}/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then(setSearchResults)
        .catch(() => {});
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  const displaySystems = searchResults ?? systems;

  const handleConstellationSelect = (name: string) => {
    setSelectedConstellation(name);
    setPage(1);
    setShowDropdown(false);
    setQuery("");
    setSearchResults(null);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans relative">
      {/* Subtle star-dust background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="star-field" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6">
          {/* Logo */}
          <button
            onClick={() => {
              setSelectedConstellation("");
              setQuery("");
              setSearchResults(null);
              setPage(1);
            }}
            className="flex items-center gap-3 shrink-0 group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400/80 to-orange-600/80 group-hover:from-amber-300 group-hover:to-orange-500 transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.3)]" />
            <span className="text-lg tracking-[0.2em] font-light text-white/90 uppercase">
              Cosmos
            </span>
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <input
              type="text"
              placeholder="Search systems… e.g. Kepler, Trappist"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white/90 placeholder:text-white/25 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all duration-200"
              id="search-input"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setSearchResults(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Constellation Filter */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 hover:text-white/90 hover:border-white/20 transition-all duration-200 flex items-center gap-2 cursor-pointer"
              id="constellation-filter"
            >
              <span className="text-white/30 text-[10px]">✦</span>
              {selectedConstellation || "All Constellations"}
              <span className="text-white/20 text-[10px] ml-1">▼</span>
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-64 max-h-80 overflow-y-auto bg-[#0a0a0a] border border-white/[0.08] rounded-lg shadow-2xl z-50 scrollbar-thin">
                <button
                  onClick={() => handleConstellationSelect("")}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.04] transition-colors cursor-pointer ${
                    !selectedConstellation ? "text-amber-400/90" : "text-white/60"
                  }`}
                >
                  All Constellations
                </button>
                {constellations.map((c) => (
                  <button
                    key={c.constellation_id}
                    onClick={() => handleConstellationSelect(c.constellation_name)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.04] transition-colors flex justify-between items-center cursor-pointer ${
                      selectedConstellation === c.constellation_name
                        ? "text-amber-400/90"
                        : "text-white/60"
                    }`}
                  >
                    <span>{c.constellation_name}</span>
                    <span className="text-white/20 text-xs">{c.system_count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Count badge */}
          <div className="text-white/30 text-xs tracking-wider shrink-0">
            {searchResults ? searchResults.length : total} systems
          </div>
        </div>
      </header>

      {/* Grid */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {loading && !searchResults ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-white/10 border-t-amber-400/60 rounded-full animate-spin" />
          </div>
        ) : displaySystems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-white/30">
            <p className="text-lg mb-2">No systems found</p>
            <p className="text-sm">Try a different search or filter</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displaySystems.map((sys) => (
                <button
                  key={sys.system_id}
                  onClick={() => navigate(`/system/${sys.system_id}`)}
                  className="group text-left bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300 cursor-pointer relative overflow-hidden"
                  id={`system-card-${sys.system_id}`}
                >
                  {/* Hover glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                  <div className="relative z-10">
                    {/* System name */}
                    <h3 className="text-[15px] font-medium text-white/90 mb-1 tracking-wide group-hover:text-white transition-colors">
                      {sys.system_name}
                    </h3>

                    {/* Constellation */}
                    <p className="text-[12px] text-white/30 mb-4 tracking-wider uppercase">
                      {sys.constellation_name || "Unknown"}
                    </p>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-[12px]">
                      {/* Planet badge */}
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-400/[0.08] text-amber-400/80 border border-amber-400/[0.1]">
                        {sys.num_planets} planet{sys.num_planets !== 1 ? "s" : ""}
                      </span>

                      {sys.num_stars > 1 && (
                        <span className="text-white/20">
                          {sys.num_stars}★
                        </span>
                      )}

                      {sys.distance_ly && (
                        <span className="text-white/20 ml-auto">
                          {sys.distance_ly.toFixed(1)} ly
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {!searchResults && pages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-4 py-2 text-sm text-white/40 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}
