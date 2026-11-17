import { useMemo, useState } from 'react'
import { useDados } from '../lib/DataContext.jsx'
import { resumo, STATUS } from '../lib/estatisticas.js'
import MapaEsquematico from '../components/MapaEsquematico.jsx'
import { BadgeCat, BadgePrio, BadgeStatus } from '../components/Badges.jsx'

export default function Painel() {
  const { ocorrencias } = useDados()
  const r = useMemo(() => resumo(ocorrencias), [ocorrencias])
  const [sel, setSel] = useState(null)
  const escolhida = ocorrencias.find((o) => o.id === sel)
  const max = Math.max(1, ...r.porCategoria.map((c) => c.n))

  return (
    <section className="pagina">
      <h1>Painel público</h1>
      <p className="lide">Um retrato dos relatos recebidos. Os números mostram o que foi relatado, não tudo o que existe na cidade.</p>

      <div className="grade-num">
        <div className="num"><strong>{r.total}</strong><span>relatos</span></div>
        <div className="num"><strong>{r.abertas}</strong><span>em aberto</span></div>
        <div className="num"><strong>{r.resolvidas}</strong><span>resolvidos</span></div>
        <div className="num"><strong>{r.duplicadas}</strong><span>agrupados como duplicados</span></div>
      </div>

      <div className="duas-col">
        <div className="cartao">
          <h2>Relatos por categoria</h2>
          <ul className="barras">
            {r.porCategoria.map((c) => (
              <li key={c.chave}>
                <span className="rot">{c.rotulo}</span>
                <span className="trilho" aria-hidden="true"><span style={{ width: `${(c.n / max) * 100}%` }} /></span>
                <span className="val">{c.n}</span>
              </li>
            ))}
          </ul>
          <h2>Por situação</h2>
          <ul className="barras">
            {Object.entries(STATUS).filter(([k]) => r.porStatus[k]).map(([k, v]) => (
              <li key={k}><span className="rot">{v}</span><span className="trilho" aria-hidden="true"><span style={{ width: `${(r.porStatus[k] / r.total) * 100}%` }} /></span><span className="val">{r.porStatus[k]}</span></li>
            ))}
          </ul>
        </div>
        <div className="cartao">
          <h2>Distribuição no mapa</h2>
          <MapaEsquematico ocorrencias={ocorrencias.filter((o) => o.status !== 'rejeitada')} onEscolher={setSel} escolhida={sel} />
          {escolhida && (
            <div className="detalhe" aria-live="polite">
              <h3>{escolhida.titulo}</h3>
              <p className="selos"><BadgeStatus valor={escolhida.status} /> <BadgeCat valor={escolhida.categoria} /> <BadgePrio valor={escolhida.prioridade} /></p>
              <p className="meta">{escolhida.local}</p>
            </div>
          )}
        </div>
      </div>

      <div className="cartao aviso" role="note">
        <h2>Leia com cuidado</h2>
        <p>Regiões com mais relatos nem sempre têm mais problemas: podem ter mais gente com acesso e hábito de relatar. Por isso a prioridade considera o risco descrito, e não o volume de pedidos de um bairro. Use este painel junto com outras fontes e a vistoria técnica.</p>
      </div>
    </section>
  )
}
