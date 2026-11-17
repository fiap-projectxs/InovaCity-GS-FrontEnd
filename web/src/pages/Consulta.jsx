import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { useDados } from '../lib/DataContext.jsx'
import { CATEGORIAS } from '../ia/triagem.js'
import { STATUS } from '../lib/estatisticas.js'
import { BadgeCat, BadgePrio, BadgeStatus, fmtData, fmtDataHora } from '../components/Badges.jsx'

export default function Consulta() {
  const { usuario } = useAuth()
  const { ocorrencias, apoiar } = useDados()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [st, setSt] = useState('')
  const [meus, setMeus] = useState(false)
  const [aberta, setAberta] = useState(null)

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return ocorrencias.filter((o) =>
      (!t || `${o.titulo} ${o.descricao} ${o.local}`.toLowerCase().includes(t)) &&
      (!cat || o.categoria === cat) && (!st || o.status === st) &&
      (!meus || o.autorId === usuario?.id))
  }, [ocorrencias, q, cat, st, meus, usuario])

  return (
    <section className="pagina">
      <h1>Consultar ocorrências</h1>
      <form className="filtros cartao" role="search" aria-label="Filtrar ocorrências" onSubmit={(e) => e.preventDefault()}>
        <label>Buscar
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="rua, palavra do relato..." />
        </label>
        <label>Categoria
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(CATEGORIAS).map(([k, c]) => <option key={k} value={k}>{c.rotulo}</option>)}
          </select>
        </label>
        <label>Situação
          <select value={st} onChange={(e) => setSt(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        {usuario && (
          <label className="check"><input type="checkbox" checked={meus} onChange={(e) => setMeus(e.target.checked)} /><span>Só os meus relatos</span></label>
        )}
      </form>

      <p className="contagem" role="status">{lista.length} {lista.length === 1 ? 'ocorrência encontrada' : 'ocorrências encontradas'}</p>

      {lista.length === 0 ? (
        <p className="vazio">Nada encontrado com esses filtros. Limpe a busca ou <Link to="/nova">relate um problema</Link>.</p>
      ) : (
        <ul className="lista">
          {lista.map((o) => {
            const ab = aberta === o.id
            const ja = usuario && o.apoiadores.includes(usuario.id)
            return (
              <li key={o.id} className="cartao item">
                <h2 className="item-tit">{o.titulo}</h2>
                <p className="selos"><BadgeStatus valor={o.status} /> <BadgeCat valor={o.categoria} /> <BadgePrio valor={o.prioridade} /></p>
                <p className="meta">{o.local} · {fmtData(o.criadoEm)} · {o.apoios} {o.apoios === 1 ? 'apoio' : 'apoios'}</p>
                <div className="linha">
                  <button type="button" className="btn peq sec" aria-expanded={ab} onClick={() => setAberta(ab ? null : o.id)}>{ab ? 'Ocultar detalhes' : 'Ver detalhes'}</button>
                  {usuario ? (
                    <button type="button" className="btn peq" disabled={ja || o.autorId === usuario.id} onClick={() => apoiar(o.id, usuario.id)}>
                      {ja ? 'Você apoiou' : o.autorId === usuario.id ? 'Seu relato' : 'Também vejo isso'}
                    </button>
                  ) : <Link className="btn peq" to="/login" state={{ de: '/consulta' }}>Entre para apoiar</Link>}
                </div>
                {ab && (
                  <div className="detalhe">
                    <p>{o.descricao}</p>
                    {o.foto && <img className="previa" src={o.foto} alt={`Foto do relato: ${o.titulo}`} />}
                    {o.sinais?.length > 0 && <p className="nota">Sinais de risco no texto: {o.sinais.join(', ')}.</p>}
                    <h3>Andamento</h3>
                    <ol className="hist">
                      {o.historico.map((h, i) => <li key={i}><time dateTime={h.em}>{fmtDataHora(h.em)}</time> {h.texto}</li>)}
                    </ol>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
