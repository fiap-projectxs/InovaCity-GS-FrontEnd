import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Conversa from '../inovabot/Conversa.jsx'
import { status, redigir, guardarRascunho, reconectar } from '../inovabot/api.js'

function FormularioRelato() {
  const nav = useNavigate()
  const [texto, setTexto] = useState('')
  const [local, setLocal] = useState('')
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const [carga, setCarga] = useState(false)

  async function preparar(e) {
    e.preventDefault(); setErro(''); setD(null); setCarga(true)
    try { setD(await redigir(texto, local)) } catch (x) { setErro(/fetch|Failed|Network/i.test(x.message) ? 'InovaBot fora do ar.' : x.message) } finally { setCarga(false) }
  }
  const usar = () => { guardarRascunho({ titulo: d.titulo, descricao: d.descricao, local }); nav('/nova') }

  return (
    <div className="cartao">
      <form onSubmit={preparar} className="form">
        <label>O que está acontecendo
          <textarea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={600} placeholder="Ex.: o poste da esquina da escola está apagado há uma semana" />
        </label>
        <label>Onde fica
          <input value={local} onChange={(e) => setLocal(e.target.value)} />
        </label>
        <button className="btn" type="submit" disabled={carga || texto.trim().length < 5}>{carga ? 'Preparando…' : 'Preparar relato'}</button>
      </form>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {d && (d.tipo === 'emergencia'
        ? <p className="ib-alerta" role="alert">{d.texto}</p>
        : (
          <div className="ib-resultado" aria-live="polite">
            {d.pii?.length > 0 && <p className="ib-alerta">Dados pessoais ocultados: {d.pii.join(', ')}.</p>}
            <h3>{d.titulo}</h3>
            <p>{d.descricao}</p>
            <p className="nota">{d.triagem?.rotulo} · {Math.round((d.triagem?.confianca || 0) * 100)}% · {d.triagem?.decisao === 'automatica' ? `prioridade ${d.triagem?.prioridade}` : 'revisão humana'}</p>
            {d.fontes?.length > 0 && <p className="nota">Fontes: {d.fontes.map((f) => <span key={f} className="ib-fonte">{f}</span>)}</p>}
            {d.redigido_por && <p className="nota">Redigido por {d.redigido_por}</p>}
            <button type="button" className="btn sec" onClick={usar}>Usar na Nova ocorrência</button>
          </div>
        ))}
    </div>
  )
}

export default function InovaBot() {
  const [st, setSt] = useState(null)
  const [fora, setFora] = useState(false)
  const [aba, setAba] = useState('form')
  const carregar = () => status().then((s) => { setSt(s); setFora(false) }).catch(() => setFora(true))
  useEffect(() => { carregar() }, [])
  const gradio = st?.gradio
  useEffect(() => { if (st?.gradio) setAba('gradio') }, [st])

  return (
    <section className="pagina">
      <div className="ib-hero">
        <img src="./inovabot.png" alt="InovaBot, o robô mascote da InovaCity, acenando e segurando um tablet com mapa" width="180" />
        <div>
          <h1>InovaBot</h1>
          <p className="lide">Assistente de IA da InovaCity.</p>
          {fora && <p className="erro" role="alert">InovaBot fora do ar. Abra o site pelo servidor.</p>}
          {st && !st.generativo && <button type="button" className="btn peq sec" onClick={() => reconectar().then(setSt).catch(() => {})}>Procurar o Ollama</button>}
        </div>
      </div>

      <h2>Redigir relato</h2>
      {gradio && (
        <div className="ib-abas" role="group" aria-label="Forma de redigir">
          <button type="button" className={aba === 'gradio' ? 'btn peq' : 'btn peq sec'} aria-pressed={aba === 'gradio'} onClick={() => setAba('gradio')}>Gradio</button>
          <button type="button" className={aba === 'form' ? 'btn peq' : 'btn peq sec'} aria-pressed={aba === 'form'} onClick={() => setAba('form')}>Formulário</button>
        </div>
      )}
      {aba === 'gradio' && gradio
        ? <iframe className="ib-gradio" title="InovaBot: redigir relato (Gradio)" src={gradio} loading="lazy" />
        : <FormularioRelato />}

      <h2>Conversar</h2>
      <div className="cartao"><Conversa /></div>
    </section>
  )
}
