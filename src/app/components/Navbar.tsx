import { useLocation, useNavigate } from "react-router";

const TABS = [
  { label: "Home", path: "/" },
  { label: "Observatory", path: "/observatory" },
  { label: "Analytics", path: "/analytics" },
] as const;

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Hide navbar on full-screen views (system visualizer, planet detail)
  const hideOn = ["/system/", "/planet/"];
  if (hideOn.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[100] border-b border-white/[0.06]"
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 100%)",
        backdropFilter: "blur(24px) saturate(1.6)",
        WebkitBackdropFilter: "blur(24px) saturate(1.6)",
      }}
      id="main-navbar"
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 group cursor-pointer"
          id="logo-btn"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400/90 to-orange-600/90 group-hover:from-amber-300 group-hover:to-orange-500 transition-all duration-300 shadow-[0_0_18px_rgba(245,158,11,0.35)]" />
          <span className="text-[15px] tracking-[0.22em] font-light text-white/85 uppercase">
            Cosmos
          </span>
        </button>

        {/* Tabs */}
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`relative px-5 py-1.5 text-[13px] tracking-wider uppercase rounded-full transition-all duration-300 cursor-pointer ${
                  active
                    ? "text-amber-400/95 bg-amber-400/[0.08]"
                    : "text-white/40 hover:text-white/75 hover:bg-white/[0.04]"
                }`}
                id={`nav-tab-${tab.label.toLowerCase()}`}
              >
                {tab.label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-amber-400/60 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Spacer for symmetry */}
        <div className="w-24" />
      </div>
    </nav>
  );
}
