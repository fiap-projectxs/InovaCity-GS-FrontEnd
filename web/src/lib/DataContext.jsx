import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { ler, gravar, remover } from './storage.js'
import { triar, triarOcorrencia, parseCSV } from '../ia/triagem.js'
import { notificar } from './notificacao.js'
import { LOTE_DEMO } from '../data/exemplos.js'

const Ctx = createContext(null)
export const useDados = () => useContext(Ctx)

const agora = () => new Date().toISOString()
const novoId = () => 'oc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
const ev = (texto, por = 'sistema') => ({ em: agora(), texto, por })

// ocorrências da demonstração a partir do mesmo lote usado pelo robô de RPA
export function ocorrenciasDemo() {
  const linhas = parseCSV(LOTE_DEMO)
  const res = triar(linhas)
  const porId = Object.fromEntries(linhas.map((l) => [String(l.id), l]))
  return res.filter((r) => r.res !== 'quarentena').map((r) => {
    const dup = r.res === 'duplicada'
    const rv = r.res === 'revisao'
    const o = {
      id: 'demo-' + r.id,
      criadoEm: new Date(`${r.data}T12:00:00`).toISOString(),
      autorId: 'demo',
      titulo: r.texto.length > 58 ? r.texto.slice(0, 55).trim() + '...' : r.texto,
      descricao: r.texto,
      local: `Região de demonstração (${r.lat.toFixed(3)}, ${r.lon.toFixed(3)})`,
      coords: { lat: r.lat, lng: r.lon },
      categoria: r.categoria, categoriaSugerida: r.categoria, confianca: r.confianca,
      prioridade: r.prio || 'baixa', sinais: r.sinais ? r.sinais.split(';') : [],
      status: dup ? 'duplicada' : rv ? 'revisao_humana' : 'encaminhada',
      duplicadaDe: dup ? 'demo-' + r.duplicada_de : null,
      apoios: 0, apoiadores: [], demo: true, notificacao: null,
      historico: [ev('Relato recebido (dados de demonstração).')],
    }
    if (!dup && !rv) o.notificacao = notificar(o)
    if (o.notificacao?.estado === 'pendente') o.status = 'em_analise'
    return o
  }).map((o, _, todas) => {
    if (o.duplicadaDe) { const base = todas.find((x) => x.id === o.duplicadaDe); if (base) base.apoios += 1 }
    return o
  })
}

function reducer(s, a) {
  switch (a.t) {
    case 'add': return { ...s, ocorrencias: [a.o, ...s.ocorrencias] }
    case 'patch': return { ...s, ocorrencias: s.ocorrencias.map((o) => (o.id === a.id ? { ...o, ...a.patch, historico: a.evento ? [...o.historico, a.evento] : o.historico } : o)) }
    case 'apoio': return { ...s, ocorrencias: s.ocorrencias.map((o) => (o.id === a.id && !o.apoiadores.includes(a.uid) ? { ...o, apoios: o.apoios + 1, apoiadores: [...o.apoiadores, a.uid] } : o)) }
    case 'log': return { ...s, robo: [{ em: agora(), ...a.entrada }, ...s.robo].slice(0, 200) }
    case 'config': return { ...s, config: { ...s.config, ...a.c } }
    case 'trocar': return { ...s, ocorrencias: a.ocorrencias, robo: a.robo ?? s.robo }
    default: return s
  }
}

function inicial() {
  const semeado = ler('semeado', false)
  return {
    ocorrencias: semeado ? ler('ocorrencias', []) : ocorrenciasDemo(),
    robo: ler('robo', []),
    config: ler('config', { servicoFora: false }),
  }
}

