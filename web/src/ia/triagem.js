// Triagem inteligente da InovaCity: porta em JavaScript do robô de RPA (validação, classificação,
// duplicidade e prioridade). O modelo (TF-IDF + regressão logística) foi treinado em Python com
// dados sintéticos e exportado para modelo.js. Tudo roda no navegador; nada é enviado a servidor.
import modelo from './modelo.js'

export const LIMIAR = 0.45 // abaixo disso o relato vai para revisão humana
export const RAIO_M = 150 // duplicidade: mesma categoria a até 150 m...
export const SIM_MIN = 0.6 // ...e texto com similaridade de Jaccard >= 0,6

export const CATEGORIAS = {
  buraco_via: { rotulo: 'Buraco na via', acao: 'Registrar o dano no pavimento e sugerir inspeção da via.' },
  iluminacao: { rotulo: 'Iluminação pública', acao: 'Registrar o ponto sem luz e sugerir vistoria da iluminação.' },
  lixo_entulho: { rotulo: 'Lixo e entulho', acao: 'Registrar o acúmulo de resíduos e sugerir verificação do serviço de limpeza.' },
  alagamento_drenagem: { rotulo: 'Alagamento e drenagem', acao: 'Registrar o ponto de alagamento e sugerir vistoria da drenagem.' },
  calcada_acessibilidade: { rotulo: 'Calçada e acessibilidade', acao: 'Registrar o obstáculo ou dano na calçada e sugerir vistoria de acessibilidade.' },
}
export const rotuloCategoria = (c) => CATEGORIAS[c]?.rotulo ?? 'Sem categoria'

const RISCO = ['risco', 'acidente', 'queda', 'caiu', 'crianca', 'urgente', 'perigo', 'perigosa', 'medo', 'invade', 'cadeira', 'idosos', 'muleta']
const BASE = { buraco_via: 2, iluminacao: 2, alagamento_drenagem: 3, lixo_entulho: 1, calcada_acessibilidade: 2 }

export function norm(t) {
  return String(t ?? '').toLowerCase().normalize('NFKD').replace(/[^\x00-\x7f]/g, '').replace(/[^a-z0-9 ]+/g, ' ')
}

// ---------- leitura e validação de CSV ----------
export function parseCSV(txt) {
  txt = String(txt).replace(/^﻿/, '')
  const rows = []
  let r = [], c = '', q = false
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i]
    if (q) {
      if (ch === '"') { if (txt[i + 1] === '"') { c += '"'; i++ } else q = false } else c += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { r.push(c); c = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && txt[i + 1] === '\n') i++
      r.push(c); c = ''
      if (r.length > 1 || r[0] !== '') rows.push(r)
      r = []
    } else c += ch
  }
  if (c !== '' || r.length) { r.push(c); rows.push(r) }
  if (!rows.length) return []
  const h = rows[0].map((x) => x.trim().toLowerCase())
  return rows.slice(1).map((v) => { const o = {}; h.forEach((k, i) => (o[k] = v[i])); return o })
}

export function validar(l) {
  const texto = (l.texto || '').trim()
  if (texto.length < 3) throw new Error('texto vazio ou curto')
  const num = (x) => (x == null || String(x).trim() === '' ? NaN : Number(x))
  const lat = num(l.lat), lon = num(l.lon)
  if (isNaN(lat) || isNaN(lon)) throw new Error('coordenada nao numerica')
  if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) throw new Error('coordenada fora do intervalo')
  const m = /^\s*(\d+)-(\d+)-(\d+)\s*$/.exec(l.data || '')
  let ok = false
  if (m) {
    const a = +m[1], mo = +m[2], d = +m[3], dt = new Date(Date.UTC(a, mo - 1, d))
    ok = a >= 1 && dt.getUTCFullYear() === a && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  }
  if (!ok) throw new Error('data invalida (esperado AAAA-MM-DD)')
  return { id: String(l.id), texto, lat, lon, data: l.data.trim() }
}

