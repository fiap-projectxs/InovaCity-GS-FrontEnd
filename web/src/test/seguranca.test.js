import test from 'node:test'
import assert from 'node:assert/strict'
import { gerarHash, conferirSenha, senhaForte, emailValido, mascararEmail } from '../lib/seguranca.js'

test('hash com sal: mesma senha gera hashes diferentes e confere', async () => {
  const a = await gerarHash('Senha123abc'), b = await gerarHash('Senha123abc')
  assert.notEqual(a.hash, b.hash)
  assert.ok(await conferirSenha('Senha123abc', a))
  assert.ok(!(await conferirSenha('senha123abc', a)))
  assert.ok(!JSON.stringify(a).includes('Senha123abc'))
})

test('regras de senha e e-mail', () => {
  assert.ok(senhaForte('abc123'))
  assert.ok(senhaForte('abcdefgh'))
  assert.equal(senhaForte('abcdefg1'), '')
  assert.ok(emailValido('a@b.co')); assert.ok(!emailValido('a@b')); assert.ok(!emailValido('a b@c.com'))
  assert.equal(mascararEmail('maria@x.com'), 'ma***@x.com')
})
