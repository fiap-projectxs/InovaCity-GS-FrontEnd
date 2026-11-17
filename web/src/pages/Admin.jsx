import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { useDados } from '../lib/DataContext.jsx'
import { CATEGORIAS, rotuloCategoria } from '../ia/triagem.js'
import { resumo, STATUS, paraCSV } from '../lib/estatisticas.js'
import { mascararEmail } from '../lib/seguranca.js'
import { BadgeCat, BadgePrio, BadgeStatus, fmtDataHora } from '../components/Badges.jsx'
import MapaEsquematico from '../components/MapaEsquematico.jsx'
import { adminResumo, rodarRobo, reconectar } from '../inovabot/api.js'

const ABAS = [
  ['geral', 'Visão geral'], ['revisao', 'Revisão humana'], ['todas', 'Ocorrências'],
  ['notif', 'Notificações'], ['usuarios', 'Usuários'], ['log', 'Registro do robô'], ['bot', 'InovaBot'], ['rpa', 'Robô RPA'], ['dados', 'Dados'],
]

function baixar(nome, texto, tipo) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nome; a.click()
  URL.revokeObjectURL(url)
}

export default function Admin() {
  const [aba, setAba] = useState('geral')
  const { ocorrencias } = useDados()
  const pend = ocorrencias.filter((o) => o.notificacao?.estado === 'pendente').length
  const rev = ocorrencias.filter((o) => o.status === 'revisao_humana').length
  const cont = { revisao: rev, notif: pend }
  const foco = (e) => {
    const i = ABAS.findIndex(([k]) => k === aba)
    const n = e.key === 'ArrowRight' ? (i + 1) % ABAS.length : e.key === 'ArrowLeft' ? (i + ABAS.length - 1) % ABAS.length : -1
    if (n < 0) return
    e.preventDefault(); setAba(ABAS[n][0])
    document.getElementById('aba-' + ABAS[n][0])?.focus()
  }
  return (
    <section className="pagina larga">
      <h1>Administração</h1>
      <div className="abas-admin" role="tablist" aria-label="Seções da administração" onKeyDown={foco}>
        {ABAS.map(([k, r]) => (
          <button key={k} id={'aba-' + k} role="tab" type="button" aria-selected={aba === k} aria-controls="painel-admin" tabIndex={aba === k ? 0 : -1} onClick={() => setAba(k)}>
            {r}{cont[k] ? <span className="contador" aria-label={`${cont[k]} pendentes`}>{cont[k]}</span> : null}
          </button>
        ))}
      </div>
      <div id="painel-admin" role="tabpanel" aria-labelledby={'aba-' + aba} tabIndex={0}>
        {aba === 'geral' && <Geral />}
        {aba === 'revisao' && <Revisao />}
        {aba === 'todas' && <Todas />}
        {aba === 'notif' && <Notif />}
        {aba === 'usuarios' && <Usuarios />}
        {aba === 'log' && <LogRobo />}
        {aba === 'bot' && <BotAdmin />}
        {aba === 'rpa' && <RpaAdmin />}
        {aba === 'dados' && <Dados />}
      </div>
    </section>
  )
}

function Geral() {
  const { ocorrencias } = useDados()
  const r = useMemo(() => resumo(ocorrencias), [ocorrencias])
  const pend = ocorrencias.filter((o) => o.notificacao?.estado === 'pendente').length
  const urgentes = ocorrencias.filter((o) => o.prioridade === 'alta' && !['resolvida', 'duplicada', 'rejeitada'].includes(o.status)).slice(0, 6)
  return (
    <>
      <div className="grade-num">
        <div className="num"><strong>{r.abertas}</strong><span>em aberto</span></div>
        <div className="num"><strong>{r.revisao}</strong><span>na fila de revisão</span></div>
        <div className="num"><strong>{pend}</strong><span>notificações pendentes</span></div>
        <div className="num"><strong>{r.altaPrioridade}</strong><span>prioridade alta</span></div>
      </div>
      <div className="duas-col">
        <div className="cartao">
          <h2>Prioridade alta em aberto</h2>
          {urgentes.length === 0 ? <p className="vazio">Nenhuma ocorrência de prioridade alta em aberto.</p> : (
            <ul className="lista-simples">{urgentes.map((o) => <li key={o.id}>{o.titulo} <BadgeStatus valor={o.status} /></li>)}</ul>
          )}
        </div>
        <div className="cartao"><h2>Mapa</h2><MapaEsquematico ocorrencias={ocorrencias.filter((o) => o.status !== 'rejeitada')} /></div>
      </div>
    </>
  )
}

