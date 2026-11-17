import { useState } from 'react'
import { analise, corpus } from '../inovabot/api.js'

function Tabela({ cap, cab, linhas }) {
  return <table><caption>{cap}</caption><thead><tr>{cab.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
}

function Barras({ dados }) {
  const max = Math.max(...dados.map((d) => d[1]), 1)
  return <div role="img" aria-label={'Termos mais frequentes: ' + dados.slice(0, 8).map((d) => `${d[0]} ${d[1]}`).join(', ')}>
    {dados.slice(0, 12).map(([t, n]) => <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '2px 0' }}><span style={{ width: 120 }}>{t}</span><span style={{ background: '#039882', height: 14, width: `${(n / max) * 60}%`, minWidth: 4, borderRadius: 7 }} /><span>{n}</span></div>)}
  </div>
}

function Analise() {
  const [r, setR] = useState(null); const [erro, setErro] = useState(''); const [carga, setCarga] = useState(false); const [arq, setArq] = useState(null)
  async function ir(f) {
    setErro(''); setR(null); if (!f) return
    if (!/\.(csv|txt)$/i.test(f.name)) { setErro('Formato não aceito. Use CSV ou TXT.'); return }
    setCarga(true); setArq(f); try { setR(await analise.enviar(f)) } catch (e) { setErro(e.message) } finally { setCarga(false) }
  }
  async function exemplo() { const t = await (await fetch('./exemplo_relatos.csv')).blob(); ir(new File([t], 'exemplo_relatos.csv')) }
  return (
    <div>
      <h2>Entenda os relatos da comunidade</h2>
      <p>Envie vários relatos de uma vez. Cada linha do arquivo TXT, ou cada linha da coluna de texto do CSV, é um relato. O programa limpa o texto, conta os termos, agrupa por assunto e mostra relatos parecidos.</p>
      <form className="cartao" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="rel">Arquivo CSV ou TXT</label><input id="rel" type="file" accept=".csv,.txt" onChange={(e) => ir(e.target.files[0])} />
        <p><button type="button" className="btn sec" onClick={exemplo}>Usar o arquivo de exemplo (dados sintéticos)</button></p>
      </form>
      {carga && <p role="status">Analisando…</p>}{erro && <p className="erro" role="alert">{erro}</p>}
      {r && (
        <div aria-live="polite">
          <h3>Prévia e validação</h3>
          <p>{r.nota}. {r.relatos_lidos} linhas lidas; {r.vazios_descartados} vazias descartadas; {r.duplicados_removidos} repetidas removidas; {r.relatos_analisados} relatos analisados. Média de {r.tokens_medios} palavras úteis por relato.</p>
          <h3>Resumo</h3><p>{r.resumo}</p>
          <h3>Palavras mais frequentes</h3><Barras dados={r.termos} />
          {r.expressoes.length > 0 && <Tabela cap="Expressões de duas palavras que se repetem" cab={['Expressão', 'Vezes']} linhas={r.expressoes} />}
          <h3>Assuntos encontrados</h3>
          <Tabela cap="Grupos de relatos parecidos" cab={['Grupo', 'Palavras-chave', 'Relatos', 'Exemplo']} linhas={r.temas.map((t) => [t.tema, t.termos.join(', '), t.relatos, t.exemplos[0]])} />
          <h3>Relatos possivelmente semelhantes</h3>
          {r.semelhantes.length ? <Tabela cap="Pares com texto parecido" cab={['Relato A', 'Relato B', 'Semelhança']} linhas={r.semelhantes.map((s) => [s.a, s.b, s.similaridade])} /> : <p>Nenhum par muito parecido.</p>}
          <h3>Decisões de tratamento</h3><ul>{r.decisoes.map((d) => <li key={d}>{d}</li>)}</ul>
          <p><a className="btn sec" href={analise.csv} download>Baixar análise (CSV)</a></p>
        </div>
      )}
    </div>
  )
}

