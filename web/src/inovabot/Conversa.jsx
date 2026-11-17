import { useEffect, useRef, useState } from 'react'
import { conversar } from './api.js'

const SUGESTOES = ['Como faço para relatar um buraco?', 'O que acontece se o robô não tiver certeza?', 'Onde está OC3104?', 'Posso ligar os bombeiros por aqui?']
const OFFLINE = 'InovaBot fora do ar. Abra o site pelo servidor.'

function Texto({ t }) {
  // transforma [03_prioridade] em etiqueta de fonte
  return t.split(/(\[\d{2}_[a-z_]+\])/g).map((p, i) => (/^\[\d{2}_/.test(p) ? <span key={i} className="ib-fonte">{p.slice(1, -1)}</span> : <span key={i}>{p}</span>))
}

export default function Conversa({ compacta = false, aoUsar }) {
  const [msgs, setMsgs] = useState([{ de: 'bot', texto: 'Oi! Eu sou o InovaBot. Como posso ajudar?' }])
  const [txt, setTxt] = useState('')
  const [espera, setEspera] = useState(false)
  const fim = useRef(null)

  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [msgs, espera])

  async function enviar(m) {
    const texto = (m ?? txt).trim()
    if (!texto || espera) return
    setTxt(''); setEspera(true)
    setMsgs((x) => [...x, { de: 'eu', texto }])
    try {
      const r = await conversar(texto)
      setMsgs((x) => [...x, { de: 'bot', texto: r.texto, r }])
    } catch (e) {
      setMsgs((x) => [...x, { de: 'bot', texto: e.message && !/fetch|Failed|Network/i.test(e.message) ? `Erro: ${e.message}` : OFFLINE, erro: true }])
    } finally { setEspera(false) }
  }

  return (
    <div className={compacta ? 'ib-conversa compacta' : 'ib-conversa'}>
      <div className="ib-msgs" role="log" aria-live="polite" aria-label="Conversa com o InovaBot" tabIndex={0}>
        {msgs.map((m, i) => (
          <div key={i} className={`ib-msg ${m.de}${m.erro ? ' erro' : ''}`}>
            {m.r?.alertas?.length > 0 && <p className="ib-alerta">{m.r.alertas.join(' ')}</p>}
            <p><Texto t={m.texto} /></p>
          </div>
        ))}
        {espera && <div className="ib-msg bot" aria-live="polite"><p className="nota">Pensando…</p></div>}
        <div ref={fim} />
      </div>
      {msgs.length < 3 && (
        <div className="ib-sugestoes" aria-label="Perguntas sugeridas">
          {SUGESTOES.map((s) => <button key={s} type="button" className="btn peq sec" onClick={() => enviar(s)}>{s}</button>)}
        </div>
      )}
      <form className="ib-form" onSubmit={(e) => { e.preventDefault(); enviar() }}>
        <label className="sr" htmlFor={compacta ? 'ib-in-w' : 'ib-in-p'}>Mensagem para o InovaBot</label>
        <input id={compacta ? 'ib-in-w' : 'ib-in-p'} value={txt} onChange={(e) => setTxt(e.target.value)} maxLength={400} placeholder="Digite sua dúvida" autoComplete="off" />
        <button className="btn peq" type="submit" disabled={espera || !txt.trim()}>Enviar</button>
      </form>
    </div>
  )
}
