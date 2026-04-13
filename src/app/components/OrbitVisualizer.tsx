import { useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────

interface StarPalette {
  core: string;
  limb: string;
  bloom: [string, string, string];
  corona: [string, string];
  companionHue: string;
  glowOpacity: number;
}

/** 
 * Temperature-Color map (Kelvin: Hex Color) 
 * We use these anchor points to interpolate the final color.
 */
const TEMP_ANCHORS = [
  { temp: 500, hex: "#300030" },   // Deep Purple (Brown Dwarf)
  { temp: 2000, hex: "#cc2900" },  // Deep Red 
  { temp: 2500, hex: "#ff3800" },  // Bright Red
  { temp: 4000, hex: "#ff7f00" },  // Vibrant Orange
  { temp: 5800, hex: "#ffd700" },  // Strong Gold/Yellow
  { temp: 8000, hex: "#f8fbff" },  // White/Pale Blue
  { temp: 12000, hex: "#80b3ff" }, // Light Blue
  { temp: 30000, hex: "#2050ff" }, // Intense Deep Blue
  { temp: 50000, hex: "#9933ff" }, // Violet
];

/**
 * Returns a complete STAR palette based on physics-inspired temperature mapping.
 */
function getStarPalette(temp: number): StarPalette {
  // 1. Clamp temperature and parse if string
  const t = Math.max(500, Math.min(60000, Number(temp)));

  // 2. Linear Interpolation between anchors
  let baseColor: { r: number, g: number, b: number };
  if (t <= TEMP_ANCHORS[0].temp) {
    baseColor = hexToRgb(TEMP_ANCHORS[0].hex)!;
  } else if (t >= TEMP_ANCHORS[TEMP_ANCHORS.length - 1].temp) {
    baseColor = hexToRgb(TEMP_ANCHORS[TEMP_ANCHORS.length - 1].hex)!;
  } else {
    let lower = TEMP_ANCHORS[0];
    let upper = TEMP_ANCHORS[1];
    for (let i = 0; i < TEMP_ANCHORS.length - 1; i++) {
      if (t >= TEMP_ANCHORS[i].temp && t <= TEMP_ANCHORS[i + 1].temp) {
        lower = TEMP_ANCHORS[i];
        upper = TEMP_ANCHORS[i + 1];
        break;
      }
    }
    const factor = (t - lower.temp) / (upper.temp - lower.temp);
    const c1 = hexToRgb(lower.hex)!;
    const c2 = hexToRgb(upper.hex)!;
    baseColor = {
      r: Math.round(c1.r + (c2.r - c1.r) * factor),
      g: Math.round(c1.g + (c2.g - c1.g) * factor),
      b: Math.round(c1.b + (c2.b - c1.b) * factor),
    };
  }

  const hex = rgbToHex(baseColor.r, baseColor.g, baseColor.b);
  const rgbStr = `${baseColor.r},${baseColor.g},${baseColor.b}`;

  // 3. Dynamic intensity logic
  const isDimValue = t < 2000;
  const glowOpacity = isDimValue ? 0.4 : 1.0;

  const bloomBaseOpacity = 0.55 * glowOpacity;
  const coronaBaseOpacity = 0.9 * glowOpacity;

  // 4. Transform colors for "scifi core" pop
  // Ensure the core and inner corona are intensely bright (closer to white) 
  // to give the star an energetic, powerful feel, just like the hardcoded palettes had.
  const coreRGB = blendWithWhite(baseColor.r, baseColor.g, baseColor.b, 0.9);
  const limbRGB = blendWithWhite(baseColor.r, baseColor.g, baseColor.b, 0.3);
  const coronaInnerRGB = blendWithWhite(baseColor.r, baseColor.g, baseColor.b, 0.85);

  return {
    core: rgbToHex(coreRGB.r, coreRGB.g, coreRGB.b),
    limb: rgbToHex(limbRGB.r, limbRGB.g, limbRGB.b),
    bloom: [
      `rgba(${rgbStr}, ${bloomBaseOpacity})`,
      `rgba(${rgbStr}, ${bloomBaseOpacity * 0.3})`,
      `rgba(${rgbStr}, ${bloomBaseOpacity * 0.08})`,
    ],
    corona: [
      `rgba(${coronaInnerRGB.r}, ${coronaInnerRGB.g}, ${coronaInnerRGB.b}, ${coronaBaseOpacity})`,
      `rgba(${rgbStr}, ${coronaBaseOpacity * 0.15})`,
    ],
    companionHue: `rgba(${rgbStr},`,
    glowOpacity,
  };
}

/**
 * Companion star positions defined in polar coords relative to the host star center.
 *   angleDeg      – angle from star center (0° = right, 90° = down)
 *   orbitFraction – distance as a fraction of the orbit's semi-major axis.
 *                   < 1.0  → inside the orbital ellipse
 *                   > 1.0  → just outside, but still hugging the system
 * baseRadius      – companion disc size in logical pixels (smaller than the host)
 */
const COMPANION_SEEDS: Array<{
  angleDeg: number;
  orbitFraction: number;
  baseRadius: number;
  pulseSpeed: number;
  pulseOffset: number;
  tempOffset: number; // For randomized companion color
}> = [
    // Inside the ellipse – upper-left quadrant of the orbital region
    { angleDeg: 210, orbitFraction: 0.45, baseRadius: 11, pulseSpeed: 0.75, pulseOffset: 0.0, tempOffset: -500 },
    // Inside the ellipse – lower-right area near the host
    { angleDeg: 40, orbitFraction: 0.55, baseRadius: 8, pulseSpeed: 1.10, pulseOffset: 1.8, tempOffset: 800 },
    // Just outside the ellipse – upper-right
    { angleDeg: 320, orbitFraction: 1.1, baseRadius: 13, pulseSpeed: 0.60, pulseOffset: 3.2, tempOffset: -200 },
    // Just outside the ellipse – lower-left
    { angleDeg: 140, orbitFraction: 1.2, baseRadius: 9, pulseSpeed: 1.35, pulseOffset: 0.9, tempOffset: 1200 },
  ];

interface OrbitVisualizerProps {
  /** Star effective temperature in Kelvin (drives color palette). Defaults to 5800 (Sun-like). */
  starTempK?: number;
  /** Total stars in the system (1 host + N-1 companions). Defaults to 1. */
  numStars?: number;
  /** Planet physical classification. Defaults to "Solid". */
  planetType?: "Solid" | "Gas";
  /** Planet equilibrium temperature in Kelvin (drives surface texture). Defaults to 300. */
  planetTempK?: number;
  /** Whether the planet is in the habitable zone (renders oceans/atmosphere on solid planets). */
  isHabitable?: boolean;
}

export function OrbitVisualizer({
  starTempK = 5800,
  numStars = 1,
  planetType = "Solid",
  planetTempK = 300,
  isHabitable = false,
}: OrbitVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const palette = getStarPalette(starTempK);
    const numCompanions = Math.max(0, numStars - 1);

    // Predetermine palettes for companions once
    const companionPalettes = COMPANION_SEEDS.map(seed =>
      getStarPalette(starTempK + seed.tempOffset)
    );

    // ── Offscreen star-field canvas (drawn once, blit every frame) ────────────
    const starCanvas = document.createElement("canvas");
    const starCtx = starCanvas.getContext("2d", { alpha: false });

    const updateSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const pr = window.devicePixelRatio || 1;

      canvas.width = rect.width * pr;
      canvas.height = rect.height * pr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      if (starCtx) {
        starCanvas.width = canvas.width;
        starCanvas.height = canvas.height;
        starCtx.fillStyle = "#000000";
        starCtx.fillRect(0, 0, starCanvas.width, starCanvas.height);

        // Tiny noise stars — density proportional to canvas area
        const numNoise = Math.floor((canvas.width * canvas.height) / 1000);
        for (let i = 0; i < numNoise; i++) {
          const x = Math.random() * starCanvas.width;
          const y = Math.random() * starCanvas.height;
          const size = Math.random() * 0.8 + 0.2;
          const bright = Math.random() > 0.98;

          starCtx.globalAlpha = bright
            ? Math.random() * 0.5 + 0.5
            : Math.random() * 0.3 + 0.1;

          starCtx.beginPath();
          starCtx.arc(x, y, size, 0, Math.PI * 2);
          starCtx.fillStyle = `hsl(210, ${bright ? 80 : 20}%, ${bright ? 90 : 70}%)`;
          starCtx.fill();
        }
        starCtx.globalAlpha = 1;
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
    updateSize();

    // ── Layout helpers ────────────────────────────────────────────────────────
    const getCenter = () => ({ x: canvas.width * 0.7, y: canvas.height / 2 });

    const getOrbitParams = () => {
      const baseR = Math.min(canvas.width * 0.32, 700);
      return { baseRadiusX: baseR, baseRadiusY: baseR * 0.25 };
    };

    const getDPR = () => window.devicePixelRatio || 1;

    // ── Animation state ───────────────────────────────────────────────────────
    let angle = Math.PI * 0.2;
    const speed = 0.003;
    let time = 0; // seconds-like counter for pulse

    // ── Draw: background blit ─────────────────────────────────────────────────
    const drawBackground = () => {
      if (starCanvas.width > 0 && starCanvas.height > 0) {
        ctx.drawImage(starCanvas, 0, 0);
      } else {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    // ── Draw: orbit ellipse ───────────────────────────────────────────────────
    const drawOrbit = () => {
      const { x: cx, y: cy } = getCenter();
      const { baseRadiusX, baseRadiusY } = getOrbitParams();
      const pr = getDPR();

      ctx.lineWidth = 1 * pr;
      ctx.beginPath();
      ctx.ellipse(cx, cy, baseRadiusX, baseRadiusY, 0, 0, Math.PI * 2);

      const grad = ctx.createLinearGradient(cx, cy - baseRadiusY, cx, cy + baseRadiusY);
      grad.addColorStop(0, "rgba(255,255,255,0.05)");
      grad.addColorStop(0.5, "rgba(255,255,255,0.10)");
      grad.addColorStop(1, "rgba(255,255,255,0.20)");

      ctx.strokeStyle = grad;
      ctx.stroke();
    };

    // ── Draw: main host star ──────────────────────────────────────────────────
    const drawStar = () => {
      const { x: cx, y: cy } = getCenter();
      const pr = getDPR();
      const starRadius = 85 * pr;

      ctx.globalCompositeOperation = "screen";

      // 1. Wide outer bloom — hue-colored
      const bloomRadius = starRadius * 12;
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomRadius);
      bloom.addColorStop(0, palette.bloom[0]);
      bloom.addColorStop(0.15, palette.bloom[1]);
      bloom.addColorStop(0.5, palette.bloom[2]);
      bloom.addColorStop(1, "rgba(0,0,0,0)");

      ctx.beginPath();
      ctx.arc(cx, cy, bloomRadius, 0, Math.PI * 2);
      ctx.fillStyle = bloom;
      ctx.fill();

      // 2. Tight corona
      const coronaRadius = starRadius * 4;
      const corona = ctx.createRadialGradient(cx, cy, 0, cx, cy, coronaRadius);
      corona.addColorStop(0, palette.corona[0]);
      corona.addColorStop(0.4, palette.corona[1]);
      corona.addColorStop(1, "rgba(0,0,0,0)");

      ctx.beginPath();
      ctx.arc(cx, cy, coronaRadius, 0, Math.PI * 2);
      ctx.fillStyle = corona;
      ctx.fill();

      // 3. Solid disc — back to normal blending
      ctx.globalCompositeOperation = "source-over";

      const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, starRadius);
      body.addColorStop(0, palette.core);
      body.addColorStop(0.6, palette.core);
      body.addColorStop(0.9, palette.limb);
      body.addColorStop(1, darkenHex(palette.limb, 30));

      ctx.beginPath();
      ctx.arc(cx, cy, starRadius, 0, Math.PI * 2);
      ctx.fillStyle = body;
      ctx.fill();
    };

    // ── Draw: companion stars (pulse-animated) ────────────────────────────────
    /**
     * Each companion is a small glowing dot with a radial-gradient halo.
     * Pulse: radius and halo-alpha vary sinusoidally so they "breathe".
     * They are placed well outside the orbital ellipse footprint.
     */
    const drawCompanionStars = () => {
      const pr = getDPR();
      // Resolve the star center and orbit dimensions each frame so companions
      // stay anchored to the central star even if the canvas resizes.
      const { x: cx, y: cy } = getCenter();
      const { baseRadiusX, baseRadiusY } = getOrbitParams();

      ctx.globalCompositeOperation = "screen";

      for (let i = 0; i < numCompanions; i++) {
        const seed = COMPANION_SEEDS[i];
        if (!seed) continue;

        const compPalette = companionPalettes[i];

        // Convert polar offset to canvas pixel position.
        // We use the orbit ellipse axes so companions respect the 3-D tilt.
        const rad = (seed.angleDeg * Math.PI) / 180;
        const x = cx + Math.cos(rad) * baseRadiusX * seed.orbitFraction;
        const y = cy + Math.sin(rad) * baseRadiusY * seed.orbitFraction;

        // Pulse: sinusoidal oscillation around baseRadius
        const pulse = Math.sin(time * seed.pulseSpeed + seed.pulseOffset);
        const radius = (seed.baseRadius + pulse * 3) * pr;
        const haloAlpha = (0.45 + pulse * 0.15) * compPalette.glowOpacity;
        const coreAlpha = 0.55 + pulse * 0.10;

        // Halo gradient
        const haloRadius = radius * 6;
        const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
        halo.addColorStop(0, compPalette.companionHue + `${coreAlpha})`);
        halo.addColorStop(0.3, compPalette.companionHue + `${haloAlpha * 0.6})`);
        halo.addColorStop(0.7, compPalette.companionHue + `${haloAlpha * 0.15})`);
        halo.addColorStop(1, "rgba(0,0,0,0)");

        ctx.beginPath();
        ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        // Solid disc (tiny)
        ctx.globalCompositeOperation = "source-over";
        const disc = ctx.createRadialGradient(x, y, 0, x, y, radius);
        disc.addColorStop(0, compPalette.core);
        disc.addColorStop(1, compPalette.limb);

        ctx.globalAlpha = 0.7; // companions are semi-transparent
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = disc;
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.globalCompositeOperation = "screen";
      }

      ctx.globalCompositeOperation = "source-over";
    };

    // ── Draw: planet with procedural textures ─────────────────────────────────
    const drawPlanet = (x: number, y: number, depth: number) => {
      const { x: cx, y: cy } = getCenter();
      const pr = getDPR();

      // Scale radius based on gas giants vs solid
      const baseR = (planetType === "Gas" ? 22 : 14) * pr;

      const scale = 1 + depth * 0.4;
      const radius = baseR * scale;

      const dx = cx - x;
      const dy = cy - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / dist;
      const uy = dy / dist;

      // Classify the texture style
      const texType = planetType === "Gas"
        ? (planetTempK > 800 ? "puffy_jupiter" : "ice_gas")
        : (planetTempK > 900 ? "lava_rock" : (isHabitable ? "earth_like" : "barren_rock"));

      // Set up clipping mask for the sphere surface
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();

      // 1. Base Texture layer
      if (texType === "ice_gas") {
        ctx.fillStyle = "#8fbfff";
        ctx.fill();
        const bandGrad = ctx.createLinearGradient(x, y - radius, x, y + radius);
        bandGrad.addColorStop(0, "rgba(255,255,255,0.6)");
        bandGrad.addColorStop(0.2, "rgba(255,255,255,0)");
        bandGrad.addColorStop(0.4, "rgba(180,220,255,0.7)");
        bandGrad.addColorStop(0.6, "rgba(255,255,255,0.1)");
        bandGrad.addColorStop(0.8, "rgba(150,200,255,0.5)");
        bandGrad.addColorStop(1, "rgba(255,255,255,0.5)");
        ctx.fillStyle = bandGrad;
        ctx.fill();
      } else if (texType === "puffy_jupiter") {
        ctx.fillStyle = "#d4976a"; // Base dusty orange
        ctx.fill();
        const bandGrad = ctx.createLinearGradient(x, y - radius, x, y + radius);
        bandGrad.addColorStop(0.0, "rgba(100,50,20,0.4)");
        bandGrad.addColorStop(0.15, "rgba(255,200,150,0.5)");
        bandGrad.addColorStop(0.35, "rgba(100,50,20,0)");
        bandGrad.addColorStop(0.5, "rgba(180,90,40,0.6)");
        bandGrad.addColorStop(0.65, "rgba(255,200,150,0.3)");
        bandGrad.addColorStop(0.85, "rgba(100,50,20,0.5)");
        bandGrad.addColorStop(1.0, "rgba(180,90,40,0.2)");
        ctx.fillStyle = bandGrad;
        ctx.fill();
      } else if (texType === "lava_rock") {
        ctx.fillStyle = "#1a0f0a"; // Dark crust
        ctx.fill();
        const magmaGrad = ctx.createRadialGradient(x - radius * 0.2, y + radius * 0.3, 0, x, y, radius * 1.2);
        magmaGrad.addColorStop(0, "rgba(255,80,0,0.9)");
        magmaGrad.addColorStop(0.3, "rgba(200,20,0,0.5)");
        magmaGrad.addColorStop(0.7, "rgba(0,0,0,0.8)");
        magmaGrad.addColorStop(1, "#1a0f0a");
        ctx.fillStyle = magmaGrad;
        ctx.fill();
      } else if (texType === "barren_rock") {
        // Frosty/icy base for cold worlds, gray/brown for generic barren
        ctx.fillStyle = planetTempK < 200 ? "#b0c4de" : "#8c8273";
        ctx.fill();
        // Craters and rough surface texture mapping
        const craterGrad = ctx.createRadialGradient(x - radius * 0.2, y + radius * 0.1, 0, x, y, radius);
        craterGrad.addColorStop(0, "rgba(50, 45, 40, 0.4)");
        craterGrad.addColorStop(0.3, "rgba(120, 110, 100, 0.2)");
        craterGrad.addColorStop(0.7, "rgba(40, 35, 30, 0.6)");
        craterGrad.addColorStop(1, "rgba(20, 15, 10, 0.8)");
        ctx.fillStyle = craterGrad;
        ctx.fill();
      } else {
        // earth_like (habitable rocky)
        ctx.fillStyle = "#2b5c8f"; // Ocean base blue
        ctx.fill();
        const landGrad = ctx.createRadialGradient(x + radius * 0.1, y - radius * 0.1, radius * 0.1, x, y, radius * 0.9);
        landGrad.addColorStop(0, "rgba(60,140,80,0.9)"); // Green land
        landGrad.addColorStop(0.5, "rgba(120,100,60,0.5)"); // Brownish edge
        landGrad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = landGrad;
        ctx.fill();
        // Ice caps
        const capGrad = ctx.createLinearGradient(x, y - radius, x, y + radius);
        capGrad.addColorStop(0, "rgba(255,255,255,0.95)");
        capGrad.addColorStop(0.15, "rgba(255,255,255,0)");
        capGrad.addColorStop(0.85, "rgba(255,255,255,0)");
        capGrad.addColorStop(1, "rgba(255,255,255,0.95)");
        ctx.fillStyle = capGrad;
        ctx.fill();
      }

      // 2. Volumetric Lighting & Shadow
      // Simulates the host star's light scattering across the spherical surface.
      const intensity = 0.65 - depth * 0.35;
      const lightGrad = ctx.createRadialGradient(
        x + ux * radius * 0.85, y + uy * radius * 0.85, 0,
        x, y, radius * 1.4
      );
      lightGrad.addColorStop(0, `rgba(255,255,255,${intensity})`);
      lightGrad.addColorStop(0.4, "rgba(0,0,0,0.1)");
      lightGrad.addColorStop(0.7, "rgba(0,0,0,0.85)");
      lightGrad.addColorStop(1, "rgba(0,0,0,1)");

      ctx.fillStyle = lightGrad;
      ctx.fill();

      ctx.restore(); // Remove clipping mask

      // 3. Atmosphere layer (Outside the solid body)
      if (texType === "earth_like" || planetType === "Gas") {
        ctx.beginPath();
        const atmosSize = planetType === "Gas" ? 1.08 : 1.15; // Gas giants have thinner relative visual atmospheres
        ctx.arc(x, y, radius * atmosSize, 0, Math.PI * 2);
        const atmosColor = texType === "earth_like" ? "100,180,255" : (texType === "ice_gas" ? "150,220,255" : "255,180,120");
        const atmosGrad = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius * atmosSize);
        atmosGrad.addColorStop(0, `rgba(${atmosColor},0)`);
        atmosGrad.addColorStop(0.85, `rgba(${atmosColor},0.25)`);
        atmosGrad.addColorStop(1, `rgba(${atmosColor},0)`);
        ctx.fillStyle = atmosGrad;
        ctx.fill();
      }
    };

    // ── Main animation loop ───────────────────────────────────────────────────
    const animate = () => {
      if (canvas.width === 0 || canvas.height === 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      drawBackground();

      // Companions drawn first — they live in "background space"
      drawCompanionStars();

      drawOrbit();

      const { x: cx, y: cy } = getCenter();
      const { baseRadiusX, baseRadiusY } = getOrbitParams();
      const px = cx + Math.cos(angle) * baseRadiusX;
      const py = cy + Math.sin(angle) * baseRadiusY;
      const depth = Math.sin(angle); // -1 (behind) → +1 (front)

      // Z-sort: planet vs host star
      if (depth < 0) {
        drawPlanet(px, py, depth);
        drawStar();
      } else {
        drawStar();
        drawPlanet(px, py, depth);
      }

      angle -= speed;
      time += 0.016; // ~60fps increment
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      resizeObserver.disconnect();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
    // Re-run whenever the data-driven props change (different system / planet selected)
  }, [starTempK, numStars, planetType, planetTempK, isHabitable]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />

      {/* Subtle left-edge vignette so the info panel doesn't feel harsh */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 70% 50%, transparent 20%, rgba(0,0,0,0.4) 100%)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Blend an RGB color heavily with white (factor 0-1) to create an intense core highlight. */
function blendWithWhite(r: number, g: number, b: number, factor: number) {
  return {
    r: Math.round(r + (255 - r) * factor),
    g: Math.round(g + (255 - g) * factor),
    b: Math.round(b + (255 - b) * factor),
  };
}

/** Darken a hex color by `percent` (0-100). Returns a hex string. */
function darkenHex(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const factor = 1 - percent / 100;
  const r = Math.round(rgb.r * factor);
  const g = Math.round(rgb.g * factor);
  const b = Math.round(rgb.b * factor);
  return rgbToHex(r, g, b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
