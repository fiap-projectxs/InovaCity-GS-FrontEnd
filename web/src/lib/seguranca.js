// Senhas: PBKDF2-SHA256 com sal aleatório (WebCrypto). Nunca se guarda a senha em texto.
// Aviso honesto: sem servidor, isto protege a senha de leitura casual do localStorage,
// mas não substitui autenticação de verdade. Em produção, o login ficaria no back-end.
const ITER = 100000

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const bytes = (h) => Uint8Array.from(h.match(/.{2}/g).map((x) => parseInt(x, 16)))

async function derivar(senha, saltHex) {
  const subtle = globalThis.crypto.subtle
  const chave = await subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(saltHex), iterations: ITER }, chave, 256)
  return hex(bits)
}

export async function gerarHash(senha) {
  const sal = hex(globalThis.crypto.getRandomValues(new Uint8Array(16)))
  return { sal, hash: await derivar(senha, sal) }
}

export async function conferirSenha(senha, { sal, hash }) {
  const h = await derivar(senha, sal)
  if (h.length !== hash.length) return false
  let d = 0
  for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ hash.charCodeAt(i)
  return d === 0
}

export const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e).trim())

// Mínimo simples e explicável: 8+ caracteres com letra e número.
export function senhaForte(s) {
  const t = String(s)
  if (t.length < 8) return 'Use pelo menos 8 caracteres.'
  if (!/[A-Za-z]/.test(t) || !/\d/.test(t)) return 'Misture letras e números.'
  return ''
}

// Mascara e-mail para exibir em listas (minimização de dados).
export function mascararEmail(e) {
  const [u, d] = String(e).split('@')
  if (!d) return e
  return (u.length <= 2 ? u[0] + '*' : u.slice(0, 2) + '***') + '@' + d
}
