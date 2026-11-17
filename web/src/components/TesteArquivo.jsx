import { useState } from 'react'
import { parseCSV, triar, interpretar, rotuloCategoria } from '../ia/triagem.js'
import { EXEMPLO_BASICO, EXEMPLO_DIFICIL, LOTE_DEMO } from '../data/exemplos.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { useDados } from '../lib/DataContext.jsx'

const ROT = { processada: 'Processada', revisao: 'Revisão humana', quarentena: 'Quarentena', duplicada: 'Duplicada' }

// O CSV é lido e processado no próprio navegador; nada é enviado a servidor.
export default function TesteArquivo() {
  const { isAdmin, usuario } = useAuth()
  const { importarLote, log } = useDados()
  const [txt, setTxt] = useState('')
  const [res, setRes] = useState(null)
  const [msg, setMsg] = useState('')

  function rodar(t = txt) {
    setMsg('')
    const linhas = parseCSV(t)
    if (!linhas.length || !('texto' in linhas[0])) {
      setRes(null)
      return setMsg('Não achei linhas. O arquivo precisa ter cabeçalho com as colunas id, texto, lat, lon, data.')
    }
    if (linhas.length > 500) return setMsg('Para este teste, use até 500 linhas.')
    const r = triar(linhas)
    setRes(r)
    log('ok', `teste de arquivo: ${linhas.length} linhas lidas`)
  }
  function carregar(t) { setTxt(t); rodar(t) }
  function arquivo(e) {
    const a = e.target.files?.[0]
    if (!a) return
    const r = new FileReader()
    r.onload = () => { setTxt(String(r.result)); rodar(String(r.result)) }
    r.readAsText(a)
  }
  function importar() {
    const n = importarLote(res, usuario.id)
    setMsg(`${n} ocorrências criadas a partir das linhas processadas.`)
  }

  const cont = (k) => res?.filter((r) => r.res === k).length ?? 0
  return (
    <div className="cartao">
      <h2>Teste com seu arquivo</h2>
      <p>Envie um CSV com as colunas <code>id,texto,lat,lon,data</code> (data como AAAA-MM-DD) ou use um exemplo. O processamento acontece neste navegador.</p>
      <div className="linha">
        <button type="button" className="btn sec peq" onClick={() => carregar(LOTE_DEMO)}>Lote de 51 linhas (o da execução real)</button>
        <button type="button" className="btn sec peq" onClick={() => carregar(EXEMPLO_BASICO)}>Exemplo básico</button>
        <button type="button" className="btn sec peq" onClick={() => carregar(EXEMPLO_DIFICIL)}>Exemplo difícil</button>
      </div>
      <label>Ou escolha um arquivo .csv
        <input type="file" accept=".csv,text/csv" onChange={arquivo} />
      </label>
      <label>Conteúdo do CSV
        <textarea rows={5} value={txt} onChange={(e) => setTxt(e.target.value)} spellCheck={false} />
      </label>
      <button type="button" className="btn" onClick={() => rodar()} disabled={!txt.trim()}>Processar</button>
      {msg && <p className="nota" role="status">{msg}</p>}

      {res && (
        <div aria-live="polite">
          <div className="grade-num pequena">
            {['processada', 'revisao', 'quarentena', 'duplicada'].map((k) => <div className="num" key={k}><strong>{cont(k)}</strong><span>{ROT[k].toLowerCase()}</span></div>)}
          </div>
          <div className="cartao leitura">
            <h3>Leitura do resultado</h3>
            {interpretar(res).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="tabela-rolar" tabIndex={0} role="region" aria-label="Resultado linha a linha">
            <table>
              <caption className="sr">Resultado do processamento linha a linha</caption>
              <thead><tr><th scope="col">Id</th><th scope="col">Texto</th><th scope="col">Resultado</th><th scope="col">Categoria</th><th scope="col">Prioridade</th><th scope="col">Detalhe</th></tr></thead>
              <tbody>
                {res.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td><td>{r.texto}</td>
                    <td><span className={`badge rs-${r.res}`}>{ROT[r.res]}</span></td>
                    <td>{r.categoria ? `${rotuloCategoria(r.categoria)} (${Math.round(r.confianca * 100)}%)` : '-'}</td>
                    <td>{r.prio || '-'}</td>
                    <td>{r.motivo || (r.duplicada_de ? `repete ${r.duplicada_de}` : r.sinais || '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isAdmin && cont('processada') > 0 && (
            <p><button type="button" className="btn" onClick={importar}>Importar {cont('processada')} processadas como ocorrências</button></p>
          )}
        </div>
      )}
    </div>
  )
}
