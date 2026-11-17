// Persistência no navegador (localStorage). Falhas de acesso não derrubam o app.
const P = 'inovacity:'

export function ler(chave, padrao) {
  try {
    const v = globalThis.localStorage?.getItem(P + chave)
    return v == null ? padrao : JSON.parse(v)
  } catch {
    return padrao
  }
}

export function gravar(chave, valor) {
  try {
    globalThis.localStorage?.setItem(P + chave, JSON.stringify(valor))
    return true
  } catch {
    return false
  }
}

export function remover(chave) {
  try { globalThis.localStorage?.removeItem(P + chave) } catch { /* ignora */ }
}

export function limparTudo() {
  try {
    const ls = globalThis.localStorage
    Object.keys(ls).filter((k) => k.startsWith(P)).forEach((k) => ls.removeItem(k))
  } catch { /* ignora */ }
}
