import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { ler, gravar } from '../lib/storage.js'
import Widget from '../inovabot/Widget.jsx'

const TITULOS = {
  '/': 'Início', '/login': 'Entrar', '/nova': 'Nova ocorrência', '/consulta': 'Consultar ocorrências',
  '/painel': 'Painel público', '/robo': 'Robô de triagem', '/inovabot': 'InovaBot', '/admin': 'Administração', '/sobre': 'Sobre, privacidade e ODS',
}

export default function Layout({ children }) {
  const { usuario, isAdmin, sair } = useAuth()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const main = useRef(null)
  const [menu, setMenu] = useState(false)
  const [contraste, setContraste] = useState(() => ler('contraste', false))
  const [fonte, setFonte] = useState(() => ler('fonte', 0))

  useEffect(() => {
    document.documentElement.dataset.contraste = contraste ? 'alto' : 'normal'
    document.documentElement.style.setProperty('--escala', String([1, 1.15, 1.3][fonte]))
    gravar('contraste', contraste); gravar('fonte', fonte)
  }, [contraste, fonte])

  // a cada troca de rota: título da aba, foco no conteúdo e menu fechado
  useEffect(() => {
    const t = pathname.startsWith('/admin') ? TITULOS['/admin'] : TITULOS[pathname] || 'Página não encontrada'
    document.title = `${t} | InovaCity`
    setMenu(false)
    main.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [pathname])

  const link = ({ isActive }) => (isActive ? 'nav-link ativo' : 'nav-link')

  return (
    <>
      <a className="pular" href="#conteudo" onClick={(e) => { e.preventDefault(); main.current?.focus() }}>Pular para o conteúdo</a>
      <div className="barra-acess" role="region" aria-label="Ajustes de acessibilidade">
        <span>Leitura:</span>
        <button type="button" onClick={() => setFonte((f) => Math.max(0, f - 1))} aria-label="Diminuir o tamanho do texto" disabled={fonte === 0}>A−</button>
        <button type="button" onClick={() => setFonte((f) => Math.min(2, f + 1))} aria-label="Aumentar o tamanho do texto" disabled={fonte === 2}>A+</button>
        <button type="button" onClick={() => setContraste((c) => !c)} aria-pressed={contraste}>Alto contraste</button>
      </div>
      <header className="topo">
        <div className="topo-in">
          <Link to="/" className="marca" aria-label="InovaCity, página inicial">
            <img src="./logo.png" alt="" width="40" height="40" />
            <span>InovaCity</span>
          </Link>
          <button type="button" className="hamb" aria-expanded={menu} aria-controls="menu-principal" onClick={() => setMenu((m) => !m)}>
            <span className="sr">Menu</span><span aria-hidden="true" className="hamb-ic" />
          </button>
          <nav id="menu-principal" className={menu ? 'menu aberto' : 'menu'} aria-label="Principal">
            <NavLink to="/" end className={link}>Início</NavLink>
            <NavLink to="/nova" className={link}>Nova ocorrência</NavLink>
            <NavLink to="/consulta" className={link}>Consultar</NavLink>
            <NavLink to="/painel" className={link}>Painel</NavLink>
            <NavLink to="/robo" className={link}>Robô</NavLink>
            <NavLink to="/placa" className={link}>Placa</NavLink>
            <NavLink to="/imagens" className={link}>Imagens</NavLink>
            <NavLink to="/relatos" className={link}>Relatos</NavLink>
            <NavLink to="/corpus" className={link}>Corpus</NavLink>
            <NavLink to="/inovabot" className={link}>InovaBot</NavLink>
            <NavLink to="/sobre" className={link}>Sobre</NavLink>
            {isAdmin && <NavLink to="/admin" className={link}>Admin</NavLink>}
            {usuario ? (
              <span className="sessao">
                <span className="quem">{usuario.nome.split(' ')[0]}</span>
                <button type="button" className="btn peq sec" onClick={() => { sair(); nav('/') }}>Sair</button>
              </span>
            ) : (
              <NavLink to="/login" className="btn peq">Entrar</NavLink>
            )}
          </nav>
        </div>
      </header>
      <main id="conteudo" ref={main} tabIndex={-1} className="principal">{children}</main>
      <footer className="rodape">
        <div className="rodape-in">
          <p><strong>InovaCity</strong>. Conectando pessoas. Transformando cidades.</p>
          <p>Protótipo acadêmico. Os dados ficam apenas neste navegador e o encaminhamento a órgãos é simulado.</p>
          <p><Link to="/sobre">Privacidade, ODS e limites do projeto</Link></p>
        </div>
      </footer>
      <Widget />
    </>
  )
}
