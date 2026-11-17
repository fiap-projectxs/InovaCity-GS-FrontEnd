"""Avaliacao do modo GENERATIVO (LangChain + Ollama). Rode na sua maquina com Ollama ligado:
    ollama pull qwen3:4b
    pip install -r requirements.txt
    python avaliacao/avaliar_llm.py
Grava avaliacao/resultados_llm.json e imprime: respostas, fundamentacao, citacao correta, recusas e possiveis alucinacoes
(numeros/telefones que nao estao nos trechos recuperados). Revise as respostas a mao: a checagem automatica e so um filtro."""
import json, re, sys, pathlib
RAIZ = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "src"))
from llm import criar_llm
from agente import Assistente
from guardrails import fundamentada, citacoes
from rag import tokens

P = json.load(open(RAIZ / "avaliacao" / "perguntas.json", encoding="utf-8"))
A = Assistente(criar_llm("ollama"))
print("modelo:", A.llm.modelo)
NUM = re.compile(r"\d+(?:[.,]\d+)?")
res = []
for x in P["em_escopo"]:
    r = A.responder(x["q"])
    ctx = " ".join(c["texto"] for _, c in A.ret.buscar(x["q"], A.k))
    nums_resp = set(NUM.findall(re.sub(r"\[[^\]]*\]", "", r["texto"])))
    nums_ctx = set(NUM.findall(ctx))
    res.append({"q": x["q"], "tipo": r["tipo"], "modo": r["modo"], "texto": r["texto"], "fontes": r["fontes"],
                "fonte_correta": bool(set(r["fontes"]) & set(x["docs"])), "fato": bool(re.search(x["fato"], r["texto"], re.I)) if x["fato"] else None,
                "numeros_fora_do_contexto": sorted(nums_resp - nums_ctx), "trace": r["trace"]})
fora = [{"q": x["q"], "tipo": A.responder(x["q"])["tipo"]} for x in P["fora"]]
n = len(res)
resumo = {"modelo": A.llm.modelo, "n": n,
          "respondeu": sum(r["tipo"] == "resposta" for r in res),
          "modo_generativo": sum(str(r["modo"]).startswith("LangChain") for r in res),
          "plano_b_extrativo": sum("plano B" in str(r["modo"]) for r in res),
          "fonte_correta": sum(r["fonte_correta"] for r in res) / n,
          "fato": sum(bool(r["fato"]) for r in res if r["fato"] is not None) / max(1, sum(r["fato"] is not None for r in res)),
          "com_numero_fora_do_contexto": sum(bool(r["numeros_fora_do_contexto"]) for r in res),
          "fora_escopo_recusado": sum(f["tipo"] == "fora_de_escopo" for f in fora), "fora_n": len(fora)}
json.dump({"resumo": resumo, "respostas": res, "fora": fora}, open(RAIZ / "avaliacao" / "resultados_llm.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(resumo, ensure_ascii=False, indent=1))
