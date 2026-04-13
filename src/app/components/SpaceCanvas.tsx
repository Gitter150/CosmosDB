import { useEffect, useRef } from "react";

/**
 * SpaceCanvas — a fixed-position canvas that renders slowly blinking star dots.
 * 10% of dots are coloured (Red #ff4d4d, Yellow #ffd700) to simulate
 * the ethereal glow of Milky Way arms.
 */
export default function SpaceCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let stars: Star[] = [];

    interface Star {
      x: number;
      y: number;
      r: number;
      baseAlpha: number;
      blinkSpeed: number;
      blinkOffset: number;
      color: string;
    }

    const resize = () => {
      const pr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * pr;
      canvas.height = window.innerHeight * pr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      generate();
    };

    const generate = () => {
      const count = Math.floor((canvas.width * canvas.height) / 2200);
      stars = [];
      for (let i = 0; i < count; i++) {
        const rand = Math.random();
        let color = "rgba(255,255,255,";
        // 5% red, 5% yellow, 90% white
        if (rand < 0.05) color = "rgba(255,77,77,";       // #ff4d4d
        else if (rand < 0.10) color = "rgba(255,215,0,";  // #ffd700

        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.2 + 0.3,
          baseAlpha: Math.random() * 0.4 + 0.15,
          blinkSpeed: Math.random() * 0.003 + 0.001,
          blinkOffset: Math.random() * Math.PI * 2,
          color,
        });
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const alpha =
          s.baseAlpha +
          Math.sin(t * s.blinkSpeed + s.blinkOffset) * s.baseAlpha * 0.6;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color + `${Math.max(0, alpha)})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };

    resize();
    animId = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ background: "#000" }}
    />
  );
}
