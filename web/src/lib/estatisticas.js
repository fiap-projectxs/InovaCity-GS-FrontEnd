import { CATEGORIAS } from '../ia/triagem.js'

export const STATUS = {
  recebida: 'Recebida',
  em_analise: 'Em análise',
  encaminhada: 'Encaminhada',
  resolvida: 'Resolvida',
  revisao_humana: 'Revisão humana',
  duplicada: 'Agrupada (duplicada)',
  rejeitada: 'Rejeitada',
}
export const PRIORIDADES = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

const cont = (lista, f) => lista.reduce((a, o) => { const k = f(o); a[k] = (a[k] || 0) + 1; return a }, {})

export function resumo(ocs) {
  const abertas = ocs.filter((o) => !['resolvida', 'duplicada', 'rejeitada'].includes(o.status))
  return {
    total: ocs.length,
    abertas: abertas.length,
    resolvidas: ocs.filter((o) => o.status === 'resolvida').length,
    revisao: ocs.filter((o) => o.status === 'revisao_humana').length,
    duplicadas: ocs.filter((o) => o.status === 'duplicada').length,
    altaPrioridade: abertas.filter((o) => o.prioridade === 'alta').length,
    porCategoria: Object.keys(CATEGORIAS).map((k) => ({ chave: k, rotulo: CATEGORIAS[k].rotulo, n: ocs.filter((o) => o.categoria === k).length })),
    porStatus: cont(ocs, (o) => o.status),
    porLocal: Object.entries(cont(ocs.filter((o) => o.status !== 'rejeitada'), (o) => o.bairro || o.local || 'Sem local'))
      .map(([local, n]) => ({ local, n })).sort((a, b) => b.n - a.n),
  }
}

export function paraCSV(ocs) {
  const cols = ['id', 'criadoEm', 'titulo', 'local', 'categoria', 'prioridade', 'status', 'confianca', 'apoios']
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  return [cols.join(','), ...ocs.map((o) => cols.map((c) => esc(o[c])).join(','))].join('\n')
}
