import { useNavigate } from "react-router";
import SpaceCanvas from "../components/SpaceCanvas";

const sections = [
  {
    title: "The Search for Other Worlds",
    text: `For millennia, humanity gazed upward with a single, burning question: are we alone? 
The first confirmed exoplanet detection in 1992 irrevocably answered the first half — other worlds 
exist. Since then, missions like Kepler, TESS, and ground-based radial velocity surveys have 
catalogued thousands of alien worlds, each one a data point in the universe's grandest census. 
Every discovery rewrites what we thought possible: lava oceans, diamond cores, atmospheres of 
vaporised iron, and — perhaps — the faint chemical signature of life itself.`,
  },
  {
    title: "Architecture of Star Systems",
    text: `A star system is not merely a star with orbiting debris. It is a gravitational symphony. 
Binary and trinary stellar configurations create complex resonance zones where stable orbits 
become islands of calm in a sea of tidal chaos. Hot Jupiters spiral inward, sculpting the fate 
of their rocky siblings. Resonant chains — like the seven-planet TRAPPIST-1 system — lock 
worlds into a delicate gravitational dance where the perturbation of one ripples through all. 
Understanding these architectures is key to predicting where habitable worlds might endure.`,
  },
  {
    title: "The Earth Similarity Index",
    text: `The ESI distils the question "how Earth-like is this world?" into a single number between 
0 and 1. It compares a planet's radius, density, escape velocity, and surface temperature against 
Earth's values using weighted geometric means. But a raw score alone is insufficient — a scorching 
planet at 0.02 AU might score well on size but fail on habitability. Our implementation applies a 
Goldilocks penalty: planets outside the host star's liquid-water habitable zone see their ESI 
slashed by 90%, because similarity without habitability is a mirage.`,
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white relative">
      <SpaceCanvas />

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          {/* Decorative line */}
          <div className="w-12 h-[1px] bg-amber-400/30 mx-auto mb-8" />

          <blockquote className="text-[28px] sm:text-[36px] md:text-[42px] font-extralight leading-[1.35] tracking-wide text-white/90">
            <span className="text-white/50">"</span>
            Either we are alone in the universe or we are not. Both are equally
            terrifying.
            <span className="text-white/50">"</span>
          </blockquote>

          <p className="mt-6 text-[13px] tracking-[0.3em] text-white/25 uppercase">
            — Arthur C. Clarke
          </p>

          {/* CTA */}
          <button
            onClick={() => navigate("/observatory")}
            className="mt-14 px-8 py-3 rounded-full text-[13px] tracking-widest uppercase border border-amber-400/20 text-amber-400/80 hover:bg-amber-400/[0.08] hover:border-amber-400/40 hover:text-amber-400 transition-all duration-500 cursor-pointer group"
            id="enter-observatory-btn"
          >
            Enter the Observatory
            <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform duration-300">
              →
            </span>
          </button>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-[10px] tracking-[0.2em] text-white/20 uppercase">
            Scroll
          </span>
          <div className="w-[1px] h-6 bg-gradient-to-b from-white/20 to-transparent" />
        </div>
      </section>

      {/* Scrolling Content Sections */}
      <div className="relative z-10">
        {sections.map((section, i) => (
          <section
            key={i}
            className="max-w-2xl mx-auto px-6 py-28"
            id={`home-section-${i}`}
          >
            {/* Section number */}
            <span className="text-[11px] tracking-[0.3em] text-amber-400/30 uppercase mb-4 block">
              {String(i + 1).padStart(2, "0")}
            </span>

            <h2 className="text-[22px] sm:text-[26px] font-light tracking-wide text-white/85 mb-6">
              {section.title}
            </h2>

            <div className="w-8 h-[1px] bg-white/10 mb-6" />

            <p className="text-[15px] leading-[1.85] text-white/50 font-light whitespace-pre-line">
              {section.text}
            </p>
          </section>
        ))}

        {/* Bottom CTA */}
        <div className="text-center pb-28">
          <button
            onClick={() => navigate("/observatory")}
            className="px-8 py-3 rounded-full text-[13px] tracking-widest uppercase border border-white/[0.08] text-white/40 hover:text-amber-400/80 hover:border-amber-400/20 transition-all duration-500 cursor-pointer"
            id="bottom-observatory-btn"
          >
            Explore Planets →
          </button>
        </div>
      </div>
    </div>
  );
}
