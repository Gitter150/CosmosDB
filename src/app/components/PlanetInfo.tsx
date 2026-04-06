
interface PlanetInfoProps {
  planetData: {
    name: string;
    hostStar: string;
    description?: string;
    starType: string;
    planetType: string;
    mass: string;
    radius: string;
    orbitalPeriod: string;
    distance: string;
    temperature: string;
    discoveryYear: string;
    discoveryMethod: string;
  };
}

export function PlanetInfo({ planetData }: PlanetInfoProps) {
  return (
    <div className="flex flex-col h-full justify-center pl-16 md:pl-24 max-w-2xl font-sans text-white relative">
      <div className="flex flex-col gap-10 w-full">
        {/* Header */}
        <div>
          <h1 className="text-5xl font-light tracking-wide mb-2 text-white/95">
            {planetData.name}
          </h1>
          <p className="text-white/70 text-lg font-light tracking-wide">
            Orbiting {planetData.hostStar}
          </p>
        </div>

        {/* Description */}
        <div className="text-white/80 text-[15px] leading-relaxed font-light">
          {planetData.description || 
            `A ${planetData.planetType} exoplanet orbiting the star ${planetData.hostStar}. It is located approximately ${planetData.distance} away.`}
        </div>

        {/* Data Grid */}
        <div className="flex gap-8 md:gap-16">
          {/* Left Column */}
          <div className="flex-1 flex flex-col gap-6 border-l border-white/20 pl-5">
            <div>
              <div className="text-white/40 text-[13px] mb-1">Mass</div>
              <div className="text-white/90 text-[16px] tracking-wide">{planetData.mass}</div>
            </div>
            <div>
              <div className="text-white/40 text-[13px] mb-1">Orbital Period</div>
              <div className="text-white/90 text-[16px] tracking-wide">{planetData.orbitalPeriod}</div>
            </div>
            <div>
              <div className="text-white/40 text-[13px] mb-1">Temperature</div>
              <div className="text-white/90 text-[16px] tracking-wide">{planetData.temperature}</div>
            </div>
          </div>

          {/* Right Column */}
          <div className="flex-1 flex flex-col gap-6 border-l border-white/20 pl-5">
            <div>
              <div className="text-white/40 text-[13px] mb-1">Radius</div>
              <div className="text-white/90 text-[16px] tracking-wide">{planetData.radius}</div>
            </div>
            <div>
              <div className="text-white/40 text-[13px] mb-1">Distance</div>
              <div className="text-white/90 text-[16px] tracking-wide">{planetData.distance}</div>
            </div>
            <div>
              <div className="text-white/40 text-[13px] mb-1">Type</div>
              <div className="text-white/90 text-[16px] tracking-wide">{planetData.planetType}</div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-2 pt-6 border-t border-white/10 flex gap-8 text-[13px]">
          <div className="flex gap-2">
            <span className="text-white/40">Discovered:</span>
            <span className="text-white/90">{planetData.discoveryYear}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-white/40">Method:</span>
            <span className="text-white/90">{planetData.discoveryMethod}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
