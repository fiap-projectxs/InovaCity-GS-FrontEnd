import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const ARQ = ['corpus_texto.jsonl', 'corpus_qa.jsonl', 'corpus_chat.jsonl']
const PARADA = new Set('de da do das dos a o as os e em um uma para por com que se na no nas nos ao aos à é ou não mais como seu sua suas seus entre sobre também ser são foi há já pelo pela pelos pelas isso este esta estes estas após até sem quando onde deve devem pode podem caso então muito todos todas cada outros outras mesmo'.split(' '))
const MIN = { 'corpus_texto.jsonl': 50, 'corpus_qa.jsonl': 100, 'corpus_chat.jsonl': 30 }

function palavras(t) { return (t || '').toLowerCase().match(/[a-zà-ú]{4,}/g) || [] }
function tokens(t) { return (t || '').split(/\s+/).filter(Boolean).length }

// Anonimização de demonstração (roda no navegador; nada é enviado)
const REGRAS = [
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]'],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[CNPJ]'],
  [/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[EMAIL]'],
  [/(\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g, '[TELEFONE]'],
  [/\b(Sr\.?|Sra\.?|Dr\.?|Dra\.?|Prof\.?|[Dd]ona|[Ss]eu)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zà-ú]+(\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-zà-ú]+)*/g, '[NOME]'],
]
function anonimizar(t) { return REGRAS.reduce((s, [r, x]) => s.replace(r, x), t) }

