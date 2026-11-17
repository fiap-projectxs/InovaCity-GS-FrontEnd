import { useEffect, useState } from 'react'
import { visao } from '../inovabot/api.js'

export default function Visao() {
  const [st, setSt] = useState(null); const [arq, setArq] = useState(null); const [prev, setPrev] = useState(''); const [conf, setConf] = useState(0.25); const [cada, setCada] = useState(15)
  const [r, setR] = useState(null); const [erro, setErro] = useState(''); const [carga, setCarga] = useState(false); const [rev, setRev] = useState({})
  useEffect(() => { visao.status().then(setSt).catch(() => setErro('Servidor não encontrado. Abra o site pelo executar.bat ou executar.sh.')) }, [])
  const video = arq && arq.type.startsWith('video/')
  function escolher(e) {
    const f = e.target.files[0]; setR(null); setErro(''); setRev({}); setArq(null); setPrev('')
    if (!f) return
    if (!/^(image\/(jpeg|png)|video\/(mp4|webm|quicktime))$/.test(f.type)) { setErro('Formato não aceito. Use imagem JPG ou PNG, ou vídeo MP4.'); return }
    if (f.size > (f.type.startsWith('video') ? 40 : 8) * 1048576) { setErro(`Arquivo grande demais. Limite: ${f.type.startsWith('video') ? '40 MB para vídeo' : '8 MB para imagem'}.`); return }
    setArq(f); setPrev(URL.createObjectURL(f))
  }
  async function analisar() {
    setCarga(true); setErro(''); setR(null); setRev({})
    try { setR(video ? await visao.video(arq, conf, cada) : await visao.imagem(arq, conf)) } catch (e) { setErro(e.message) } finally { setCarga(false) }
  }
  function exportar() {
    const t = JSON.stringify({ arquivo: arq.name, resultado: { ...r, imagem: undefined, quadros: r.quadros && r.quadros.map((q) => ({ ...q, imagem: undefined })) }, revisao_do_usuario: rev }, null, 2)
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'application/json' })); a.download = 'analise_imagem.json'; a.click()
  }
  const dets = r ? (r.deteccoes || []) : []
  return (
    <section className="pagina">
      <h1>Analise imagens e vídeos do seu bairro</h1>
      <p className="lide">Envie uma foto ou um vídeo curto. O programa marca com caixas o que o modelo reconhece e diz quão confiante ele está. O resultado ajuda a decidir onde olhar primeiro; não substitui a vistoria de uma equipe.</p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {st && !st.modelo_ativo && (
        <div className="cartao aviso"><p><strong>Nenhum modelo de detecção instalado.</strong> Por isso o site só faz a leitura básica da imagem (brilho e nitidez) e não marca buracos, lixo ou placas. Para ativar, treine o modelo no notebook do projeto e coloque <code>modelo.onnx</code> e <code>classes.txt</code> na pasta modelos/.</p></div>
      )}
      {st && st.modelo_ativo && <p>Modelo carregado. Classes que ele conhece: {st.classes.join(', ') || 'não informadas'}. O programa só reconhece essas classes.</p>}

      <form className="cartao" onSubmit={(e) => { e.preventDefault(); analisar() }}>
        <label htmlFor="arq">Escolha uma imagem (JPG ou PNG, até 8 MB) ou um vídeo (MP4, até 40 MB)</label>
        <input id="arq" type="file" accept="image/jpeg,image/png,video/mp4,video/webm" onChange={escolher} />
        <label htmlFor="conf">Confiança mínima para mostrar uma detecção: {Math.round(conf * 100)}%</label>
        <input id="conf" type="range" min="0.05" max="0.95" step="0.05" value={conf} onChange={(e) => setConf(Number(e.target.value))} />
        <p className="dica">Valor menor mostra mais marcações, com mais erros. Valor maior mostra menos, com menos erros e mais ocorrências perdidas.</p>
        {video && <><label htmlFor="cada">Analisar 1 quadro a cada</label><input id="cada" type="number" min="1" max="120" value={cada} onChange={(e) => setCada(Number(e.target.value))} /></>}
        {prev && (video ? <video src={prev} controls style={{ maxWidth: '100%', maxHeight: 280 }} aria-label="Prévia do vídeo escolhido" /> : <img src={prev} alt="Prévia da imagem escolhida" style={{ maxWidth: '100%', maxHeight: 280 }} />)}
        <p><button className="btn" disabled={!arq || carga}>{carga ? 'Analisando…' : 'Analisar'}</button></p>
        <p className="dica">O arquivo é enviado ao servidor local e não é guardado. Evite imagens com rostos ou placas de veículos legíveis.</p>
      </form>

      {r && !video && (
        <div className="cartao" aria-live="polite">
          <h2>Resultado</h2>
          <img src={r.imagem} alt={`Imagem analisada com ${dets.length} marcações`} style={{ maxWidth: '100%' }} />
          <p>{r.resumo}</p>
          {r.latencia_ms != null && <p>Tempo de análise: {r.latencia_ms} ms.</p>}
          <p>Leitura básica: {r.basica.largura}×{r.basica.altura} pixels; brilho {r.basica.brilho_medio}; nitidez {r.basica.nitidez}. {r.basica.observacoes.join('; ')}.</p>
          {dets.length > 0 && (
            <table><caption>Detecções</caption><thead><tr><th>Classe</th><th>Confiança</th><th>Sua revisão</th></tr></thead>
              <tbody>{dets.map((d, i) => <tr key={i}><td>{d.classe}</td><td>{Math.round(d.confianca * 100)}%</td><td>
                <label className="sr-linha"><span className="sr-only">Revisão da detecção {i + 1}</span><select value={rev[i] || ''} onChange={(e) => setRev({ ...rev, [i]: e.target.value })}><option value="">sem revisão</option><option>confirmada</option><option>incorreta</option></select></label></td></tr>)}</tbody></table>
          )}
          <p><button className="btn sec" onClick={exportar}>Exportar resultado (JSON)</button></p>
        </div>
      )}
      {r && video && (
        <div className="cartao" aria-live="polite">
          <h2>Resultado do vídeo</h2>
          <p>{r.quadros_analisados} quadros analisados ({r.amostragem}). Tempo total: {r.tempo_total_s} s. {r.latencia_media_ms != null && `Tempo médio por quadro: ${r.latencia_media_ms} ms.`}</p>
          <p className="erro">{r.aviso}</p>
          {!r.modelo_ativo && <p>Sem modelo de detecção: só a leitura básica de cada quadro foi feita.</p>}
          <div className="duas-col">{r.quadros.filter((q) => q.imagem).map((q) => <figure key={q.quadro}><img src={q.imagem} alt={`Quadro ${q.quadro} com ${q.deteccoes.length} marcações`} style={{ maxWidth: '100%' }} /><figcaption>Quadro {q.quadro}{q.segundo != null && ` (${q.segundo} s)`}</figcaption></figure>)}</div>
          <p><button className="btn sec" onClick={exportar}>Exportar resultado (JSON)</button></p>
        </div>
      )}

      <h2>O que este módulo faz e não faz</h2>
      <ul>
        <li>Só reconhece as classes do modelo carregado. Um modelo genérico (como o YOLO treinado em COCO) não reconhece buracos, rachaduras ou lixo.</li>
        <li>A confiança é uma estimativa do modelo. Ela cai com sombra, pouca luz, imagem borrada e objetos parcialmente cobertos.</li>
        <li>Presença de um objeto não prova risco, falta de acessibilidade ou qualidade do ambiente.</li>
        <li>Vídeos: analisamos só alguns quadros e não rastreamos objetos, então o mesmo item pode ser contado várias vezes.</li>
      </ul>
    </section>
  )
}
