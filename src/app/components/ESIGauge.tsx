interface ESIGaugeProps {
  /** ESI score 0-1 */
  score: number | null;
  /** Diameter in px. Defaults to 52. */
  size?: number;
  /** Show the numeric label. Defaults to true. */
  showLabel?: boolean;
}

/**
 * Circular ESI dial/gauge.
 *   Red    for < 0.3
 *   Amber  for 0.3 - 0.7
 *   Emerald for > 0.7
 */
export default function ESIGauge({
  score,
  size = 52,
  showLabel = true,
}: ESIGaugeProps) {
  if (score === null || score === undefined) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-white/[0.08]"
        style={{ width: size, height: size }}
      >
        <span className="text-[10px] text-white/25">N/A</span>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(1, score));
  const percent = clamped * 100;

  // Color by tier
  let strokeColor: string;
  let glowColor: string;
  let textColor: string;
  if (clamped < 0.3) {
    strokeColor = "#ef4444"; // red-500
    glowColor = "rgba(239,68,68,0.25)";
    textColor = "text-red-400";
  } else if (clamped < 0.7) {
    strokeColor = "#f59e0b"; // amber-500
    glowColor = "rgba(245,158,11,0.25)";
    textColor = "text-amber-400";
  } else {
    strokeColor = "#10b981"; // emerald-500
    glowColor = "rgba(16,185,129,0.25)";
    textColor = "text-emerald-400";
  }

  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
        style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={3}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      {showLabel && (
        <span className={`text-[11px] font-medium ${textColor} relative z-10`}>
          {percent < 1 && percent > 0
            ? percent.toFixed(1)
            : Math.round(percent)}
        </span>
      )}
    </div>
  );
}
