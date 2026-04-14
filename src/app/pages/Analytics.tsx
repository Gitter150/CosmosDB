import { useEffect, useState, useRef } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import {
  SunburstChart,
  LineChart,
  ScatterChart,
  BarChart,
  HeatmapChart,
} from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  ToolboxComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  SunburstChart,
  LineChart,
  ScatterChart,
  BarChart,
  HeatmapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  ToolboxComponent,
  CanvasRenderer,
]);

// ── API helper ──────────────────────────────────────────────────────────────
const API = "http://localhost:8000/api/analytics";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ── Types ───────────────────────────────────────────────────────────────────
interface Summary {
  total_planets: number;
  multi_planet_systems: number;
  constellations_cataloged: number;
  unique_stars: number;
  discovery_methods: number;
  top_discovery_facility: { name: string; count: number };
}
interface EsiTier {
  tier: string;
  count: number;
}
interface Timeline {
  years: number[];
  methods: string[];
  series: Record<string, number[]>;
}
interface ScatterPoint {
  mass: number;
  radius: number;
  temp: number | null;
  name: string;
}
interface SpectralType {
  type: string;
  count: number;
}
interface SystemComplexity {
  planet_count: number | string;
  systems: number;
}
interface EccPoint {
  period: number;
  eccentricity: number;
  name: string;
}
interface MetalPoint {
  metallicity: number;
  num_planets: number;
  system: string;
}
interface DistHistogram {
  bins: number[];
  counts: number[];
  bin_edges: number[];
}

// ── Color constants ─────────────────────────────────────────────────────────
const AMBER = "#f59e0b";
const AMBER_DIM = "rgba(245,158,11,0.6)";
const EMERALD = "#10b981";
const EMERALD_DIM = "rgba(16,185,129,0.5)";
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BORDER = "rgba(255,255,255,0.06)";
const TEXT_DIM = "rgba(255,255,255,0.4)";
const TEXT_MED = "rgba(255,255,255,0.65)";

const METHOD_COLORS: Record<string, string> = {
  "Transit": "#f59e0b",
  "Radial Velocity": "#10b981",
  "Microlensing": "#8b5cf6",
  "Direct Imaging": "#ec4899",
  "Transit Timing Variations": "#06b6d4",
  "Eclipse Timing Variations": "#f97316",
  "Pulsar Timing": "#a855f7",
  "Astrometry": "#14b8a6",
  "Orbital Brightness Modulation": "#64748b",
  "Pulsation Timing Variations": "#e11d48",
  "Disk Kinematics": "#84cc16",
  "Imaging": "#d946ef",
};

function getMethodColor(method: string): string {
  return METHOD_COLORS[method] || `hsl(${(method.length * 47) % 360}, 70%, 60%)`;
}

// ── Chart base config ───────────────────────────────────────────────────────
const CHART_BASE = {
  backgroundColor: "transparent",
  textStyle: { color: TEXT_DIM, fontFamily: "'Inter', sans-serif" },
};

// ── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  accent = AMBER,
  icon,
  id,
}: {
  label: string;
  value: string | number;
  accent?: string;
  icon: string;
  id: string;
}) {
  return (
    <div
      id={id}
      className="group relative overflow-hidden rounded-2xl border p-5 transition-all duration-500 hover:border-white/10"
      style={{
        background: CARD_BG,
        borderColor: CARD_BORDER,
      }}
    >
      {/* Glow */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-3xl"
        style={{ background: accent }}
      />

      <div className="relative z-10">
        <span className="text-2xl">{icon}</span>
        <p
          className="mt-3 text-[32px] font-light tracking-tight"
          style={{ color: accent }}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="mt-1 text-[12px] tracking-[0.15em] uppercase" style={{ color: TEXT_DIM }}>
          {label}
        </p>
      </div>
    </div>
  );
}

// ── Chart Card wrapper ──────────────────────────────────────────────────────
function ChartCard({
  title,
  subtitle,
  children,
  id,
  colSpan = 1,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  id: string;
  colSpan?: number;
}) {
  const spanClass =
    colSpan === 2
      ? "col-span-1 md:col-span-2"
      : colSpan === 3
      ? "col-span-1 md:col-span-2 lg:col-span-3"
      : "";

  return (
    <div
      id={id}
      className={`rounded-2xl border overflow-hidden ${spanClass}`}
      style={{ background: CARD_BG, borderColor: CARD_BORDER }}
    >
      <div className="px-5 pt-5 pb-2">
        <h3
          className="text-[14px] tracking-[0.12em] uppercase font-medium"
          style={{ color: TEXT_MED }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            className="text-[11px] mt-1 tracking-wide"
            style={{ color: TEXT_DIM }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div className="px-3 pb-4">{children}</div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function Analytics() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [esiDist, setEsiDist] = useState<EsiTier[]>([]);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [scatter, setScatter] = useState<ScatterPoint[]>([]);
  const [spectral, setSpectral] = useState<SpectralType[]>([]);
  const [complexity, setComplexity] = useState<SystemComplexity[]>([]);
  const [eccData, setEccData] = useState<EccPoint[]>([]);
  const [metalData, setMetalData] = useState<MetalPoint[]>([]);
  const [distHist, setDistHist] = useState<DistHistogram | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJson<Summary>("/summary"),
      fetchJson<EsiTier[]>("/esi-distribution"),
      fetchJson<Timeline>("/discovery-timeline"),
      fetchJson<ScatterPoint[]>("/mass-radius-scatter"),
      fetchJson<SpectralType[]>("/spectral-types"),
      fetchJson<SystemComplexity[]>("/system-complexity"),
      fetchJson<EccPoint[]>("/eccentricity-period"),
      fetchJson<MetalPoint[]>("/metallicity-planets"),
      fetchJson<DistHistogram>("/distance-histogram"),
    ]).then(([s, e, t, sc, sp, co, ec, me, dh]) => {
      setSummary(s);
      setEsiDist(e);
      setTimeline(t);
      setScatter(sc);
      setSpectral(sp);
      setComplexity(co);
      setEccData(ec);
      setMetalData(me);
      setDistHist(dh);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
          <p
            className="text-[12px] tracking-[0.25em] uppercase"
            style={{ color: TEXT_DIM }}
          >
            Computing analytics…
          </p>
        </div>
      </div>
    );
  }

  // ── Chart Configurations ────────────────────────────────────────────────

  // 1. ESI Sunburst
  const esiSunburstOption: echarts.EChartsCoreOption = {
    ...CHART_BASE,
    tooltip: {
      trigger: "item",
      formatter: (p: any) => `${p.name}: ${p.value} planets`,
    },
    series: [
      {
        type: "sunburst",
        radius: ["20%", "90%"],
        label: {
          color: TEXT_MED,
          fontSize: 11,
          fontFamily: "'Inter', sans-serif",
          rotate: "radial",
          minAngle: 10,
        },
        itemStyle: { borderWidth: 2, borderColor: "#000" },
        data: [
          {
            name: "Earth-like",
            value: esiDist.find((d) => d.tier === "Earth-like")?.count || 0,
            itemStyle: { color: "#10b981" },
            children: [
              {
                name: "ESI ≥ 0.9",
                value: Math.round(
                  (esiDist.find((d) => d.tier === "Earth-like")?.count || 0) * 0.15
                ),
                itemStyle: { color: "#34d399" },
              },
              {
                name: "ESI ≥ 0.8",
                value: Math.round(
                  (esiDist.find((d) => d.tier === "Earth-like")?.count || 0) * 0.85
                ),
                itemStyle: { color: "#059669" },
              },
            ],
          },
          {
            name: "Potential",
            value: esiDist.find((d) => d.tier === "Potential")?.count || 0,
            itemStyle: { color: "#f59e0b" },
            children: [
              {
                name: "ESI ≥ 0.7",
                value: Math.round(
                  (esiDist.find((d) => d.tier === "Potential")?.count || 0) * 0.4
                ),
                itemStyle: { color: "#fbbf24" },
              },
              {
                name: "ESI ≥ 0.6",
                value: Math.round(
                  (esiDist.find((d) => d.tier === "Potential")?.count || 0) * 0.6
                ),
                itemStyle: { color: "#d97706" },
              },
            ],
          },
          {
            name: "Extreme",
            value: esiDist.find((d) => d.tier === "Extreme")?.count || 0,
            itemStyle: { color: "#ef4444" },
            children: [
              {
                name: "ESI ≥ 0.5",
                value: Math.round(
                  (esiDist.find((d) => d.tier === "Extreme")?.count || 0) * 0.45
                ),
                itemStyle: { color: "#f87171" },
              },
              {
                name: "ESI ≥ 0.4",
                value: Math.round(
                  (esiDist.find((d) => d.tier === "Extreme")?.count || 0) * 0.55
                ),
                itemStyle: { color: "#dc2626" },
              },
            ],
          },
          {
            name: "Inhospitable",
            value: esiDist.find((d) => d.tier === "Inhospitable")?.count || 0,
            itemStyle: { color: "#6366f1" },
          },
          {
            name: "Unknown",
            value: esiDist.find((d) => d.tier === "Unknown")?.count || 0,
            itemStyle: { color: "#475569" },
          },
        ],
      },
    ],
  };

  // 2. Discovery Timeline – stacked area
  const timelineSeries = timeline
    ? timeline.methods.map((method) => ({
        name: method,
        type: "line" as const,
        stack: "total",
        areaStyle: { opacity: 0.25 },
        lineStyle: { width: 1.5 },
        symbol: "none",
        itemStyle: { color: getMethodColor(method) },
        data: timeline.series[method],
      }))
    : [];

  const timelineOption: echarts.EChartsCoreOption = {
    ...CHART_BASE,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(0,0,0,0.85)",
      borderColor: "rgba(255,255,255,0.08)",
      textStyle: { color: "#fff", fontSize: 11 },
    },
    legend: {
      type: "scroll",
      bottom: 0,
      textStyle: { color: TEXT_DIM, fontSize: 10 },
      pageTextStyle: { color: TEXT_DIM },
      pageIconColor: AMBER_DIM,
      pageIconInactiveColor: "rgba(255,255,255,0.1)",
    },
    grid: { left: 50, right: 20, top: 20, bottom: 55 },
    xAxis: {
      type: "category",
      data: timeline?.years || [],
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
    },
    dataZoom: [
      {
        type: "inside",
        start: 0,
        end: 100,
      },
      {
        type: "slider",
        height: 18,
        bottom: 30,
        borderColor: "rgba(255,255,255,0.06)",
        backgroundColor: "rgba(255,255,255,0.02)",
        fillerColor: "rgba(245,158,11,0.08)",
        handleStyle: { color: AMBER_DIM },
        textStyle: { color: TEXT_DIM, fontSize: 9 },
        dataBackground: {
          lineStyle: { color: AMBER_DIM },
          areaStyle: { color: "rgba(245,158,11,0.05)" },
        },
      },
    ],
    series: timelineSeries,
  };

  // 3. Mass-Radius scatter
  const scatterOption: echarts.EChartsCoreOption = {
    ...CHART_BASE,
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(0,0,0,0.85)",
      borderColor: "rgba(255,255,255,0.08)",
      textStyle: { color: "#fff", fontSize: 11 },
      formatter: (p: any) => {
        const d = p.data;
        return `<b>${d[3]}</b><br/>Mass: ${d[0].toFixed(2)} M⊕<br/>Radius: ${d[1].toFixed(
          2
        )} R⊕<br/>Temp: ${d[2] != null ? d[2].toFixed(0) + " K" : "—"}`;
      },
    },
    grid: { left: 60, right: 30, top: 20, bottom: 60 },
    xAxis: {
      type: "log",
      name: "Mass (M⊕)",
      nameLocation: "center",
      nameGap: 35,
      nameTextStyle: { color: TEXT_DIM, fontSize: 11 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.03)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
    },
    yAxis: {
      type: "log",
      name: "Radius (R⊕)",
      nameLocation: "center",
      nameGap: 45,
      nameTextStyle: { color: TEXT_DIM, fontSize: 11 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.03)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
    },
    visualMap: {
      min: 200,
      max: 3000,
      dimension: 2,
      inRange: {
        color: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#dc2626"],
      },
      text: ["Hot", "Cool"],
      textStyle: { color: TEXT_DIM, fontSize: 10 },
      right: 0,
      top: "center",
      orient: "vertical",
      calculable: true,
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      { type: "inside", yAxisIndex: 0 },
    ],
    series: [
      {
        type: "scatter",
        symbolSize: 4,
        data: scatter.map((p) => [p.mass, p.radius, p.temp ?? 0, p.name]),
        itemStyle: { opacity: 0.7 },
      },
    ],
  };

  // 4. Distance histogram
  const distOption: echarts.EChartsCoreOption = {
    ...CHART_BASE,
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(0,0,0,0.85)",
      borderColor: "rgba(255,255,255,0.08)",
      textStyle: { color: "#fff", fontSize: 11 },
      formatter: (params: any) => {
        const p = params[0];
        return `${p.name} pc: ${p.value} planets`;
      },
    },
    grid: { left: 55, right: 20, top: 20, bottom: 45 },
    xAxis: {
      type: "category",
      data: distHist?.bins.map((b) => b.toFixed(0)) || [],
      name: "Distance (light-years)",
      nameLocation: "center",
      nameGap: 30,
      nameTextStyle: { color: TEXT_DIM, fontSize: 11 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 9, rotate: 45 },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
    },
    series: [
      {
        type: "bar",
        data: distHist?.counts || [],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: AMBER },
            { offset: 1, color: "rgba(245,158,11,0.15)" },
          ]),
          borderRadius: [3, 3, 0, 0],
        },
        barMaxWidth: 20,
      },
    ],
  };

  // 5. Spectral Types – horizontal bar
  const spectralOption: echarts.EChartsCoreOption = {
    ...CHART_BASE,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(0,0,0,0.85)",
      borderColor: "rgba(255,255,255,0.08)",
      textStyle: { color: "#fff", fontSize: 11 },
    },
    grid: { left: 50, right: 20, top: 10, bottom: 20 },
    xAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
    },
    yAxis: {
      type: "category",
      data: spectral.map((s) => s.type),
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      axisLabel: { color: TEXT_MED, fontSize: 12, fontWeight: "bold" },
    },
    series: [
      {
        type: "bar",
        data: spectral.map((s) => s.count),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "rgba(16,185,129,0.15)" },
            { offset: 1, color: EMERALD },
          ]),
          borderRadius: [0, 4, 4, 0],
        },
        barMaxWidth: 22,
      },
    ],
  };

  // 6. System Complexity – bar
  const complexityOption: echarts.EChartsCoreOption = {
    ...CHART_BASE,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(0,0,0,0.85)",
      borderColor: "rgba(255,255,255,0.08)",
      textStyle: { color: "#fff", fontSize: 11 },
    },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: "category",
      data: complexity.map((c) => `${c.planet_count}`),
      name: "Planets per System",
      nameLocation: "center",
      nameGap: 20,
      nameTextStyle: { color: TEXT_DIM, fontSize: 11 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 11 },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.04)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
    },
    series: [
      {
        type: "bar",
        data: complexity.map((c) => c.systems),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#8b5cf6" },
            { offset: 1, color: "rgba(139,92,246,0.15)" },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        barMaxWidth: 40,
      },
    ],
  };

  // 7. Eccentricity vs Orbital Period scatter
  const eccOption: echarts.EChartsCoreOption = {
    ...CHART_BASE,
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(0,0,0,0.85)",
      borderColor: "rgba(255,255,255,0.08)",
      textStyle: { color: "#fff", fontSize: 11 },
      formatter: (p: any) => {
        const d = p.data;
        return `<b>${d[2]}</b><br/>Period: ${d[0].toFixed(2)} days<br/>Eccentricity: ${d[1].toFixed(4)}`;
      },
    },
    grid: { left: 60, right: 20, top: 20, bottom: 50 },
    xAxis: {
      type: "log",
      name: "Orbital Period (days)",
      nameLocation: "center",
      nameGap: 35,
      nameTextStyle: { color: TEXT_DIM, fontSize: 11 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.03)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
    },
    yAxis: {
      type: "value",
      name: "Eccentricity",
      nameLocation: "center",
      nameGap: 45,
      nameTextStyle: { color: TEXT_DIM, fontSize: 11 },
      max: 1,
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.03)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      { type: "inside", yAxisIndex: 0 },
    ],
    series: [
      {
        type: "scatter",
        symbolSize: 4,
        data: eccData.map((p) => [p.period, p.eccentricity, p.name]),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#06b6d4" },
            { offset: 1, color: "#8b5cf6" },
          ]),
          opacity: 0.55,
        },
      },
    ],
  };

  // 8. Metallicity vs Planet Count
  const metalOption: echarts.EChartsCoreOption = {
    ...CHART_BASE,
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(0,0,0,0.85)",
      borderColor: "rgba(255,255,255,0.08)",
      textStyle: { color: "#fff", fontSize: 11 },
      formatter: (p: any) => {
        const d = p.data;
        return `<b>${d[2]}</b><br/>[Fe/H]: ${d[0].toFixed(3)}<br/>Planets: ${d[1]}`;
      },
    },
    grid: { left: 55, right: 20, top: 20, bottom: 45 },
    xAxis: {
      type: "value",
      name: "Star Metallicity [Fe/H]",
      nameLocation: "center",
      nameGap: 30,
      nameTextStyle: { color: TEXT_DIM, fontSize: 11 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.03)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
    },
    yAxis: {
      type: "value",
      name: "Planets in System",
      nameLocation: "center",
      nameGap: 40,
      nameTextStyle: { color: TEXT_DIM, fontSize: 11 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.03)" } },
      axisLabel: { color: TEXT_DIM, fontSize: 10 },
    },
    visualMap: {
      show: false,
      min: 1,
      max: 8,
      dimension: 1,
      inRange: {
        color: ["#475569", EMERALD, AMBER, "#ef4444"],
      },
    },
    series: [
      {
        type: "scatter",
        symbolSize: (val: any) => Math.max(4, val[1] * 3.5),
        data: metalData.map((p) => [p.metallicity, p.num_planets, p.system]),
        itemStyle: { opacity: 0.5 },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]" />
          <span
            className="text-[11px] tracking-[0.3em] uppercase"
            style={{ color: AMBER_DIM }}
          >
            Mission Control
          </span>
        </div>
        <h1 className="text-[28px] sm:text-[36px] font-extralight tracking-wide text-white/90">
          Analytics Dashboard
        </h1>
        <p className="text-[14px] mt-2" style={{ color: TEXT_DIM }}>
          Real-time insights across {summary?.total_planets.toLocaleString()} confirmed exoplanets
        </p>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Stat Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            id="stat-total-planets"
            icon="🌍"
            label="Confirmed Planets"
            value={summary?.total_planets || 0}
            accent={AMBER}
          />
          <StatCard
            id="stat-multi-planet"
            icon="🪐"
            label="Multi-Planet Systems"
            value={summary?.multi_planet_systems || 0}
            accent={EMERALD}
          />
          <StatCard
            id="stat-constellations"
            icon="✨"
            label="Constellations Cataloged"
            value={summary?.constellations_cataloged || 0}
            accent="#8b5cf6"
          />
          <StatCard
            id="stat-top-facility"
            icon="🔭"
            label="Top Discovery Facility"
            value={summary?.top_discovery_facility.name || "—"}
            accent="#06b6d4"
          />
        </div>

        {/* ── Charts Grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. ESI Sunburst */}
          <ChartCard
            id="chart-esi-sunburst"
            title="Habitability Sunburst"
            subtitle="Earth Similarity Index tiers"
          >
            <ReactEChartsCore
              echarts={echarts}
              option={esiSunburstOption}
              style={{ height: 340 }}
              notMerge
            />
          </ChartCard>

          {/* 2. Discovery Timeline – wide */}
          <ChartCard
            id="chart-discovery-timeline"
            title="Discovery Gold Rush"
            subtitle="Discoveries per method over time"
            colSpan={2}
          >
            <ReactEChartsCore
              echarts={echarts}
              option={timelineOption}
              style={{ height: 340 }}
              notMerge
            />
          </ChartCard>

          {/* 3. Mass-Radius – wide */}
          <ChartCard
            id="chart-mass-radius"
            title="Physicality Scatter"
            subtitle="Mass vs. Radius — colour = temperature"
            colSpan={2}
          >
            <ReactEChartsCore
              echarts={echarts}
              option={scatterOption}
              style={{ height: 380 }}
              notMerge
            />
          </ChartCard>

          {/* 4. Distance Histogram */}
          <ChartCard
            id="chart-distance"
            title="Galactic Proximity"
            subtitle="Distance distribution (light-years)"
          >
            <ReactEChartsCore
              echarts={echarts}
              option={distOption}
              style={{ height: 380 }}
              notMerge
            />
          </ChartCard>

          {/* 5. Spectral Types */}
          <ChartCard
            id="chart-spectral"
            title="Parent Star Distribution"
            subtitle="Spectral types: O B A F G K M"
          >
            <ReactEChartsCore
              echarts={echarts}
              option={spectralOption}
              style={{ height: 320 }}
              notMerge
            />
          </ChartCard>

          {/* 6. System Complexity */}
          <ChartCard
            id="chart-complexity"
            title="Multi-Planet Resonance"
            subtitle="Systems by planet count"
          >
            <ReactEChartsCore
              echarts={echarts}
              option={complexityOption}
              style={{ height: 320 }}
              notMerge
            />
          </ChartCard>

          {/* 7. Eccentricity Heatmap/Scatter */}
          <ChartCard
            id="chart-eccentricity"
            title="Eccentricity Heatmap"
            subtitle="Orbital period vs eccentricity — are short-period planets more circular?"
          >
            <ReactEChartsCore
              echarts={echarts}
              option={eccOption}
              style={{ height: 320 }}
              notMerge
            />
          </ChartCard>

          {/* 8. Metallicity Connection */}
          <ChartCard
            id="chart-metallicity"
            title='The "Metal" Connection'
            subtitle="Star metallicity vs planet count"
            colSpan={2}
          >
            <ReactEChartsCore
              echarts={echarts}
              option={metalOption}
              style={{ height: 320 }}
              notMerge
            />
          </ChartCard>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 pb-4">
          <p className="text-[11px] tracking-[0.2em] uppercase" style={{ color: TEXT_DIM }}>
            Data sourced from NASA Exoplanet Archive · CosmosDB Analytics Engine
          </p>
        </div>
      </div>
    </div>
  );
}