// ---------- classificação, distância, similaridade, prioridade ----------
export function prever(texto, M = modelo) {
  const tk = norm(texto).split(' ').filter((w) => w.length >= 2)
  const idx = prever._idx || (prever._idx = new Map(M.vocab.map((v, i) => [v, i])))
  const tf = new Map()
  for (let n = 1; n <= 2; n++) for (let i = 0; i + n <= tk.length; i++) {
    const k = idx.get(tk.slice(i, i + n).join(' '))
    if (k !== undefined) tf.set(k, (tf.get(k) || 0) + 1)
  }
  const x = []
  let nn = 0
  for (const [k, c] of tf) { const v = (1 + Math.log(c)) * M.idf[k]; x.push([k, v]); nn += v * v }
  nn = Math.sqrt(nn) || 1
  const z = M.classes.map((_, c) => { let s = M.b[c]; for (const [k, v] of x) s += (M.w[c][k] * v) / nn; return s })
  const mx = Math.max(...z)
  const e = z.map((v) => Math.exp(v - mx)), S = e.reduce((a, b) => a + b, 0), p = e.map((v) => v / S)
  let bi = 0
  p.forEach((v, i) => { if (v > p[bi]) bi = i })
  return [M.classes[bi], p[bi]]
}

export function haversine(a, b, c, d) {
  const R = 6371000, r = Math.PI / 180
  const s = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function jaccard(a, b) {
  const A = new Set(norm(a).split(/\s+/).filter(Boolean)), B = new Set(norm(b).split(/\s+/).filter(Boolean))
  if (!A.size && !B.size) return 0
  let i = 0
  for (const x of A) if (B.has(x)) i++
  return i / (A.size + B.size - i)
}

export function prioridade(cat, texto) {
  const t = norm(texto)
  const sinais = RISCO.filter((w) => t.includes(w))
  const pts = (BASE[cat] || 1) + Math.min(2, sinais.length)
  return [pts >= 4 ? 'alta' : pts >= 3 ? 'media' : 'baixa', sinais]
}

// ---------- processamento em lote (mesmo fluxo do robô) ----------
export function triar(linhas) {
  const out = [], vistos = []
  linhas.forEach((b, n) => {
    const id = (b.id && String(b.id).trim()) || 'linha ' + (n + 2)
    b.id = id
    const r = { id, texto: b.texto || '' }
    let v
    try { v = validar(b) } catch (e) { r.res = 'quarentena'; r.motivo = e.message; out.push(r); return }
    const [cat, conf] = prever(v.texto)
    Object.assign(r, { categoria: cat, confianca: conf, lat: v.lat, lon: v.lon, data: v.data })
    if (conf < LIMIAR) { r.res = 'revisao'; r.motivo = 'baixa confianca'; out.push(r); return }
    const d = vistos.find((o) => o.categoria === cat && haversine(v.lat, v.lon, o.lat, o.lon) <= RAIO_M && jaccard(v.texto, o.texto) >= SIM_MIN)
    if (d) { r.res = 'duplicada'; r.duplicada_de = d.id; out.push(r); return }
    const [pr, sinais] = prioridade(cat, v.texto)
    Object.assign(r, { res: 'processada', prio: pr, sinais: sinais.join(';') })
    vistos.push({ id, categoria: cat, lat: v.lat, lon: v.lon, texto: v.texto })
    out.push(r)
  })
  return out
}

const CAT_TXT = {
  buraco_via: 'buraco na via', iluminacao: 'iluminação', lixo_entulho: 'lixo e entulho',
  alagamento_drenagem: 'alagamento e drenagem', calcada_acessibilidade: 'calçada e acessibilidade',
}

export function interpretar(res) {
  const n = res.length
  const g = (k) => res.filter((r) => r.res === k)
  const ok = g('processada'), rv = g('revisao'), qu = g('quarentena'), du = g('duplicada')
  const pl = (k, a, b) => (k === 1 ? a : b)
  const P = [`O arquivo tem ${n} ${pl(n, 'linha', 'linhas')}. O robô processou ${ok.length}, mandou ${rv.length} para revisão humana, colocou ${qu.length} em quarentena e identificou ${du.length} ${pl(du.length, 'duplicata', 'duplicatas')}.`]
  if (ok.length) {
    const c = {}
    ok.forEach((r) => (c[r.categoria] = (c[r.categoria] || 0) + 1))
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])
    const alta = ok.filter((r) => r.prio === 'alta')
    let t = `Entre as processadas, a categoria mais frequente é ${CAT_TXT[top[0][0]]} (${top[0][1]})`
    if (top.length > 1 && top[1][1] === top[0][1]) t += `, empatada com ${CAT_TXT[top[1][0]]}`
    t += '. ' + (alta.length ? `${alta.length} ${pl(alta.length, 'relato recebeu', 'relatos receberam')} prioridade alta (${alta.map((r) => r.id).join(', ')}), por combinar a categoria com sinais de risco no texto.` : 'Nenhum relato recebeu prioridade alta.')
    P.push(t)
  }
  if (rv.length) P.push(`${rv.length} ${pl(rv.length, 'relato ficou', 'relatos ficaram')} com confiança abaixo de ${String(LIMIAR).replace('.', ',')} e ${pl(rv.length, 'vai', 'vão')} para uma pessoa decidir (${rv.map((r) => r.id).join(', ')}).`)
  if (qu.length) {
    const m = {}
    qu.forEach((r) => (m[r.motivo] = m[r.motivo] || []).push(r.id))
    P.push('Quarentena: ' + Object.entries(m).map(([k, v]) => `${k} (${v.join(', ')})`).join('; ') + '. Essas linhas ficam separadas, com o motivo, e o robô segue com as demais.')
  }
  if (du.length) P.push('Duplicatas: ' + du.map((r) => `${r.id} repete ${r.duplicada_de}`).join('; ') + '. Não geram novo chamado.')
  return P
}

