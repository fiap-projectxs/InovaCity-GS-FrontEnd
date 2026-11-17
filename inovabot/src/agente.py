"""Orquestracao do assistente: guardrails -> roteamento -> ferramenta ou RAG -> geracao -> verificacao de fundamentacao.

O roteador e por regras (explicavel e testavel); o modelo de linguagem so entra para redigir a resposta
a partir dos trechos recuperados e para reescrever relatos.
"""
import os, re
from rag import Recuperador
from guardrails import ocultar_pii, eh_emergencia, MSG_EMERGENCIA, tenta_injecao, fundamentada, citacoes
from ferramentas import consultar_ocorrencia, extrair_id, triar_relato, rascunho_relato
from llm import LLMExtrativo

LIMIAR_RETRIEVAL = 0.15      # cosseno minimo do melhor trecho; calibrado em avaliacao/avaliar.py
MIN_FUNDAMENTACAO = float(os.getenv("INOVACITY_FUNDAMENTACAO", "0.5"))
RECUSA = "Não encontrei isso na base da InovaCity. Posso ajudar com: como relatar, categorias, prioridade, duplicidade, status, privacidade e acessibilidade. Se for algo urgente ou específico, fale com a equipe."
RECUSA_INJ = "Não posso mudar as minhas regras nem mostrar as minhas instruções. Posso responder dúvidas sobre a InovaCity."


class Assistente:
    def __init__(self, llm=None, recuperador=None, limiar=LIMIAR_RETRIEVAL, k=3):
        self.llm = llm or LLMExtrativo()
        self.ret = recuperador or Recuperador()
        self.limiar, self.k = limiar, k
        self.extrativo = LLMExtrativo()
        LLMExtrativo.definir_idf([c['texto'] for c in self.ret.chunks])

    def responder(self, mensagem):
        tr = []
        msg, pii = ocultar_pii(mensagem)
        if pii:
            tr.append(f"dados pessoais ocultados: {', '.join(pii)}")
        alertas = [f"Ocultei dados pessoais ({', '.join(pii)}). Não os envie no relato."] if pii else []
        if tenta_injecao(msg):
            return self._r("recusa_injecao", RECUSA_INJ, [], alertas, tr + ["tentativa de alterar instruções"])
        if eh_emergencia(msg):
            return self._r("emergencia", MSG_EMERGENCIA, ["09_emergencias"], alertas, tr + ["emergência detectada: sem modelo, resposta fixa"])
        oid = extrair_id(msg)
        if oid:
            txt, arq = consultar_ocorrencia(oid)
            return self._r("status", txt, [arq] if arq else [], alertas, tr + [f"ferramenta consultar_ocorrencia({oid})"])
        trechos = self.ret.buscar(msg, self.k)
        sim = self.ret.similaridade(msg)
        tr.append(f"recuperação: {', '.join(c['id'] for _, c in trechos)} (similaridade {sim:.2f})")
        if sim < self.limiar:
            return self._r("fora_de_escopo", RECUSA, [], alertas, tr + [f"similaridade abaixo de {self.limiar}: recusa"], sim)
        modo = self.llm.nome
        resp = self.llm.responder(msg, trechos)
        if self.llm.generativo:
            ctx = " ".join(c["texto"] for _, c in trechos)
            p, ok = fundamentada(resp, ctx, MIN_FUNDAMENTACAO)
            tr.append(f"fundamentação {p:.2f}")
            if not ok or resp.lower().startswith("não encontrei"):
                if ok:
                    return self._r("fora_de_escopo", RECUSA, [], alertas, tr + ["modelo recusou"], sim)
                resp, modo = self.extrativo.responder(msg, trechos), "extrativo (plano B: resposta do modelo não fundamentada)"
                tr.append("resposta do modelo descartada; usado o modo extrativo")
        docs = list(dict.fromkeys(citacoes(resp))) or list(dict.fromkeys(c["doc"] for _, c in trechos[:2]))
        if not citacoes(resp):
            resp += " " + " ".join(f"[{d}]" for d in docs)
        return self._r("resposta", resp, docs, alertas, tr, sim, modo)

    def relato(self, texto, local=""):
        texto, pii = ocultar_pii(texto)
        if eh_emergencia(texto):
            return {"tipo": "emergencia", "texto": MSG_EMERGENCIA}
        d = rascunho_relato(texto, local)
        if self.llm.generativo:
            novo = self.llm.redigir(texto, local)
            if novo:
                d["titulo"], d["descricao"], d["redigido_por"] = novo["titulo"], novo["descricao"], self.llm.nome
        d["pii"] = pii
        d["tipo"] = "relato"
        trechos = self.ret.buscar(texto, 3)
        d["fontes"] = list(dict.fromkeys(c["doc"] for _, c in trechos[:2])) if self.ret.similaridade(texto) >= self.limiar else []
        return d

    @staticmethod
    def _r(tipo, texto, fontes, alertas, trace, sim=None, modo=None):
        return {"tipo": tipo, "texto": texto, "fontes": fontes, "alertas": alertas, "trace": trace, "similaridade": sim, "modo": modo}
