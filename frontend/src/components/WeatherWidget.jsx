import { Cloud, Sun, Droplets, Wind } from 'lucide-react';

export default function WeatherWidget() {
  // Mock weather data
  const weather = {
    temp: 34,
    condition: 'Sunny',
    humidity: 45,
    wind: 12,
    solarIrradiance: 820,
    uvIndex: 7,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 mb-1">Weather</p>
        <h3 className="text-sm font-extralight text-white/80 tracking-wide uppercase">
          Campus Conditions
        </h3>
      </div>

      <div className="flex-1 flex items-center justify-between gap-4">
        {/* Left: Temp + condition */}
        <div className="flex items-center gap-4">
          <div className="sun-icon">
            <Sun size={40} className="text-amber-400" strokeWidth={1} />
          </div>
          <div>
            <span className="text-4xl font-extralight text-white/90" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {weather.temp}°
            </span>
            <p className="text-[10px] tracking-[0.2em] uppercase text-white/40 mt-1">
              {weather.condition}
            </p>
          </div>
        </div>

        {/* Right: Details */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Droplets size={12} className="text-cyan-400/50" strokeWidth={1.5} />
            <span className="text-[10px] tracking-[0.1em] text-white/40">
              {weather.humidity}% humidity
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Wind size={12} className="text-white/30" strokeWidth={1.5} />
            <span className="text-[10px] tracking-[0.1em] text-white/40">
              {weather.wind} km/h
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Sun size={12} className="text-amber-400/50" strokeWidth={1.5} />
            <span className="text-[10px] tracking-[0.1em] text-white/40">
              {weather.solarIrradiance} W/m²
            </span>
          </div>
        </div>
      </div>

      {/* Solar irradiance bar */}
      <div className="mt-4 pt-3 border-t border-white/[0.05]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] tracking-[0.2em] uppercase text-white/30">Solar Irradiance</span>
          <span className="text-[9px] tracking-[0.1em] text-amber-400/60">{weather.solarIrradiance} W/m²</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${(weather.solarIrradiance / 1200) * 100}%`,
              background: 'linear-gradient(90deg, #ffb800, #ff8800)',
              transition: 'width 1.5s cubic-bezier(0.16,1,0.3,1)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