// ---------- triagem de um relato enviado pelo cidadão na plataforma ----------
// existentes: ocorrências já salvas (com categoria final, local, coords e descrição).
export function triarOcorrencia({ titulo, descricao, local, coords }, existentes) {
  const texto = `${titulo}. ${descricao}`
  const [sugerida, confianca] = prever(texto)
  const base = { categoriaSugerida: sugerida, confianca }
  if (confianca < LIMIAR) {
    return { ...base, res: 'revisao', categoria: sugerida, prio: 'baixa', sinais: [], duplicadaDe: null,
      mensagem: ['A triagem automática não teve confiança suficiente para decidir a categoria deste relato.',
        'Ele foi encaminhado para revisão de uma pessoa da equipe antes de qualquer outra ação.'] }
  }
  const mesmoLugar = (o) => (coords && o.coords
    ? haversine(coords.lat, coords.lng, o.coords.lat, o.coords.lng) <= RAIO_M
    : norm(local).trim() !== '' && norm(local).trim() === norm(o.local).trim())
  const dup = existentes
    .filter((o) => o.categoria === sugerida && o.status !== 'rejeitada' && mesmoLugar(o))
    .map((o) => ({ o, sim: jaccard(texto, `${o.titulo}. ${o.descricao}`) }))
    .filter((x) => x.sim >= SIM_MIN)
    .sort((a, b) => b.sim - a.sim)[0]
  const [prio, sinais] = prioridade(sugerida, texto)
  const msg = [`Seu relato foi classificado como "${rotuloCategoria(sugerida)}" (confiança estimada ${Math.round(confianca * 100)}%).`]
  if (dup) msg.push(`Já existe um relato muito parecido no mesmo local (${dup.o.titulo}). O seu foi agrupado a ele e soma apoio, sem abrir um novo chamado.`)
  else msg.push('Não encontramos relato semelhante no mesmo local; um novo chamado foi aberto.')
  msg.push(`Prioridade sugerida: ${prio}${sinais.length ? ` (sinais de risco no texto: ${sinais.join(', ')})` : ''}.`)
  msg.push(`Ação sugerida: ${CATEGORIAS[sugerida].acao}`)
  msg.push('O encaminhamento a órgãos públicos depende de canais e parcerias ainda não estabelecidos. Esta é uma triagem automática e não substitui a vistoria técnica.')
  return { ...base, res: dup ? 'duplicada' : 'processada', categoria: sugerida, prio, sinais, duplicadaDe: dup ? dup.o.id : null, mensagem: msg }
}
