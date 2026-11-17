import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'

export default function Login() {
  const { usuario, cadastrar, entrar } = useAuth()
  const [modo, setModo] = useState('entrar')
  const [erro, setErro] = useState('')
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ nome: '', email: '', senha: '', consentimento: false })
  const nav = useNavigate()
  const loc = useLocation()
  const destino = loc.state?.de || '/nova'

  if (usuario) return <Navigate to={destino} replace />

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function enviar(e) {
    e.preventDefault()
    setErro(''); setBusy(true)
    const r = modo === 'entrar' ? await entrar(f) : await cadastrar(f)
    setBusy(false)
    if (r.erro) return setErro(r.erro)
    nav(r.papel === 'admin' ? '/admin' : destino, { replace: true })
  }

  return (
    <section className="pagina estreita">
      <h1>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</h1>
      <div className="abas" role="group" aria-label="Escolha entre entrar e criar conta">
        <button type="button" aria-pressed={modo === 'entrar'} onClick={() => { setModo('entrar'); setErro('') }}>Já tenho conta</button>
        <button type="button" aria-pressed={modo === 'cadastro'} onClick={() => { setModo('cadastro'); setErro('') }}>Quero me cadastrar</button>
      </div>
      <form onSubmit={enviar} noValidate className="cartao form">
        {modo === 'cadastro' && (
          <label>Nome
            <input value={f.nome} onChange={set('nome')} autoComplete="name" required />
          </label>
        )}
        <label>{modo === 'entrar' ? 'E-mail ou usuário' : 'E-mail'}
          <input type={modo === 'entrar' ? 'text' : 'email'} value={f.email} onChange={set('email')} autoComplete="username" required />
        </label>
        <label>Senha
          <input type="password" value={f.senha} onChange={set('senha')} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} required aria-describedby={modo === 'cadastro' ? 'dica-senha' : undefined} />
        </label>
        {modo === 'cadastro' && (
          <>
            <p id="dica-senha" className="nota">Mínimo de 8 caracteres, com letras e números.</p>
            <label className="check">
              <input type="checkbox" checked={f.consentimento} onChange={set('consentimento')} />
              <span>Concordo que meu nome e e-mail sejam usados só para identificar meus relatos. Posso excluir a conta quando quiser.</span>
            </label>
          </>
        )}
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
      </form>
    </section>
  )
}
