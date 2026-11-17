// Resultados reais da execução do robô (RPA), usados na seção "Robô de triagem".
export default {
 "execucao1": {
  "status": "ok",
  "lidas": 51,
  "invalidas": 4,
  "ja_processadas": 0,
  "duplicadas": 3,
  "revisao_humana": 12,
  "processadas": 32,
  "notificadas": 30,
  "notificacao_pendente": 2,
  "retries_falhos": 18,
  "duracao_s": 4.08
 },
 "execucao2": {
  "status": "ok",
  "lidas": 51,
  "invalidas": 4,
  "ja_processadas": 47,
  "duplicadas": 0,
  "revisao_humana": 0,
  "processadas": 0,
  "notificadas": 0,
  "notificacao_pendente": 0,
  "retries_falhos": 0,
  "duracao_s": 0.02
 },
 "avaliacao": {
  "n_treino": 200,
  "n_teste": 100,
  "acuracia_total": 0.8,
  "enviados_a_revisao": 51,
  "n_automaticos": 49,
  "acuracia_automaticos": 0.898,
  "confusoes": {
   "calcada_acessibilidade->buraco_via": 4,
   "alagamento_drenagem->buraco_via": 3,
   "lixo_entulho->buraco_via": 3,
   "alagamento_drenagem->iluminacao": 3,
   "iluminacao->alagamento_drenagem": 2,
   "iluminacao->calcada_acessibilidade": 2,
   "buraco_via->iluminacao": 1,
   "buraco_via->lixo_entulho": 1,
   "alagamento_drenagem->calcada_acessibilidade": 1
  },
  "varredura_limiar": [
   {
    "limiar": 0.3,
    "automaticos": 85,
    "acuracia": 0.871
   },
   {
    "limiar": 0.35,
    "automaticos": 77,
    "acuracia": 0.909
   },
   {
    "limiar": 0.4,
    "automaticos": 65,
    "acuracia": 0.923
   },
   {
    "limiar": 0.45,
    "automaticos": 49,
    "acuracia": 0.898
   },
   {
    "limiar": 0.5,
    "automaticos": 45,
    "acuracia": 0.889
   },
   {
    "limiar": 0.6,
    "automaticos": 34,
    "acuracia": 0.912
   }
  ]
 },
 "falhas": {
  "servicoFora": [
   "19:49:53,600 WARNING OC2027 tentativa 1/3 falhou: servico de notificacao indisponivel",
   "19:49:53,801 WARNING OC2027 tentativa 2/3 falhou: servico de notificacao indisponivel",
   "19:49:54,201 WARNING OC2027 tentativa 3/3 falhou: servico de notificacao indisponivel",
   "19:49:54,202 ERROR OC2027 notificacao pendente: servico de notificacao indisponivel",
   "19:49:54,203 WARNING OC2012 tentativa 1/3 falhou: servico de notificacao indisponivel",
   "19:49:54,404 WARNING OC2012 tentativa 2/3 falhou: servico de notificacao indisponivel"
  ],
  "entradaAusente": [
   "19:50:14,109 ERROR arquivo de entrada ausente: nao_existe.csv"
  ],
  "servicoForaRelatorio": {
   "status": "ok",
   "lidas": 51,
   "invalidas": 4,
   "ja_processadas": 0,
   "duplicadas": 3,
   "revisao_humana": 12,
   "processadas": 32,
   "notificadas": 0,
   "notificacao_pendente": 32,
   "retries_falhos": 96,
   "duracao_s": 19.33
  }
 },
 "testes": [
  "Ran 9 tests in 23.443s",
  "",
  "OK"
 ]
}
