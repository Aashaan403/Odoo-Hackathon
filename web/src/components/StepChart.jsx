import { compactMoney } from '../lib/format.js';

function niceCeiling(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value);
  return step * magnitude;
}

// Revenue as a step line: billing happens in periods, so each month holds flat until the next.
export function StepChart({ points, height = 240, formatValue = compactMoney, label }) {
  const width = 960;
  const top = 18;
  const bottom = 30;
  const right = 64;
  const ceiling = niceCeiling(Math.max(...points.map((point) => point.value), 0));
  const x = (index) => (index / points.length) * (width - right);
  const y = (value) => top + (1 - value / ceiling) * (height - top - bottom);
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)} H${x(index + 1)}`).join(' ');
  const area = `${path} V${y(0)} H${x(0)} Z`;
  const last = points.at(-1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block h-auto w-full overflow-visible">
      {[0, 0.5, 1].map((fraction) => (
        <g key={fraction}>
          <line x1="0" x2={width - right} y1={y(ceiling * fraction)} y2={y(ceiling * fraction)} stroke={fraction === 0 ? '#0e0e0e' : '#e5e2e4'} strokeWidth="1" />
          <text x={width - right + 12} y={y(ceiling * fraction) + 4} fontSize="12" fill="#6e696d" className="tabular-nums">{formatValue(ceiling * fraction)}</text>
        </g>
      ))}
      <path d={area} fill="#714b67" opacity="0.06" />
      <path d={path} fill="none" stroke="#714b67" strokeWidth="2.5" strokeLinejoin="miter" pathLength="1" strokeDasharray="1" className="animate-draw" />
      {last && <rect x={x(points.length) - 5} y={y(last.value) - 5} width="10" height="10" fill="#714b67" />}
      {points.map((point, index) => (
        <text key={point.key} x={x(index) + 2} y={height - 8} fontSize="12" fill={index === points.length - 1 ? '#0e0e0e' : '#a7a1a5'} fontWeight={index === points.length - 1 ? 600 : 400}>{point.label}</text>
      ))}
    </svg>
  );
}
