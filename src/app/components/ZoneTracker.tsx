interface ZoneTrackerProps {
  /** Inner habitable zone bound (AU) */
  hzInner: number | null;
  /** Outer habitable zone bound (AU) */
  hzOuter: number | null;
  /** Planet orbit distance (AU) */
  orbitDistance: number | null;
  /** Star luminosity (L_sun) */
  starLuminosity?: number | null;
}

/**
 * Horizontal bar showing the star's Habitable Zone with a dot
 * showing where the planet sits: Too Hot | Just Right | Too Cold
 */
export default function ZoneTracker({
  hzInner,
  hzOuter,
  orbitDistance,
}: ZoneTrackerProps) {
  if (hzInner === null || hzOuter === null || orbitDistance === null) {
    return (
      <div className="w-full py-4">
        <p className="text-white/20 text-xs text-center">
          Insufficient data for zone analysis
        </p>
      </div>
    );
  }

  // Scale: we want the bar to span from 0 to some max that covers the planet orbit
  // and the HZ bounds comfortably.
  const maxDist = Math.max(hzOuter * 1.8, orbitDistance * 1.5, 2);
  const toPercent = (val: number) => Math.min(100, Math.max(0, (val / maxDist) * 100));

  const innerPct = toPercent(hzInner);
  const outerPct = toPercent(hzOuter);
  const planetPct = toPercent(orbitDistance);

  // Determine zone
  let zoneLabel: string;
  let zoneLabelColor: string;
  if (orbitDistance < hzInner) {
    zoneLabel = "Too Hot";
    zoneLabelColor = "text-red-400";
  } else if (orbitDistance > hzOuter) {
    zoneLabel = "Too Cold";
    zoneLabelColor = "text-blue-400";
  } else {
    zoneLabel = "Habitable Zone";
    zoneLabelColor = "text-emerald-400";
  }

  const dotColor =
    orbitDistance < hzInner
      ? "#ef4444"
      : orbitDistance > hzOuter
        ? "#60a5fa"
        : "#10b981";

  return (
    <div className="w-full" id="zone-tracker">
      {/* Labels */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-white/30 tracking-wider uppercase">
          Habitability Zone Tracker
        </span>
        <span className={`text-[12px] font-medium ${zoneLabelColor}`}>
          {zoneLabel}
        </span>
      </div>

      {/* Bar */}
      <div className="relative w-full h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        {/* Too Hot zone (left of inner) */}
        <div
          className="absolute top-0 bottom-0 left-0"
          style={{
            width: `${innerPct}%`,
            background:
              "linear-gradient(90deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 100%)",
          }}
        />

        {/* Habitable zone (green band) */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `${innerPct}%`,
            width: `${outerPct - innerPct}%`,
            background:
              "linear-gradient(90deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.08) 100%)",
            borderLeft: "1px solid rgba(16,185,129,0.3)",
            borderRight: "1px solid rgba(16,185,129,0.3)",
          }}
        />

        {/* Too Cold zone (right of outer) */}
        <div
          className="absolute top-0 bottom-0 right-0"
          style={{
            left: `${outerPct}%`,
            width: `${100 - outerPct}%`,
            background:
              "linear-gradient(90deg, rgba(96,165,250,0.04) 0%, rgba(96,165,250,0.12) 100%)",
          }}
        />

        {/* Planet dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
          style={{ left: `${planetPct}%` }}
        >
          <div
            className="w-3.5 h-3.5 rounded-full border-2"
            style={{
              backgroundColor: dotColor,
              borderColor: "rgba(255,255,255,0.4)",
              boxShadow: `0 0 10px ${dotColor}80, 0 0 20px ${dotColor}40`,
            }}
          />
        </div>

        {/* Inner bound label */}
        <div
          className="absolute bottom-0.5 text-[8px] text-emerald-400/50 -translate-x-1/2"
          style={{ left: `${innerPct}%` }}
        >
          {hzInner.toFixed(2)}
        </div>

        {/* Outer bound label */}
        <div
          className="absolute bottom-0.5 text-[8px] text-emerald-400/50 -translate-x-1/2"
          style={{ left: `${outerPct}%` }}
        >
          {hzOuter.toFixed(2)}
        </div>
      </div>

      {/* Orbit distance label */}
      <div className="mt-1.5 text-center">
        <span className="text-[11px] text-white/30">
          Orbit: <span className="text-white/60">{orbitDistance.toFixed(3)} AU</span>
        </span>
      </div>
    </div>
  );
}
