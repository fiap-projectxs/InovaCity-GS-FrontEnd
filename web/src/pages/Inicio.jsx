import { Link } from 'react-router-dom'
import Hero from '../components/Hero.jsx'
import { Nuvens, Skyline } from '../components/Cenario.jsx'
import { useDados } from '../lib/DataContext.jsx'
import { resumo } from '../lib/estatisticas.js'
import { CATEGORIAS } from '../ia/triagem.js'

const PASSOS = [
  ['Você relata', 'Descreva o problema e o local, com foto se quiser. Leva um minuto.'],
  ['O robô triagem', 'Ele lê o texto, escolhe a categoria, vê se alguém já relatou o mesmo e dá uma prioridade.'],
  ['Uma pessoa confere', 'Quando o robô tem dúvida, o relato vai para a equipe decidir. Nada fica só na máquina.'],
  ['Você acompanha', 'O andamento aparece na sua lista e no painel público.'],
]

export default function Inicio() {
  const { ocorrencias } = useDados()
  const r = resumo(ocorrencias)
  return (
    <>
      <section className="hero">
        <div className="hero-txt">
          <h1>Conectando pessoas. Transformando cidades.</h1>
          <p className="lide">Relate buracos, postes apagados, lixo acumulado, alagamentos e calçadas quebradas. A InovaCity organiza os relatos para que os problemas mais urgentes cheguem primeiro a quem pode resolver.</p>
          <p className="acoes">
            <Link to="/nova" className="btn">Relatar um problema</Link>
            <Link to="/painel" className="btn sec">Ver o painel da cidade</Link>
          </p>
        </div>
        <div className="hero-arte">
          <Hero />
          <img className="hero-mascote" src="./inovabot.png" alt="" width="150" />
        </div>
        <Nuvens />
      </section>
      <Skyline />

      <section className="faixa" aria-label="Números atuais">
        <p><strong>{r.total}</strong> relatos registrados</p>
        <p><strong>{r.abertas}</strong> em aberto</p>
        <p><strong>{r.altaPrioridade}</strong> de prioridade alta</p>
        <p><strong>{r.revisao}</strong> aguardando revisão humana</p>
      </section>

      <section className="pagina">
        <h2>Como funciona</h2>
        <ol className="passos">
          {PASSOS.map(([t, d]) => (
            <li key={t}><h3>{t}</h3><p>{d}</p></li>
          ))}
        </ol>
      </section>

      <section className="pagina">
        <h2>O que dá para relatar</h2>
        <ul className="chips">
          {Object.values(CATEGORIAS).map((c) => <li key={c.rotulo}>{c.rotulo}</li>)}
        </ul>
        <p className="nota">Outro tipo de problema? Relate mesmo assim: se o robô não tiver segurança, uma pessoa decide.</p>
      </section>

      <section className="pagina dois">
        <div className="cartao">
          <h2>O robô de triagem</h2>
          <p>A triagem automática roda em um robô de RPA que lê lotes de relatos, descarta linhas inválidas, agrupa duplicatas e avisa os órgãos. Veja como ele se saiu em testes e experimente com um arquivo seu.</p>
          <p><Link to="/robo" className="btn sec">Conhecer o robô</Link></p>
        </div>
        <div className="cartao">
          <h2>Seus dados</h2>
          <p>Pedimos só o necessário: nome, e-mail e o relato. Tudo fica neste navegador, as senhas não são guardadas em texto e você pode excluir a conta quando quiser.</p>
          <p><Link to="/sobre" className="btn sec">Privacidade e ODS</Link></p>
        </div>
      </section>
    </>
  )
}
