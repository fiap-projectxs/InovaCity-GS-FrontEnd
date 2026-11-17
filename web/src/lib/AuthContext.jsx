import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ler, gravar, remover } from './storage.js'
import { gerarHash, conferirSenha, emailValido, senhaForte } from './seguranca.js'
import { adminLogin } from '../inovabot/api.js'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

// Conta de demonstração do painel administrativo. Existe só para a apresentação.
// A senha de demonstração está só no README; aqui fica apenas o hash PBKDF2 (sal fixo, 100000 iterações).
export const ADMIN_DEMO = { email: 'admin@inovacity.demo', sal: '1f0e9a7c4b2d58a36e91c07d4a8b5f23', hash: '11e4fee6d813e1fa5ceb5f1abcfb02a136fbee8e4c0201d154b8a9114cc7212a' }

const novoId = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export function AuthProvider({ children }) {
  const [usuarios, setUsuarios] = useState(() => ler('usuarios', []))
  const [sessaoId, setSessaoId] = useState(() => ler('sessao', null))
  const [pronto, setPronto] = useState(false)

  // cria o admin de demonstração na primeira execução
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const atual = ler('usuarios', [])
      const adm = atual.find((u) => u.email === ADMIN_DEMO.email)
      if (!adm || adm.hash !== ADMIN_DEMO.hash) {
        const { sal, hash } = ADMIN_DEMO
        const novo = { id: 'admin-demo', nome: 'Administração', email: ADMIN_DEMO.email, sal, hash, papel: 'admin', criadoEm: new Date().toISOString(), demo: true }
        const lista = [...atual.filter((u) => u.email !== ADMIN_DEMO.email), novo]
        gravar('usuarios', lista)
        if (vivo) setUsuarios(lista)
      }
      if (vivo) setPronto(true)
    })()
    return () => { vivo = false }
  }, [])

  const usuario = useMemo(() => usuarios.find((u) => u.id === sessaoId) || null, [usuarios, sessaoId])

  const cadastrar = useCallback(async ({ nome, email, senha, consentimento }) => {
    const n = String(nome).trim(), e = String(email).trim().toLowerCase()
    if (n.length < 2) return { erro: 'Informe seu nome.' }
    if (!emailValido(e)) return { erro: 'Informe um e-mail válido.' }
    const f = senhaForte(senha)
    if (f) return { erro: f }
    if (!consentimento) return { erro: 'É preciso aceitar o tratamento dos dados para criar a conta.' }
    const atual = ler('usuarios', [])
    if (atual.some((u) => u.email === e)) return { erro: 'Já existe uma conta com esse e-mail.' }
    const { sal, hash } = await gerarHash(senha)
    const u = { id: novoId(), nome: n, email: e, sal, hash, papel: 'cidadao', criadoEm: new Date().toISOString(), consentimentoEm: new Date().toISOString() }
    const lista = [...atual, u]
    gravar('usuarios', lista); gravar('sessao', u.id)
    setUsuarios(lista); setSessaoId(u.id)
    return { ok: true }
  }, [])

  const entrar = useCallback(async ({ email, senha }) => {
    let e = String(email).trim().toLowerCase()
    if (e === 'admin') e = ADMIN_DEMO.email
    const u = ler('usuarios', []).find((x) => x.email === e)
    // mesma mensagem para e-mail inexistente e senha errada (não revela quais contas existem)
    if (!u || !(await conferirSenha(senha, u))) return { erro: 'E-mail ou senha incorretos.' }
    gravar('sessao', u.id); setSessaoId(u.id)
    if (u.papel === 'admin') adminLogin(e, senha).catch(() => {})
    return { ok: true, papel: u.papel }
  }, [])

  const sair = useCallback(() => { remover('sessao'); setSessaoId(null) }, [])

  const excluirConta = useCallback(() => {
    if (!usuario || usuario.demo) return
    const lista = ler('usuarios', []).filter((u) => u.id !== usuario.id)
    gravar('usuarios', lista); setUsuarios(lista); sair()
  }, [usuario, sair])

  const alterarPapel = useCallback((id, papel) => {
    const lista = ler('usuarios', []).map((u) => (u.id === id && !u.demo ? { ...u, papel } : u))
    gravar('usuarios', lista); setUsuarios(lista)
  }, [])

  const valor = useMemo(() => ({
    usuario, usuarios, pronto, isAdmin: usuario?.papel === 'admin',
    cadastrar, entrar, sair, excluirConta, alterarPapel,
  }), [usuario, usuarios, pronto, cadastrar, entrar, sair, excluirConta, alterarPapel])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}
