"""Ferramentas do agente: triagem (reuso do classificador do robo de RPA), consulta de status e rascunho de relato."""
import csv, re
from pathlib import Path
from classificador import Classificador, ler_rotulado
from prioridade import prioridade

DADOS = Path(__file__).resolve().parent.parent / "dados"
LIMIAR = 0.45
ROTULO = {"buraco_via": "Buraco na via", "iluminacao": "Iluminação pública", "lixo_entulho": "Lixo e entulho",
          "alagamento_drenagem": "Alagamento e drenagem", "calcada_acessibilidade": "Calçada e acessibilidade"}
_clf = None


def classificador():
    global _clf
    if _clf is None:
        X, y = ler_rotulado(DADOS / "treino_rotulado.csv")
        _clf = Classificador().treinar(X, y)
    return _clf


def triar_relato(texto):
    cat, conf = classificador().prever(texto)
    cat = str(cat)
    nivel, sinais = prioridade(cat, texto)
    decisao = "automatica" if conf >= LIMIAR else "revisao_humana"
    return {"categoria": cat, "rotulo": ROTULO[cat], "confianca": round(conf, 3), "prioridade": nivel if decisao == "automatica" else None,
            "sinais": sinais, "decisao": decisao}


def _ler(nome):
    p = DADOS / nome
    return {r["id"]: r for r in csv.DictReader(open(p, encoding="utf-8", newline=""))} if p.exists() else {}


def consultar_ocorrencia(oid):
    oid = oid.upper()
    for nome, fn in (("fila_processadas.csv", lambda r: f"{oid} foi processada: {ROTULO.get(r['categoria'], r['categoria'])}, prioridade {r['prioridade']}, protocolo simulado {r['protocolo']}."),
                     ("fila_revisao_humana.csv", lambda r: f"{oid} está em revisão humana: o robô sugeriu {ROTULO.get(r['categoria'], r['categoria'])} com confiança {float(r['confianca']):.0%}, abaixo de 45%, e uma pessoa vai decidir."),
                     ("quarentena.csv", lambda r: f"{oid} está em quarentena: {r['motivo']}. A linha precisa ser corrigida e reenviada.")):
        d = _ler(nome)
        if oid in d:
            return fn(d[oid]), nome
    return f"Não encontrei a ocorrência {oid} nos lotes processados do protótipo.", None


def extrair_id(texto):
    m = re.search(r"\bOC\d{3,5}\b", texto, re.I)
    return m.group(0).upper() if m else None


def rascunho_relato(texto, local=""):
    """Modelo de texto SEM LLM: organiza o relato nos campos do formulario. Com LLM, llm.py reescreve em linguagem clara."""
    t = re.sub(r"\s+", " ", texto).strip().rstrip(".")
    s = triar_relato(t)
    titulo = (t[:60].rsplit(" ", 1)[0] if len(t) > 60 else t)
    return {"titulo": titulo[:1].upper() + titulo[1:], "descricao": t[:1].upper() + t[1:] + ".", "local": local.strip(), "triagem": s}