export default function Corpus() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [q, setQ] = useState('')
  const [fonte, setFonte] = useState('todas')
  const [pag, setPag] = useState(0)
  const [demo, setDemo] = useState('A moradora Dona Maria Silva (CPF 123.456.789-09, tel. (69) 98888-7777, maria@email.com) pediu abrigo na enchente.')

  useEffect(() => {
    Promise.all(ARQ.map((a) => fetch(`./corpus/${a}`).then((r) => { if (!r.ok) throw new Error(a); return r.text() })))
      .then((ts) => setDados(Object.fromEntries(ARQ.map((a, i) => [a, ts[i].split('\n').filter(Boolean).map((l) => JSON.parse(l))]))))
      .catch((e) => setErro(`Não foi possível carregar ${e.message}.`))
  }, [])

  const est = useMemo(() => {
    if (!dados) return null
    const txt = dados['corpus_texto.jsonl'], qa = dados['corpus_qa.jsonl'], ch = dados['corpus_chat.jsonl']
    const porFonte = {}
    ;[...txt, ...qa, ...ch].forEach((x) => { porFonte[x.fonte] = (porFonte[x.fonte] || 0) + 1 })
    const freq = {}
    txt.forEach((x) => palavras(x.text).forEach((w) => { if (!PARADA.has(w)) freq[w] = (freq[w] || 0) + 1 }))
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 15)
    const tk = txt.map((x) => tokens(x.text))
    return {
      n: { 'corpus_texto.jsonl': txt.length, 'corpus_qa.jsonl': qa.length, 'corpus_chat.jsonl': ch.length },
      mediaTok: tk.length ? Math.round(tk.reduce((a, b) => a + b, 0) / tk.length) : 0, minTok: Math.min(...tk), maxTok: Math.max(...tk),
      porFonte: Object.entries(porFonte).sort((a, b) => b[1] - a[1]), top,
    }
  }, [dados])

  const filtrados = useMemo(() => {
    if (!dados) return []
    const t = q.trim().toLowerCase()
    return dados['corpus_qa.jsonl'].filter((x) => (fonte === 'todas' || x.fonte === fonte) && (!t || (x.instruction + ' ' + x.output).toLowerCase().includes(t)))
  }, [dados, q, fonte])
  useEffect(() => setPag(0), [q, fonte])
  const POR = 5
  const fontes = est ? est.porFonte.map((f) => f[0]) : []
  const maxF = est ? Math.max(...est.porFonte.map((f) => f[1])) : 1
  const maxT = est ? Math.max(...est.top.map((f) => f[1])) : 1

  return (
    <section className="pagina">
      <h1>Análise do corpus: segurança e meio ambiente</h1>
      <p className="lide">Tema: orientação à população em enchentes, alagamentos e deslizamentos, com cartilhas oficiais da Defesa Civil e dos Ministérios da Saúde e do Meio Ambiente. Isso liga o InovaCity aos ODS 11 (cidades seguras) e 13 (ação contra a mudança do clima). O corpus alimenta um assistente local que só responde com base nesses documentos.</p>
      {erro && <p role="alert" className="erro">{erro}</p>}
      {!dados && !erro && <p role="status">Carregando o corpus…</p>}
      {est && (<>
        <h2>Números do corpus</h2>
        <table><caption>Exemplos gerados e mínimo exigido pelo enunciado</caption>
          <thead><tr><th>Arquivo</th><th>Exemplos</th><th>Mínimo</th><th>Situação</th></tr></thead>
          <tbody>{ARQ.map((a) => <tr key={a}><td>{a}</td><td>{est.n[a]}</td><td>{MIN[a]}</td><td>{est.n[a] >= MIN[a] ? 'Atende' : 'Abaixo'}</td></tr>)}</tbody></table>
        <p>Trechos do corpus de texto: média de {est.mediaTok} palavras, de {est.minTok} a {est.maxTok}. O enunciado fala em 256 a 300 tokens; aqui contamos palavras, e o tokenizador do modelo pode contar um pouco diferente.</p>

        <h2>De onde vêm os exemplos</h2>
        <ul className="lista-simples" aria-label="Exemplos por documento">
          {est.porFonte.map(([f, n]) => (
            <li key={f}><span>{f}: {n}</span>
              <div style={{ background: '#d8e6e4', borderRadius: 4, height: 10 }} aria-hidden="true"><div style={{ width: `${(n / maxF) * 100}%`, background: '#039882', height: 10, borderRadius: 4 }} /></div></li>))}
        </ul>

        <h2>Termos mais frequentes</h2>
        <p>Contagem simples nos trechos de texto, sem palavras de ligação. Mostra do que o corpus fala.</p>
        <ul className="lista-simples" aria-label="Termos frequentes">
          {est.top.map(([w, n]) => (
            <li key={w}><span>{w}: {n}</span>
              <div style={{ background: '#fde3d0', borderRadius: 4, height: 8 }} aria-hidden="true"><div style={{ width: `${(n / maxT) * 100}%`, background: '#FB6702', height: 8, borderRadius: 4 }} /></div></li>))}
        </ul>

        <h2>Explorar perguntas e respostas</h2>
        <div role="search">
          <label htmlFor="cq">Buscar (ex.: água, abrigo, lixo, doenças)</label>
          <input id="cq" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
          <label htmlFor="cf">Documento</label>
          <select id="cf" value={fonte} onChange={(e) => setFonte(e.target.value)}>
            <option value="todas">Todos</option>{fontes.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <p role="status">{filtrados.length} de {est.n['corpus_qa.jsonl']} pares encontrados.</p>
        {filtrados.slice(pag * POR, pag * POR + POR).map((x, i) => (
          <article key={i} className="cartao"><p><strong>Pergunta:</strong> {x.instruction}</p><p><strong>Resposta:</strong> {x.output}</p><p><small>Fonte: {x.fonte}</small></p></article>))}
        <p>
          <button type="button" className="btn sec peq" disabled={pag === 0} onClick={() => setPag(pag - 1)}>Anterior</button>{' '}
          <button type="button" className="btn sec peq" disabled={(pag + 1) * POR >= filtrados.length} onClick={() => setPag(pag + 1)}>Próxima</button>
        </p>

        <h2>Teste de anonimização (LGPD)</h2>
        <p>Antes de entrar no corpus, CPF, CNPJ, e-mail, telefone e nomes são trocados por marcadores. Esta caixa roda no seu navegador e não envia nada. As regras são simples e podem deixar passar casos raros, por isso o corpus passa por revisão manual.</p>
        <label htmlFor="an">Texto de teste (use dados inventados)</label>
        <textarea id="an" rows={3} value={demo} onChange={(e) => setDemo(e.target.value)} />
        <p><strong>Resultado:</strong> {anonimizar(demo)}</p>

        <h2>Arquivos e ferramenta</h2>
        <p>
          {ARQ.map((a) => <a key={a} className="btn sec" href={`./corpus/${a}`} download>{a}</a>)}{' '}
          <Link className="btn" to="/relatos">Gerar corpus de outro documento</Link>{' '}
        </p>
        <p><small>Limite: os pares de pergunta e resposta são gerados por regras, sem modelo de linguagem, e o assistente não substitui a orientação da Defesa Civil. Em emergência, ligue 199 (Defesa Civil) ou 193 (Bombeiros).</small></p>
      </>)}
    </section>
  )
}
