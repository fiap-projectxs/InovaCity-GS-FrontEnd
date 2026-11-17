import { STATUS, PRIORIDADES } from '../lib/estatisticas.js'
import { rotuloCategoria } from '../ia/triagem.js'

// Estado sempre com texto (nunca só cor), para daltonismo e leitores de tela.
export const BadgeStatus = ({ valor }) => <span className={`badge st-${valor}`}>{STATUS[valor] || valor}</span>
export const BadgePrio = ({ valor }) => <span className={`badge pr-${valor}`}>Prioridade {PRIORIDADES[valor]?.toLowerCase() || valor}</span>
export const BadgeCat = ({ valor }) => <span className="badge cat">{rotuloCategoria(valor)}</span>

export const fmtData = (iso) => new Date(iso).toLocaleDateString('pt-BR')
export const fmtDataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
