// Ilustração do bairro: pinos acendem (laranja -> verde) e o robô percorre a rota.
// Decorativa (aria-hidden); respeita prefers-reduced-motion via CSS.
export default function Hero() {
  const pinos = [
    { x: 120, y: 150, d: 0 }, { x: 260, y: 90, d: 1.2 }, { x: 400, y: 170, d: 2.4 }, { x: 520, y: 100, d: 3.6 }, { x: 330, y: 260, d: 4.8 },
  ]
  return (
    <svg className="hero-svg" viewBox="0 0 640 340" aria-hidden="true" focusable="false">
      <rect width="640" height="340" rx="14" fill="#fffdf6" />
      <g stroke="#012B58" strokeWidth="2" fill="none" opacity=".25">
        <path d="M0 210 H640 M0 120 H640 M180 0 V340 M450 0 V340" />
      </g>
      <g fill="#012B58" opacity=".1">
        <rect x="20" y="20" width="140" height="80" rx="4" /><rect x="200" y="20" width="230" height="80" rx="4" />
        <rect x="470" y="20" width="150" height="80" rx="4" /><rect x="20" y="140" width="140" height="55" rx="4" />
        <rect x="200" y="140" width="230" height="55" rx="4" /><rect x="470" y="140" width="150" height="55" rx="4" />
        <rect x="20" y="230" width="140" height="90" rx="4" /><rect x="200" y="230" width="230" height="90" rx="4" /><rect x="470" y="230" width="150" height="90" rx="4" />
      </g>
      <path id="rota" d="M120 150 L260 90 L400 170 L520 100 L330 260 Z" fill="none" stroke="#039882" strokeWidth="3" strokeDasharray="7 7" />
      {pinos.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`}>
          <circle r="11" className="pino" style={{ animationDelay: `${p.d}s` }} />
          <circle r="4" fill="#fff" />
        </g>
      ))}
      <g className="robo-sv">
        <animateMotion dur="14s" repeatCount="indefinite" rotate="0"><mpath href="#rota" /></animateMotion>
        <rect x="-13" y="-12" width="26" height="22" rx="5" fill="#012B58" />
        <rect x="-8" y="-7" width="16" height="7" rx="2" fill="#fff" />
        <circle cx="-4" cy="-3.5" r="1.8" fill="#039882" /><circle cx="4" cy="-3.5" r="1.8" fill="#039882" />
        <rect x="-1" y="-19" width="2" height="7" fill="#012B58" /><circle cy="-20" r="2.6" fill="#FB6702" />
      </g>
    </svg>
  )
}
