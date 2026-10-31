import { compactMoney } from '../lib/format.js';

function niceCeiling(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value);
  return step * magnitude;
}

// Revenue as a step line: billing happens in periods, so each month holds flat until the next.
// The plot stretches to any width at a fixed height; labels are HTML so they never scale.
export function StepChart({ points, height = 240, formatValue = compactMoney, label }) {
  const ceiling = niceCeiling(Math.max(...points.map((point) => point.value), 0));
  const y = (value) => 100 - (value / ceiling) * 100;
  const x = (index) => (index / points.length) * 1000;
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)} H${x(index + 1)}`).join(' ');
  const last = points.at(-1);

  return (
    <figure role="img" aria-label={label} className="m-0">
      <div className="relative pr-16" style={{ height }}>
        <div className="relative h-full">
          {[1, 0.5, 0].map((fraction) => (
            <div key={fraction} className={`absolute inset-x-0 border-t ${fraction === 0 ? 'border-ink' : 'border-line'}`} style={{ top: `${y(ceiling * fraction)}%` }}>
              <span className="absolute -top-2.5 -right-16 w-14 text-caption tabular-nums text-mute">{formatValue(ceiling * fraction)}</span>
            </div>
          ))}
          <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="animate-reveal absolute inset-0 h-full w-full overflow-visible">
            <path d={`${path} V100 H0 Z`} fill="#714b67" opacity="0.07" />
            <path d={path} fill="none" stroke="#714b67" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </svg>
          {last && <span aria-hidden className="absolute -mt-[5px] -mr-[5px] size-2.5 bg-plum" style={{ right: 0, top: `${y(last.value)}%` }} />}
        </div>
      </div>
      <div className="mt-2 grid pr-16" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point, index) => (
          <span key={point.key} className={`truncate text-caption ${index === points.length - 1 ? 'font-semibold text-ink' : 'text-faint'}`}>{point.label}</span>
        ))}
      </div>
    </figure>
  );
}
