import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'

// papel="admin" exige administrador; sem papel, basta estar logado.
export default function RotaProtegida({ papel, children }) {
  const { usuario, pronto } = useAuth()
  const loc = useLocation()
  if (!pronto) return <p className="carregando" role="status">Carregando...</p>
  if (!usuario) return <Navigate to="/login" replace state={{ de: loc.pathname }} />
  if (papel === 'admin' && usuario.papel !== 'admin') {
    return (
      <section className="pagina estreita">
        <h1>Acesso restrito</h1>
        <p>Esta área é só para a equipe de administração. Sua conta é de cidadão.</p>
      </section>
    )
  }
  return children
}
