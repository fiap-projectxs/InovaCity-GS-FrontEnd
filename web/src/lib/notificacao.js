// Notificação SIMULADA ao órgão responsável. Não existe integração real: isto reproduz o
// comportamento do robô de RPA (3 tentativas, falha tratada, pendência para reenvio).
export const TENTATIVAS = 3

// Falha determinística (~30%) a partir do id, para o comportamento ser repetível em testes e demonstração.
export function falhaSimulada(id, tentativa) {
  let h = 0
  const s = `${id}#${tentativa}`
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 10 < 3
}

export const ORGAOS = {
  buraco_via: 'Secretaria de Obras e Vias',
  iluminacao: 'Departamento de Iluminação Pública',
  lixo_entulho: 'Serviço de Limpeza Urbana',
  alagamento_drenagem: 'Defesa Civil e Drenagem',
  calcada_acessibilidade: 'Secretaria de Mobilidade e Acessibilidade',
}

// servicoFora = true simula o serviço do órgão fora do ar (todas as tentativas falham).
export function notificar(ocorrencia, { servicoFora = false } = {}) {
  const orgao = ORGAOS[ocorrencia.categoria] || 'Órgão responsável'
  const tentativas = []
  for (let t = 1; t <= TENTATIVAS; t++) {
    const falhou = servicoFora || falhaSimulada(ocorrencia.id, t)
    tentativas.push({ n: t, ok: !falhou })
    if (!falhou) return { orgao, estado: 'enviada', tentativas, protocolo: 'SIM-' + String(ocorrencia.id).slice(-6).toUpperCase() }
  }
  return { orgao, estado: 'pendente', tentativas, protocolo: null }
}
