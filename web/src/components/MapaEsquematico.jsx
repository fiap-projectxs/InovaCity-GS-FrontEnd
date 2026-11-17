import { useMemo } from 'react'

// Mapa esquemático: projeta as coordenadas num quadro SVG. Não é um mapa de ruas;
// serve para ver a distribuição dos relatos. Inclui alternativa em texto para leitores de tela.
const COR = { alta: '#FB6702', media: '#c9a100', baixa: '#039882' }

export default function MapaEsquematico({ ocorrencias, onEscolher, escolhida }) {
  const pts = useMemo(() => ocorrencias.filter((o) => o.coords), [ocorrencias])
  const g = useMemo(() => {
    if (!pts.length) return null
    const la = pts.map((p) => p.coords.lat), lo = pts.map((p) => p.coords.lng)
    const [a0, a1, o0, o1] = [Math.min(...la), Math.max(...la), Math.min(...lo), Math.max(...lo)]
    const dx = Math.max(o1 - o0, 0.002), dy = Math.max(a1 - a0, 0.002)
    return { a1, o0, dx, dy }
  }, [pts])

  if (!g) return <p className="vazio">Nenhuma ocorrência com localização para mostrar.</p>
  const X = (lng) => 30 + ((lng - g.o0) / g.dx) * 540
  const Y = (lat) => 30 + ((g.a1 - lat) / g.dy) * 340

  return (
    <figure className="mapa">
      <svg viewBox="0 0 600 400" role="img" aria-label={`Mapa esquemático com ${pts.length} ocorrências distribuídas pela região`}>
        <rect x="1" y="1" width="598" height="398" rx="10" className="mapa-fundo" />
        {[1, 2, 3].map((i) => <line key={'h' + i} x1="0" x2="600" y1={i * 100} y2={i * 100} className="mapa-grade" />)}
        {[1, 2, 3, 4, 5].map((i) => <line key={'v' + i} y1="0" y2="400" x1={i * 100} x2={i * 100} className="mapa-grade" />)}
        {pts.map((p) => (
          <circle key={p.id} cx={X(p.coords.lng)} cy={Y(p.coords.lat)} r={escolhida === p.id ? 10 : 6.5}
            fill={COR[p.prioridade] || COR.baixa} className={'ponto' + (p.status === 'resolvida' ? ' resolvido' : '')}
            tabIndex={onEscolher ? 0 : undefined} role={onEscolher ? 'button' : undefined}
            aria-label={`${p.titulo}, prioridade ${p.prioridade}`}
            onClick={onEscolher ? () => onEscolher(p.id) : undefined}
            onKeyDown={onEscolher ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEscolher(p.id) } } : undefined}>
            <title>{p.titulo}</title>
          </circle>
        ))}
      </svg>
      <figcaption>
        <span className="leg"><i style={{ background: COR.alta }} /> prioridade alta</span>
        <span className="leg"><i style={{ background: COR.media }} /> média</span>
        <span className="leg"><i style={{ background: COR.baixa }} /> baixa</span>
        <span className="nota">Esquema da distribuição, não um mapa de ruas.</span>
      </figcaption>
    </figure>
  )
}