function Fabrica() {
  const [r, setR] = useState(null); const [erro, setErro] = useState(''); const [carga, setCarga] = useState(false); const [texto, setTexto] = useState(''); const [arqs, setArqs] = useState([])
  async function gerar(demo) {
    setErro(''); setR(null); setCarga(true)
    try {
      if (demo) setR(await corpus.processar(null, texto, true))
      else { let ult; for (const a of arqs) ult = await corpus.processar(a, texto, false); setR(ult || (texto ? await corpus.processar(null, texto, false) : null)) }
    } catch (e) { setErro(e.message) } finally { setCarga(false) }
  }
  const E = r && r.estatisticas
  return (
    <div>
      <h2>Fábrica de corpus para um assistente local</h2>
      <p>Transforma documentos públicos (PDF, TXT, DOCX, HTML) em três conjuntos de dados, em formato JSONL, prontos para ajustar um modelo de linguagem pequeno. Os dados pessoais são mascarados antes de gerar qualquer conjunto.</p>
      <form className="cartao" onSubmit={(e) => { e.preventDefault(); gerar(false) }}>
        <label htmlFor="docs">Documentos (um por vez nesta tela; para vários, repita ou use o script corpus_cli.py)</label><input id="docs" type="file" accept=".pdf,.txt,.docx,.html,.htm" onChange={(e) => setArqs(Array.from(e.target.files))} />
        <label htmlFor="col">Ou cole um texto</label><textarea id="col" rows="4" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <p><button className="btn" disabled={carga || (!arqs.length && !texto.trim())}>Gerar corpus</button> <button type="button" className="btn sec" disabled={carga} onClick={() => gerar(true)}>Usar documentos de demonstração do projeto</button></p>
      </form>
      {carga && <p role="status">Processando…</p>}{erro && <p className="erro" role="alert">{erro}</p>}
      {r && (
        <div aria-live="polite">
          {r.alertas.map((a) => <p key={a} className="erro">Atenção: {a}</p>)}
          <Tabela cap="Estatísticas dos corpus" cab={['Arquivo', 'Exemplos', 'Mínimo exigido', 'Média de tokens']} linhas={['corpus_texto.jsonl', 'corpus_qa.jsonl', 'corpus_chat.jsonl'].map((k) => [k, E[k].exemplos, E[k].minimo, E[k].media_tokens])} />
          <p>Duplicatas removidas: texto {E.duplicatas_removidas.texto}, perguntas {E.duplicatas_removidas.qa}, conversas {E.duplicatas_removidas.chat}. Removido na limpeza: {Object.entries(r.removido_na_limpeza).map(([k, v]) => `${v} × ${k}`).join('; ') || 'nada'}.</p>
          <p>Dados pessoais mascarados: {Object.entries(r.anonimizado).map(([k, v]) => `${v} × ${k}`).join('; ') || 'nenhum encontrado'}. A detecção de nomes é aproximada e pode falhar.</p>
          {r.antes_depois.map((x, i) => <div key={i} className="cartao"><p><strong>Antes:</strong> {x.antes}</p><p><strong>Depois:</strong> {x.depois}</p></div>)}
          <h3>Exemplos aleatórios de perguntas e respostas</h3>
          <pre className="codigo" tabIndex="0">{E['corpus_qa.jsonl'].amostras.map((a) => JSON.stringify(a)).join('\n')}</pre>
          <p>{['corpus_texto.jsonl', 'corpus_qa.jsonl', 'corpus_chat.jsonl'].map((a) => <a key={a} className="btn sec" href={corpus.baixar(a)} download>{a}</a>)}</p>
          <p>As perguntas são geradas por regras a partir das frases do documento, e cada resposta é a própria frase. Por isso são fiéis, mas as perguntas são simples. Revise antes de treinar.</p>
        </div>
      )}
    </div>
  )
}

export default function Relatos() {
  return (
    <section className="pagina">
      <h1>Entenda os relatos da comunidade</h1>
      <p className="lide">Duas ferramentas de linguagem: uma resume o que as pessoas estão relatando, a outra prepara textos oficiais para treinar um assistente local.</p>
      <Analise />
      <Fabrica />
    </section>
  )
}
