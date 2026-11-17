import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { useDados } from '../lib/DataContext.jsx'
import ResultadoTriagem from '../components/ResultadoTriagem.jsx'
import { redigir, pegarRascunho } from '../inovabot/api.js'

const MAX_FOTO = 400 * 1024

export default function NovaOcorrencia() {
  const { usuario } = useAuth()
  const { criar } = useDados()
  const [f, setF] = useState({ titulo: '', descricao: '', local: '' })
  const [coords, setCoords] = useState(null)
  const [foto, setFoto] = useState(null)
  const [erros, setErros] = useState({})
  const [resultado, setResultado] = useState(null)
  const [aviso, setAviso] = useState('')

  const [bot, setBot] = useState('')
  useEffect(() => {
    const r = pegarRascunho()
    if (r) { setF({ titulo: r.titulo || '', descricao: r.descricao || '', local: r.local || '' }); setBot('Rascunho carregado.') }
  }, [])

  async function redigirComBot() {
    setBot('')
    if (f.descricao.trim().length < 5) return setBot('Descreva o problema primeiro.')
    setBot('Redigindo…')
    try {
      const d = await redigir(f.descricao, f.local)
      if (d.tipo === 'emergencia') return setBot(d.texto)
      setF((x) => ({ ...x, titulo: d.titulo || x.titulo, descricao: d.descricao || x.descricao }))
      setBot(d.pii?.length ? `Dados pessoais ocultados: ${d.pii.join(', ')}.` : 'Pronto.')
    } catch { setBot('InovaBot fora do ar.') }
  }

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  function usarLocalizacao() {
    setAviso('')
    if (!navigator.geolocation) return setAviso('Este navegador não oferece localização. Descreva o local no campo ao lado.')
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }); setAviso('Localização aproximada anexada ao relato.') },
      () => setAviso('Não foi possível obter a localização. Descreva o local no texto.'),
      { timeout: 8000 },
    )
  }

  function lerFoto(e) {
    const a = e.target.files?.[0]
    setFoto(null)
    if (!a) return
    if (!a.type.startsWith('image/')) return setAviso('Escolha um arquivo de imagem.')
    if (a.size > MAX_FOTO) return setAviso('A foto passa de 400 KB. Escolha uma menor.')
    const r = new FileReader()
    r.onload = () => { setFoto(r.result); setAviso('') }
    r.readAsDataURL(a)
  }

  function enviar(e) {
    e.preventDefault()
    const er = {}
    if (f.titulo.trim().length < 5) er.titulo = 'Dê um título de pelo menos 5 caracteres.'
    if (f.descricao.trim().length < 15) er.descricao = 'Descreva o problema com pelo menos 15 caracteres.'
    if (f.local.trim().length < 3 && !coords) er.local = 'Informe onde fica o problema.'
    setErros(er)
    if (Object.keys(er).length) return
    const r = criar({ ...f, coords, foto }, usuario)
    setResultado(r)
    setF({ titulo: '', descricao: '', local: '' }); setCoords(null); setFoto(null)
  }

  const ligado = (k) => (erros[k] ? { 'aria-invalid': true, 'aria-describedby': 'e-' + k } : {})

  return (
    <section className="pagina">
      <h1>Nova ocorrência</h1>
      <p className="lide">Conte o que está acontecendo e onde. Não escreva dados pessoais de outras pessoas (nomes, telefones, placas).</p>
      <div className="duas-col">
        <form onSubmit={enviar} noValidate className="cartao form">
          <label>Título
            <input value={f.titulo} onChange={set('titulo')} maxLength={90} {...ligado('titulo')} />
          </label>
          {erros.titulo && <p id="e-titulo" className="erro">{erros.titulo}</p>}
          <label>O que está acontecendo
            <textarea rows={5} value={f.descricao} onChange={set('descricao')} maxLength={600} {...ligado('descricao')} />
          </label>
          {erros.descricao && <p id="e-descricao" className="erro">{erros.descricao}</p>}
          <div className="linha">
            <button type="button" className="btn sec peq" onClick={redigirComBot}>Redigir com o InovaBot</button>
            {bot && <span className="nota" role="status">{bot}</span>}
          </div>
          <label>Onde fica (rua, número, referência)
            <input value={f.local} onChange={set('local')} {...ligado('local')} />
          </label>
          {erros.local && <p id="e-local" className="erro">{erros.local}</p>}
          <div className="linha">
            <button type="button" className="btn sec peq" onClick={usarLocalizacao}>Usar minha localização</button>
            {coords && <span className="nota">Anexada: {coords.lat}, {coords.lng}</span>}
          </div>
          <label>Foto (opcional, até 400 KB)
            <input type="file" accept="image/*" onChange={lerFoto} />
          </label>
          {foto && <img className="previa" src={foto} alt="Prévia da foto anexada" />}
          {aviso && <p className="nota" role="status">{aviso}</p>}
          <button className="btn">Enviar relato</button>
        </form>
        <ResultadoTriagem resultado={resultado} />
      </div>
    </section>
  )
}
