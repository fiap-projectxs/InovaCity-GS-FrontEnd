import { Link } from 'react-router-dom'
import { BadgeCat, BadgePrio, BadgeStatus } from './Badges.jsx'

// Mostra o que a triagem decidiu e por quê. Região aria-live: leitores de tela anunciam o resultado.
export default function ResultadoTriagem({ resultado }) {
  if (!resultado) return <div aria-live="polite" className="resultado-vazio" />
  const { ocorrencia: o, triagem: t } = resultado
  const n = o.notificacao
  return (
    <section className="cartao resultado" aria-live="polite" aria-labelledby="res-tit">
      <h2 id="res-tit">Resultado da triagem</h2>
      <p className="selos">
        <BadgeStatus valor={o.status} /> <BadgeCat valor={o.categoria} />{' '}
        {t.res !== 'revisao' && <BadgePrio valor={o.prioridade} />}
      </p>
      {t.mensagem.map((m, i) => <p key={i}>{m}</p>)}
      <div className="barra-conf" role="img" aria-label={`Confiança da classificação: ${Math.round(t.confianca * 100)}%`}>
        <span style={{ width: `${Math.round(t.confianca * 100)}%` }} className={t.confianca < 0.45 ? 'baixa' : ''} />
      </div>
      <p className="nota">Confiança {Math.round(t.confianca * 100)}%. Abaixo de 45%, uma pessoa decide.</p>
      {n && (
        <p className="nota">
          Notificação simulada a {n.orgao}: {n.estado === 'enviada' ? `enviada na tentativa ${n.tentativas.length} (protocolo ${n.protocolo}).` : `falhou nas ${n.tentativas.length} tentativas e ficou pendente para reenvio.`}
        </p>
      )}
      <p><Link to="/consulta" className="btn sec">Ver minhas ocorrências</Link></p>
    </section>
  )
}
