import { useEffect, useRef, useState } from 'react'
import Conversa from './Conversa.jsx'

export default function Widget() {
  const [aberto, setAberto] = useState(false)
  const botao = useRef(null)
  useEffect(() => {
    if (!aberto) return
    const f = (e) => { if (e.key === 'Escape') { setAberto(false); botao.current?.focus() } }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [aberto])
  return (
    <div className="ib-widget">
      {aberto && (
        <section className="ib-painel" role="dialog" aria-label="Conversa com o InovaBot">
          <header>
            <img src="./inovabot-avatar.png" alt="" width="36" height="36" />
            <strong>InovaBot</strong>
            <button type="button" className="ib-fechar" onClick={() => { setAberto(false); botao.current?.focus() }} aria-label="Fechar a conversa">×</button>
          </header>
          <Conversa compacta />
        </section>
      )}
      <button ref={botao} type="button" className="ib-bolha" aria-expanded={aberto} onClick={() => setAberto((a) => !a)} aria-label={aberto ? 'Fechar o InovaBot' : 'Abrir o InovaBot, assistente da InovaCity'}>
        <img src="./inovabot-avatar.png" alt="" width="56" height="56" />
      </button>
    </div>
  )
}