export function DataProvider({ children }) {
  const [s, d] = useReducer(reducer, undefined, inicial)

  useEffect(() => { gravar('semeado', true) }, [])
  useEffect(() => { gravar('ocorrencias', s.ocorrencias) }, [s.ocorrencias])
  useEffect(() => { gravar('robo', s.robo) }, [s.robo])
  useEffect(() => { gravar('config', s.config) }, [s.config])

  const log = useCallback((tipo, msg) => d({ t: 'log', entrada: { tipo, msg } }), [])

  // fluxo do cidadão: triagem -> (duplicidade | revisão | notificação)
  const criar = useCallback((dados, autor) => {
    const tri = triarOcorrencia(dados, s.ocorrencias)
    const id = novoId()
    const base = {
      id, criadoEm: agora(), autorId: autor.id, autorNome: autor.nome,
      titulo: dados.titulo.trim(), descricao: dados.descricao.trim(), local: dados.local.trim(),
      coords: dados.coords || null, foto: dados.foto || null,
      categoria: tri.categoria, categoriaSugerida: tri.categoriaSugerida, confianca: tri.confianca,
      prioridade: tri.prio, sinais: tri.sinais, duplicadaDe: tri.duplicadaDe,
      apoios: 0, apoiadores: [], notificacao: null,
    }
    let o
    if (tri.res === 'revisao') {
      o = { ...base, status: 'revisao_humana', historico: [ev('Relato recebido.'), ev('Confiança baixa: enviado para revisão humana.', 'robô')] }
      log('revisao', `${id}: confiança ${Math.round(tri.confianca * 100)}%, enviado para revisão humana`)
    } else if (tri.res === 'duplicada') {
      o = { ...base, status: 'duplicada', historico: [ev('Relato recebido.'), ev(`Agrupado ao relato ${tri.duplicadaDe}.`, 'robô')] }
      d({ t: 'apoio', id: tri.duplicadaDe, uid: autor.id })
      log('duplicada', `${id}: repete ${tri.duplicadaDe}, apoio somado ao original`)
    } else {
      const n = notificar(base, { servicoFora: s.config.servicoFora })
      o = { ...base, notificacao: n, status: n.estado === 'enviada' ? 'encaminhada' : 'em_analise',
        historico: [ev('Relato recebido.'), ev(`Classificado como ${tri.categoria}, prioridade ${tri.prio}.`, 'robô'),
          ev(n.estado === 'enviada' ? `Notificação enviada a ${n.orgao} (protocolo ${n.protocolo}).` : `Notificação a ${n.orgao} falhou nas ${n.tentativas.length} tentativas; ficou pendente para reenvio.`, 'robô')] }
      log(n.estado === 'enviada' ? 'ok' : 'falha', `${id}: ${tri.categoria}/${tri.prio}; notificação ${n.estado} (${n.tentativas.length} tentativa${n.tentativas.length > 1 ? 's' : ''})`)
    }
    d({ t: 'add', o })
    return { ocorrencia: o, triagem: tri }
  }, [s.ocorrencias, s.config.servicoFora, log])

  const atualizar = useCallback((id, patch, texto, por) => d({ t: 'patch', id, patch, evento: texto ? ev(texto, por) : null }), [])
  const apoiar = useCallback((id, uid) => d({ t: 'apoio', id, uid }), [])

  const reenviar = useCallback((id) => {
    const o = s.ocorrencias.find((x) => x.id === id)
    if (!o) return null
    const n = notificar(o, { servicoFora: s.config.servicoFora })
    d({ t: 'patch', id, patch: { notificacao: n, status: n.estado === 'enviada' ? 'encaminhada' : o.status },
      evento: ev(n.estado === 'enviada' ? `Reenvio bem-sucedido (protocolo ${n.protocolo}).` : 'Reenvio falhou; segue pendente.', 'admin') })
    log(n.estado === 'enviada' ? 'ok' : 'falha', `${id}: reenvio ${n.estado}`)
    return n
  }, [s.ocorrencias, s.config.servicoFora, log])

  // administrador decide um relato em revisão humana
  const decidirRevisao = useCallback((id, categoria, adminNome) => {
    const o = s.ocorrencias.find((x) => x.id === id)
    if (!o) return
    const n = notificar({ ...o, categoria }, { servicoFora: s.config.servicoFora })
    d({ t: 'patch', id, patch: { categoria, notificacao: n, status: n.estado === 'enviada' ? 'encaminhada' : 'em_analise' },
      evento: ev(`Categoria definida por ${adminNome}. Notificação ${n.estado}.`, 'admin') })
    log('revisao', `${id}: decidido por pessoa (${categoria}); notificação ${n.estado}`)
  }, [s.ocorrencias, s.config.servicoFora, log])

  // administrador importa o resultado de um lote do robô (linhas processadas viram ocorrências)
  const importarLote = useCallback((resultado, adminId) => {
    const novas = resultado.filter((r) => r.res === 'processada').map((r) => {
      const o = {
        id: novoId() + r.id, criadoEm: agora(), autorId: adminId, titulo: r.texto.slice(0, 58), descricao: r.texto,
        local: `Lote importado (${r.lat.toFixed(3)}, ${r.lon.toFixed(3)})`, coords: { lat: r.lat, lng: r.lon },
        categoria: r.categoria, categoriaSugerida: r.categoria, confianca: r.confianca, prioridade: r.prio,
        sinais: r.sinais ? r.sinais.split(';') : [], status: 'recebida', duplicadaDe: null, apoios: 0, apoiadores: [], notificacao: null,
        historico: [ev('Importado de lote processado pelo robô.', 'robô')],
      }
      const n = notificar(o, { servicoFora: s.config.servicoFora })
      return { ...o, notificacao: n, status: n.estado === 'enviada' ? 'encaminhada' : 'em_analise' }
    })
    d({ t: 'trocar', ocorrencias: [...novas, ...s.ocorrencias] })
    log('ok', `lote importado: ${novas.length} ocorrências criadas de ${resultado.length} linhas`)
    return novas.length
  }, [s.ocorrencias, s.config.servicoFora, log])

  const definirConfig = useCallback((c) => d({ t: 'config', c }), [])
  const recarregarDemo = useCallback(() => { d({ t: 'trocar', ocorrencias: ocorrenciasDemo(), robo: [] }); log('ok', 'dados de demonstração recarregados') }, [log])
  const importarJSON = useCallback((lista) => d({ t: 'trocar', ocorrencias: lista }), [])
  const apagarTudo = useCallback(() => { remover('ocorrencias'); d({ t: 'trocar', ocorrencias: [], robo: [] }) }, [])

  const valor = useMemo(() => ({
    ocorrencias: s.ocorrencias, robo: s.robo, config: s.config,
    criar, atualizar, apoiar, reenviar, decidirRevisao, importarLote, definirConfig, recarregarDemo, importarJSON, apagarTudo, log,
  }), [s, criar, atualizar, apoiar, reenviar, decidirRevisao, importarLote, definirConfig, recarregarDemo, importarJSON, apagarTudo, log])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}
