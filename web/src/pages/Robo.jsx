import { useState } from 'react'
import TesteArquivo from '../components/TesteArquivo.jsx'
import { rodarRobo, URL_RPA } from '../inovabot/api.js'
import ev from '../data/evidencias.js'
import { LIMIAR, RAIO_M, SIM_MIN } from '../ia/triagem.js'

const pct = (x) => `${(x * 100).toFixed(1).replace('.', ',')}%`
const E = ev.execucao1

const ETAPAS = [
  ['Lê o lote', 'Abre o CSV de relatos e confere cada linha: texto, coordenadas e data.'],
  ['Separa o que é inválido', 'Linha com texto vazio, coordenada fora do mapa ou data impossível vai para quarentena, com o motivo.'],
  ['Classifica', 'Um modelo de texto escolhe a categoria e informa a confiança.'],
  ['Pergunta a uma pessoa quando duvida', `Com confiança abaixo de ${String(LIMIAR).replace('.', ',')}, o relato vai para revisão humana.`],
  ['Agrupa duplicatas', `Mesma categoria, até ${RAIO_M} m de distância e texto parecido: vira apoio ao relato original.`],
  ['Define a prioridade e avisa o órgão', 'Categoria mais sinais de risco no texto dão a prioridade. A notificação tenta 3 vezes e, se falhar, fica pendente.'],
]

function RoboPython() {
  const [r, setR] = useState(null)
  const [erro, setErro] = useState('')
  const [carga, setCarga] = useState(false)
  async function rodar() {
    setErro(''); setR(null); setCarga(true)
    try { const x = await rodarRobo(); x.ok ? setR(x) : setErro(x.erro || 'o robô falhou') } catch { setErro('Servidor não encontrado.') } finally { setCarga(false) }
  }
  return (
    <div className="cartao">
      <h2>Robô de RPA em Python</h2>
      <button type="button" className="btn" onClick={rodar} disabled={carga}>{carga ? 'Rodando o robô…' : 'Rodar o robô agora'}</button>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {r && (
        <div className="grade-num" aria-live="polite">
          <div className="num"><strong>{r.lidas}</strong><span>lidas</span></div>
          <div className="num"><strong>{r.processadas}</strong><span>processadas</span></div>
          <div className="num"><strong>{r.revisao_humana}</strong><span>revisão humana</span></div>
          <div className="num"><strong>{r.invalidas}</strong><span>quarentena</span></div>
          <div className="num"><strong>{r.duplicadas}</strong><span>duplicadas</span></div>
        </div>
      )}
      <iframe className="ib-gradio" title="Painel do robô de RPA" src={URL_RPA} loading="lazy" style={{ height: '640px', marginTop: '1rem' }} />
    </div>
  )
}

export default function Robo() {
  const A = ev.avaliacao
  return (
    <section className="pagina">
      <h1>Robô de triagem</h1>
      <p className="lide">É o mesmo fluxo do robô de RPA do projeto, escrito aqui em JavaScript para você testar no navegador. O robô original está em Python e gerou os números desta página.</p>

      <h2>O que ele faz, em ordem</h2>
      <ol className="passos">
        {ETAPAS.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}
      </ol>

      <h2>O que aconteceu na execução real</h2>
      <p>O robô processou um lote de teste com {E.lidas} linhas em {String(E.duracao_s).replace('.', ',')} s. Os dados são sintéticos.</p>
      <div className="grade-num">
        <div className="num"><strong>{E.processadas}</strong><span>processadas</span></div>
        <div className="num"><strong>{E.revisao_humana}</strong><span>para revisão humana</span></div>
        <div className="num"><strong>{E.invalidas}</strong><span>em quarentena</span></div>
        <div className="num"><strong>{E.duplicadas}</strong><span>duplicadas</span></div>
      </div>
      <ul className="lista-simples">
        <li>Das {E.processadas} processadas, {E.notificadas} foram notificadas e {E.notificacao_pendente} ficaram pendentes depois das 3 tentativas.</li>
        <li>Ao todo houve {E.retries_falhos} tentativas de envio que falharam e foram repetidas.</li>
        <li>Rodando o mesmo arquivo uma segunda vez, o robô reconheceu {ev.execucao2.ja_processadas} linhas já processadas e não repetiu nada. Isso evita notificar o órgão duas vezes.</li>
      </ul>

      <div className="duas-col">
        <div className="cartao">
          <h2>Quão certo é o classificador</h2>
          <p>Em {A.n_teste} relatos de teste que o modelo nunca viu, acertou {pct(A.acuracia_total)} contando todos. Com o limiar de {String(LIMIAR).replace('.', ',')}, {A.enviados_a_revisao} foram para uma pessoa e os outros {A.n_automaticos} seguiram sozinhos, com {pct(A.acuracia_automaticos)} de acerto.</p>
          <p className="nota">Os dados de treino e teste são sintéticos. Com relatos reais, o desempenho pode ser pior.</p>
        </div>
        <div className="cartao">
          <h2>O limiar muda o equilíbrio</h2>
          <div className="tabela-rolar" tabIndex={0} role="region" aria-label="Varredura do limiar">
            <table>
              <caption className="sr">Quantos relatos seguem automáticos e com que acerto, por limiar</caption>
              <thead><tr><th scope="col">Limiar</th><th scope="col">Automáticos</th><th scope="col">Acerto</th></tr></thead>
              <tbody>
                {A.varredura_limiar.map((v) => (
                  <tr key={v.limiar} className={v.limiar === LIMIAR ? 'destaque' : ''}>
                    <td>{String(v.limiar).replace('.', ',')}</td><td>{v.automaticos}</td><td>{pct(v.acuracia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="nota">Limiar maior manda mais relatos para pessoas; menor deixa o robô decidir mais, com mais risco de erro.</p>
        </div>
      </div>

      <div className="cartao">
        <h2>Quando algo dá errado</h2>
        <p>Dois cenários foram testados de propósito. Com o serviço de notificação fora do ar, o robô tentou 3 vezes, registrou o aviso e deixou o relato pendente, sem parar o lote. Com o arquivo de entrada ausente, registrou o erro e terminou sem travar.</p>
        <pre className="log" tabIndex={0} aria-label="Trecho do registro do robô">{[...ev.falhas.servicoFora.slice(0, 4), ...ev.falhas.entradaAusente].join('\n')}</pre>
      </div>

      <RoboPython />
      <TesteArquivo />
    </section>
  )
}