function Revisao() {
  const { ocorrencias, decidirRevisao, atualizar } = useDados()
  const { usuario } = useAuth()
  const fila = ocorrencias.filter((o) => o.status === 'revisao_humana')
  const [esc, setEsc] = useState({})
  if (!fila.length) return <p className="vazio">A fila está vazia. Os relatos em que o robô tem dúvida aparecem aqui.</p>
  return (
    <ul className="lista">
      {fila.map((o) => {
        const val = esc[o.id] || o.categoriaSugerida
        return (
          <li key={o.id} className="cartao item">
            <h2 className="item-tit">{o.titulo}</h2>
            <p>{o.descricao}</p>
            <p className="meta">{o.local} · o robô sugeriu <strong>{rotuloCategoria(o.categoriaSugerida)}</strong> com {Math.round(o.confianca * 100)}% de confiança</p>
            <div className="linha">
              <label>Categoria
                <select value={val} onChange={(e) => setEsc((x) => ({ ...x, [o.id]: e.target.value }))}>
                  {Object.entries(CATEGORIAS).map(([k, c]) => <option key={k} value={k}>{c.rotulo}</option>)}
                </select>
              </label>
              <button type="button" className="btn peq" onClick={() => decidirRevisao(o.id, val, usuario.nome)}>Confirmar e encaminhar</button>
              <button type="button" className="btn peq sec" onClick={() => atualizar(o.id, { status: 'rejeitada' }, `Relato rejeitado por ${usuario.nome}.`, 'admin')}>Rejeitar</button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Todas() {
  const { ocorrencias, atualizar } = useDados()
  const { usuario } = useAuth()
  const [st, setSt] = useState('')
  const lista = ocorrencias.filter((o) => !st || o.status === st)
  return (
    <>
      <div className="linha">
        <label>Situação
          <select value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="button" className="btn sec peq" onClick={() => baixar('ocorrencias.csv', paraCSV(lista), 'text/csv;charset=utf-8')}>Exportar CSV ({lista.length})</button>
      </div>
      <div className="tabela-rolar" tabIndex={0} role="region" aria-label="Todas as ocorrências">
        <table>
          <caption className="sr">Ocorrências, com alteração de situação</caption>
          <thead><tr><th scope="col">Título</th><th scope="col">Categoria</th><th scope="col">Prioridade</th><th scope="col">Situação</th><th scope="col">Alterar para</th></tr></thead>
          <tbody>
            {lista.map((o) => (
              <tr key={o.id}>
                <td>{o.titulo}</td><td><BadgeCat valor={o.categoria} /></td><td><BadgePrio valor={o.prioridade} /></td><td><BadgeStatus valor={o.status} /></td>
                <td>
                  <select aria-label={`Alterar a situação de ${o.titulo}`} value="" onChange={(e) => e.target.value && atualizar(o.id, { status: e.target.value }, `Situação alterada para "${STATUS[e.target.value]}" por ${usuario.nome}.`, 'admin')}>
                    <option value="">Escolher...</option>
                    {['em_analise', 'encaminhada', 'resolvida', 'rejeitada'].filter((k) => k !== o.status).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Notif() {
  const { ocorrencias, reenviar, config, definirConfig } = useDados()
  const [msg, setMsg] = useState('')
  const pend = ocorrencias.filter((o) => o.notificacao?.estado === 'pendente')
  const env = ocorrencias.filter((o) => o.notificacao?.estado === 'enviada').length
  return (
    <>
      <p>{env} notificações enviadas, {pend.length} pendentes. O envio é simulado: cada notificação tenta até 3 vezes.</p>
      <label className="check">
        <input type="checkbox" checked={config.servicoFora} onChange={(e) => definirConfig({ servicoFora: e.target.checked })} />
        <span>Simular serviço do órgão fora do ar (novos envios falham)</span>
      </label>
      {msg && <p className="nota" role="status">{msg}</p>}
      {pend.length === 0 ? <p className="vazio">Nenhuma notificação pendente.</p> : (
        <ul className="lista">
          {pend.map((o) => (
            <li key={o.id} className="cartao item">
              <h2 className="item-tit">{o.titulo}</h2>
              <p className="meta">{o.notificacao.orgao} · falhou nas {o.notificacao.tentativas.length} tentativas</p>
              <button type="button" className="btn peq" onClick={() => { const n = reenviar(o.id); setMsg(n?.estado === 'enviada' ? `Reenvio de "${o.titulo}" concluído.` : `Reenvio de "${o.titulo}" falhou de novo.`) }}>Reenviar</button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function Usuarios() {
  const { usuarios, usuario, alterarPapel } = useAuth()
  const { ocorrencias } = useDados()
  return (
    <div className="tabela-rolar" tabIndex={0} role="region" aria-label="Usuários">
      <table>
        <caption className="sr">Usuários cadastrados</caption>
        <thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Papel</th><th scope="col">Relatos</th><th scope="col">Alterar papel</th></tr></thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td>{u.nome}</td><td>{mascararEmail(u.email)}</td><td>{u.papel === 'admin' ? 'Administrador' : 'Cidadão'}</td>
              <td>{ocorrencias.filter((o) => o.autorId === u.id).length}</td>
              <td>{u.demo || u.id === usuario.id ? <span className="nota">-</span> : (
                <button type="button" className="btn peq sec" onClick={() => alterarPapel(u.id, u.papel === 'admin' ? 'cidadao' : 'admin')}>{u.papel === 'admin' ? 'Tornar cidadão' : 'Tornar administrador'}</button>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nota">E-mails aparecem mascarados para minimizar a exposição de dados pessoais.</p>
    </div>
  )
}

function LogRobo() {
  const { robo } = useDados()
  if (!robo.length) return <p className="vazio">Sem registros ainda. Envie um relato ou processe um arquivo na página do robô.</p>
  return (
    <ul className="logrobo">
      {robo.map((l, i) => <li key={i} className={'lg-' + l.tipo}><time dateTime={l.em}>{fmtDataHora(l.em)}</time> <span className="badge">{l.tipo}</span> {l.msg}</li>)}
    </ul>
  )
}

function Dados() {
  const { ocorrencias, recarregarDemo, importarJSON, apagarTudo } = useDados()
  const [msg, setMsg] = useState('')
  const ref = useRef(null)
  function importar(e) {
    const a = e.target.files?.[0]
    if (!a) return
    const r = new FileReader()
    r.onload = () => {
      try {
        const l = JSON.parse(String(r.result))
        if (!Array.isArray(l) || !l.every((o) => o && o.id && o.titulo && o.status && Array.isArray(o.historico))) throw new Error()
        importarJSON(l); setMsg(`${l.length} ocorrências importadas.`)
      } catch { setMsg('Arquivo inválido. Use um JSON exportado por esta tela.') }
      if (ref.current) ref.current.value = ''
    }
    r.readAsText(a)
  }
  return (
    <div className="cartao">
      <h2>Dados deste navegador</h2>
      <p>{ocorrencias.length} ocorrências guardadas localmente.</p>
      <div className="linha">
        <button type="button" className="btn sec peq" onClick={() => baixar('inovacity-ocorrencias.json', JSON.stringify(ocorrencias, null, 2), 'application/json')}>Exportar JSON</button>
        <label className="btn sec peq arq">Importar JSON<input ref={ref} type="file" accept="application/json,.json" onChange={importar} /></label>
        <button type="button" className="btn sec peq" onClick={() => { if (window.confirm('Substituir os dados atuais pela demonstração?')) { recarregarDemo(); setMsg('Demonstração recarregada.') } }}>Recarregar demonstração</button>
        <button type="button" className="btn peq perigo" onClick={() => { if (window.confirm('Apagar todas as ocorrências? Esta ação não pode ser desfeita.')) { apagarTudo(); setMsg('Ocorrências apagadas.') } }}>Apagar ocorrências</button>
      </div>
      {msg && <p className="nota" role="status">{msg}</p>}
    </div>
  )
}

function BotAdmin() {
  const [d, setD] = useState(null)
  const [erro, setErro] = useState('')
  const carregar = () => adminResumo().then((x) => { setD(x); setErro('') }).catch((e) => setErro(/fetch|Failed|Network/i.test(e.message) ? 'Servidor fora do ar.' : e.message))
  useEffect(() => { carregar() }, [])
  if (erro) return <p className="erro" role="alert">{erro}</p>
  if (!d) return <p>Carregando…</p>
  return (
    <div>
      <div className="grade-num">
        <div className="num"><strong>{d.total}</strong><span>conversas</span></div>
        <div className="num"><strong>{d.por_tipo.resposta || 0}</strong><span>respondidas</span></div>
        <div className="num"><strong>{d.por_tipo.fora_de_escopo || 0}</strong><span>fora do escopo</span></div>
        <div className="num"><strong>{d.por_tipo.emergencia || 0}</strong><span>emergências</span></div>
        <div className="num"><strong>{d.sim_media ?? '-'}</strong><span>similaridade média</span></div>
      </div>
      <div className="duas-col">
        <div className="cartao">
          <h2>Modelo</h2>
          <p><strong>{d.modelo}</strong></p>
          <p>Gradio: {d.gradio ? 'ligado' : 'desligado'}</p>
          <button type="button" className="btn peq sec" onClick={() => reconectar().then(carregar)}>Procurar o Ollama</button>
          <button type="button" className="btn peq sec" onClick={carregar}>Atualizar</button>
        </div>
        <div className="cartao">
          <h2>Documentos mais citados</h2>
          <ul className="lista-simples">{d.docs.map(([n, q]) => <li key={n}>{n}: {q}</li>)}{!d.docs.length && <li>Nenhum ainda</li>}</ul>
        </div>
      </div>
      <div className="cartao">
        <h2>Perguntas sem resposta</h2>
        <ul className="lista-simples">{d.sem_resposta.map((q, i) => <li key={i}>{q}</li>)}{!d.sem_resposta.length && <li>Nenhuma</li>}</ul>
      </div>
      <div className="cartao">
        <h2>Últimas conversas</h2>
        <div className="tabela-rolar" tabIndex={0} role="region" aria-label="Últimas conversas">
          <table>
            <thead><tr><th scope="col">Hora</th><th scope="col">Pergunta</th><th scope="col">Tipo</th><th scope="col">Fontes</th></tr></thead>
            <tbody>{d.ultimas.map((c, i) => <tr key={i}><td>{c.t}</td><td>{c.q}</td><td>{c.tipo}</td><td>{(c.fontes || []).join(', ')}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function RpaAdmin() {
  const [r, setR] = useState(null)
  const [erro, setErro] = useState('')
  const [carga, setCarga] = useState(false)
  async function rodar() {
    setErro(''); setR(null); setCarga(true)
    try { const x = await rodarRobo(); x.ok ? setR(x) : setErro(x.erro || 'o robô falhou') } catch { setErro('Servidor fora do ar.') } finally { setCarga(false) }
  }
  return (
    <div className="cartao">
      <h2>Robô de RPA</h2>
      <button type="button" className="btn" onClick={rodar} disabled={carga}>{carga ? 'Rodando…' : 'Rodar o robô'}</button>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {r && (
        <div className="grade-num">
          {[['lidas', 'lidas'], ['processadas', 'processadas'], ['revisao_humana', 'revisão humana'], ['invalidas', 'quarentena'], ['duplicadas', 'duplicadas'], ['notificadas', 'notificadas'], ['notificacao_pendente', 'pendentes']].map(([k, n]) => (
            <div className="num" key={k}><strong>{r[k]}</strong><span>{n}</span></div>
          ))}
        </div>
      )}
    </div>
  )
}
