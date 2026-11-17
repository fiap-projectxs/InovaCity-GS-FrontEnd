import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCSV, triar, interpretar, triarOcorrencia, prever, validar, haversine, jaccard, prioridade, LIMIAR } from '../ia/triagem.js'
import { LOTE_DEMO } from '../data/exemplos.js'

const contar = (res) => res.reduce((a, r) => ((a[r.res] = (a[r.res] || 0) + 1), a), {})

test('lote de 51 linhas reproduz a execução real do robô (32/12/4/3)', () => {
  const res = triar(parseCSV(LOTE_DEMO))
  assert.equal(res.length, 51)
  assert.deepEqual(contar(res), { processada: 32, revisao: 12, quarentena: 4, duplicada: 3 })
})

test('validar rejeita texto vazio, coordenada ruim e data impossível', () => {
  const ok = { id: '1', texto: 'buraco na rua', lat: '-23.5', lon: '-46.6', data: '2026-11-10' }
  assert.equal(validar(ok).lat, -23.5)
  assert.throws(() => validar({ ...ok, texto: ' ' }), /texto/)
  assert.throws(() => validar({ ...ok, lat: 'x' }), /coordenada/)
  assert.throws(() => validar({ ...ok, lat: '95' }), /intervalo/)
  assert.throws(() => validar({ ...ok, data: '2026-02-31' }), /data/)
  assert.throws(() => validar({ ...ok, data: '31/02/2026' }), /data/)
})

test('classificador acerta casos claros e dá confiança em [0,1]', () => {
  const [c, p] = prever('poste apagado a noite, rua sem iluminacao')
  assert.equal(c, 'iluminacao')
  assert.ok(p > LIMIAR && p <= 1)
  assert.equal(prever('buraco enorme no asfalto da avenida')[0], 'buraco_via')
})

test('haversine, jaccard e prioridade', () => {
  assert.ok(haversine(-23.55, -46.63, -23.55, -46.63) < 1)
  assert.ok(Math.abs(haversine(-23.55, -46.63, -23.5509, -46.63) - 100) < 5)
  assert.equal(jaccard('a b c', 'a b c'), 1)
  assert.equal(jaccard('', ''), 0)
  assert.equal(prioridade('alagamento_drenagem', 'risco de acidente, crianca')[0], 'alta')
  assert.equal(prioridade('lixo_entulho', 'lixo na calcada')[0], 'baixa')
})

test('interpretar descreve o lote em português com os números certos', () => {
  const p = interpretar(triar(parseCSV(LOTE_DEMO)))
  assert.match(p[0], /51 linhas.*processou 32.*12 para revisão humana.*4 em quarentena.*3 duplicatas/)
})

test('triarOcorrencia agrupa relato repetido no mesmo local e manda dúvida para revisão', () => {
  const dados = { titulo: 'Poste apagado', descricao: 'poste apagado a noite na Rua do Comercio', local: 'Rua do Comercio, 100', coords: { lat: -23.5575, lng: -46.6477 } }
  const a = triarOcorrencia(dados, [])
  assert.equal(a.res, 'processada')
  const existente = { id: 'x1', titulo: dados.titulo, descricao: dados.descricao, local: dados.local, coords: dados.coords, categoria: a.categoria, status: 'encaminhada' }
  const b = triarOcorrencia(dados, [existente])
  assert.equal(b.res, 'duplicada')
  assert.equal(b.duplicadaDe, 'x1')
  const c = triarOcorrencia({ ...dados, coords: { lat: -23.58, lng: -46.7 } }, [existente])
  assert.equal(c.res, 'processada')
  const d = triarOcorrencia({ titulo: 'Coisa estranha', descricao: 'ha algo esquisito acontecendo ali perto', local: 'ali', coords: null }, [])
  assert.equal(d.res, 'revisao')
})
