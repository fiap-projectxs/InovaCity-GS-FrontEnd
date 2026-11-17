import test from 'node:test'
import assert from 'node:assert/strict'
import { notificar, falhaSimulada, TENTATIVAS } from '../lib/notificacao.js'
import { paraCSV, resumo } from '../lib/estatisticas.js'

test('falha simulada é determinística', () => {
  assert.equal(falhaSimulada('oc1', 1), falhaSimulada('oc1', 1))
})

test('serviço fora: 3 tentativas e fica pendente', () => {
  const n = notificar({ id: 'oc1', categoria: 'buraco_via' }, { servicoFora: true })
  assert.equal(n.estado, 'pendente')
  assert.equal(n.tentativas.length, TENTATIVAS)
  assert.equal(n.protocolo, null)
})

test('taxa de falha na primeira tentativa fica perto de 30%', () => {
  let f = 0
  for (let i = 0; i < 1000; i++) if (falhaSimulada('id' + i, 1)) f++
  assert.ok(f > 200 && f < 400, String(f))
})

test('notificação enviada traz protocolo e órgão da categoria', () => {
  for (let i = 0; i < 50; i++) {
    const n = notificar({ id: 'a' + i, categoria: 'iluminacao' })
    if (n.estado === 'enviada') { assert.match(n.protocolo, /^SIM-/); assert.match(n.orgao, /Ilumina/); return }
  }
  assert.fail('nenhuma enviada em 50 tentativas')
})

test('estatísticas e CSV com escape', () => {
  const ocs = [
    { id: '1', titulo: 'a, "b"', local: 'x', categoria: 'buraco_via', prioridade: 'alta', status: 'encaminhada', confianca: .9, apoios: 0, criadoEm: '2026-01-01' },
    { id: '2', titulo: 'c', local: 'y', categoria: 'iluminacao', prioridade: 'baixa', status: 'resolvida', confianca: .8, apoios: 1, criadoEm: '2026-01-02' },
  ]
  const r = resumo(ocs)
  assert.equal(r.total, 2); assert.equal(r.abertas, 1); assert.equal(r.resolvidas, 1); assert.equal(r.altaPrioridade, 1)
  assert.match(paraCSV(ocs), /"a, ""b"""/)
})
