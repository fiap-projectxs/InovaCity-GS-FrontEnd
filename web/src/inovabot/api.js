// Cliente do servidor da plataforma (servidor.py). Mesma origem do site; se o site estiver aberto
// sem o servidor, as chamadas falham e a interface mostra como ligar o InovaBot.
const BASE = (typeof window !== 'undefined' && window.INOVABOT_URL) || ''

async function req(caminho, corpo, tipo = 'application/json') {
  const r = await fetch(BASE + caminho, corpo === undefined ? {} : { method: 'POST', headers: { 'Content-Type': tipo }, body: corpo })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.erro || `erro ${r.status}`)
  return j
}

export const status = () => req('/api/status')
export const conversar = (mensagem) => req('/api/chat', JSON.stringify({ mensagem }))
export const redigir = (texto, local = '') => req('/api/relato', JSON.stringify({ texto, local }))
export const reconectar = () => req('/api/reconectar', '{}')
export const rodarRobo = (csv) => req('/api/rpa/executar', csv || '{}', csv ? 'text/csv' : 'application/json')
export async function adminLogin(email, senha) {
  const j = await req('/api/admin/login', JSON.stringify({ email, senha }))
  try { sessionStorage.setItem('ino_tok', j.token) } catch { /* sem armazenamento */ }
}
export async function adminResumo() {
  const r = await fetch(BASE + '/api/admin/resumo', { headers: { 'X-Token': sessionStorage.getItem('ino_tok') || '' } })
  if (!r.ok) throw new Error(r.status === 401 ? 'sessão do servidor expirada: entre de novo' : `erro ${r.status}`)
  return r.json()
}
export const URL_RPA = BASE + '/rpa/index.html'

export function guardarRascunho(d) { try { sessionStorage.setItem('ino_rascunho', JSON.stringify(d)) } catch { /* sem armazenamento */ } }
export function pegarRascunho() {
  try { const v = sessionStorage.getItem('ino_rascunho'); sessionStorage.removeItem('ino_rascunho'); return v ? JSON.parse(v) : null } catch { return null }
}

const get = async (c) => { const r = await fetch(BASE + c); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || `erro ${r.status}`); return j }
const bruto = async (c, dados, cab = {}) => {
  const r = await fetch(BASE + c, { method: 'POST', headers: cab, body: dados })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.erro || `erro ${r.status}`)
  return j
}
export const iot = {
  estado: () => get('/api/iot/estado'), leituras: (o) => get('/api/iot/leituras' + (o ? `?origem=${o}` : '')), alertas: () => get('/api/iot/alertas'),
  simular: (cenario, n) => req('/api/iot/simular', JSON.stringify({ cenario, n })), limites: (d) => req('/api/iot/limites', JSON.stringify(d)),
  ponte: (host, porta, filtro) => req('/api/iot/ponte', JSON.stringify({ host, porta, filtro })), pararPonte: () => req('/api/iot/ponte/parar', '{}'), usb: (d) => req('/api/iot/usb', JSON.stringify(d)),
  ping: () => req('/api/iot/ping', '{}'),
  validar: (id) => req('/api/iot/validar', JSON.stringify({ id })), limpar: () => req('/api/iot/limpar', '{}'),
  csv: '/api/iot/csv', relatorio: '/api/iot/relatorio',
}
export const visao = {
  status: () => get('/api/visao/status'),
  imagem: (arq, conf) => bruto('/api/visao/imagem', arq, { 'X-Conf': String(conf) }),
  video: (arq, conf, cada) => bruto('/api/visao/video', arq, { 'X-Conf': String(conf), 'X-Cada': String(cada) }),
}
export const corpus = {
  processar: (arq, texto, demo) => bruto('/api/corpus/processar', arq || new Blob([]), { ...(arq ? { 'X-Nome': arq.name } : {}), ...(demo ? { 'X-Demo': '1' } : {}), 'X-Texto': encodeURIComponent(texto || '') }),
  baixar: (a) => `/api/corpus/baixar?arq=${a}`,
}
export const analise = { enviar: (arq, k) => bruto('/api/analise', arq, { 'X-Nome': arq.name, ...(k ? { 'X-K': String(k) } : {}) }), csv: '/api/analise/csv' }
