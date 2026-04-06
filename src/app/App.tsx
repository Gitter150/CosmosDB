import { PlanetInfo } from "./components/PlanetInfo";
import { OrbitVisualizer } from "./components/OrbitVisualizer";

export default function App() {
  // Mock exoplanet data - this would come from a database in a real application
  // Mock planet data — will be replaced by API response from FastAPI
  const planetData = {
    name: "Kepler-452b",
    hostStar: "Kepler-452",
    description: "One of the most potentially habitable exoplanets discovered. Kepler-452b is a super-Earth exoplanet orbiting within the inner edge of the habitable zone of the sun-like star Kepler-452.",
    starType: "G2V (Main Sequence)",
    planetType: "Rocky (Super-Earth)",
    mass: "5.0 M⊕",
    radius: "1.6 R⊕",
    orbitalPeriod: "384.8 days",
    distance: "1,402 light-years",
    temperature: "265 K (-8°C)",
    discoveryYear: "2015",
    discoveryMethod: "Transit",
  };

  return (
    <div className="size-full bg-black relative overflow-hidden">
      {/* Background Visualization - Spans whole width */}
      <div className="absolute inset-0 z-0">
        {/* Star color and num_stars are configured via constants in OrbitVisualizer.tsx */}
        <OrbitVisualizer />
      </div>

      {/* Content Overlay */}
      <div className="relative z-10 w-full h-full flex pointer-events-none">
        {/* Left Panel - Planet Information */}
        <div className="w-1/2 h-full flex items-center justify-start p-12">
          <div className="pointer-events-auto">
            <PlanetInfo planetData={planetData} />
          </div>
        </div>
        
        {/* Right side is empty to let the star shine through */}
        <div className="w-1/2 h-full" />
      </div>
    </div>
  );
}