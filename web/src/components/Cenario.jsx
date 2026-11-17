export function Nuvens() {
  return (
    <div className="nuvens" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <svg key={i} className={`nuvem n${i}`} viewBox="0 0 120 50" focusable="false">
          <path d="M20 44a16 16 0 0 1 2-32 22 22 0 0 1 42-4 18 18 0 0 1 34 10 14 14 0 0 1 2 26z" fill="#fff" stroke="#012B58" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  )
}

export function Skyline() {
  const pr = [
    [10, 70, 60, '#039882'], [80, 40, 50, '#012B58'], [140, 85, 56, '#FB6702'], [206, 55, 64, '#039882'], [280, 95, 52, '#012B58'],
    [342, 50, 60, '#FB6702'], [412, 75, 58, '#039882'], [480, 35, 56, '#012B58'], [546, 80, 60, '#FB6702'], [616, 60, 54, '#039882'], [680, 90, 56, '#012B58'], [746, 45, 50, '#FB6702'],
  ]
  return (
    <svg className="skyline" viewBox="0 0 800 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {pr.map(([x, y, w, c], i) => (
        <g key={i}>
          <rect x={x} y={y + 20} width={w} height={120 - y} rx="6" fill={c} stroke="#012B58" strokeWidth="3" />
          {[0, 1, 2].map((r) => [0, 1].map((k) => (
            <rect key={r + '-' + k} className="janela" style={{ animationDelay: `${((i * 7 + r * 3 + k * 5) % 11) * 0.45}s` }} x={x + 10 + k * (w / 2 - 6)} y={y + 32 + r * 20} width={w / 2 - 14} height="11" rx="3" fill="#fff6c8" stroke="#012B58" strokeWidth="2" />
          )))}
        </g>
      ))}
      <rect x="0" y="128" width="800" height="12" fill="#012B58" />
    </svg>
  )
}
