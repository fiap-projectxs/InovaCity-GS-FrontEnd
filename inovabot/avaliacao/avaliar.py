"""Avaliacao mensuravel do pipeline SEM modelo generativo: recuperacao, recusa, guardrails, ferramentas e resposta extrativa.
Uso: python avaliacao/avaliar.py   -> grava avaliacao/resultados.json e figuras/*.png"""
import json, re, sys, pathlib
import numpy as np
RAIZ = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "src"))
from rag import Recuperador
from guardrails import ocultar_pii, eh_emergencia, tenta_injecao
from ferramentas import consultar_ocorrencia
from agente import Assistente
import agente as ag

P = json.load(open(RAIZ / "avaliacao" / "perguntas.json", encoding="utf-8"))
ES = P["em_escopo"]
MODOS = ["tfidf", "bm25", "bm25_stem", "char", "hibrido"]
R = {}

def rank_doc(ret, q, docs, modo):
    s = ret.pontuar(q, modo)
    for pos, i in enumerate(np.argsort(-s)):
        if ret.chunks[i]["doc"] in docs:
            return pos + 1
    return 10**6

ret = Recuperador()
tab = {}
for m in MODOS:
    for grupo, filtro in (("todas", lambda x: True), ("dificeis", lambda x: x["dificil"])):
        rr = [rank_doc(ret, x["q"], x["docs"], m) for x in ES if filtro(x)]
        n = len(rr)
        tab[f"{m}|{grupo}"] = {"n": n, "R@1": sum(r <= 1 for r in rr) / n, "R@3": sum(r <= 3 for r in rr) / n,
                               "R@5": sum(r <= 5 for r in rr) / n, "MRR": sum(1 / r for r in rr) / n}
R["recuperacao"] = tab

# calibracao do limiar de recusa
sim_in = np.array([ret.similaridade(x["q"]) for x in ES])
sim_out = np.array([ret.similaridade(x["q"]) for x in P["fora"]])
varr = []
for t in np.round(np.arange(0.0, 0.41, 0.01), 2):
    vp = int((sim_in >= t).sum()); fn = len(sim_in) - vp
    rec = int((sim_out < t).sum()); fa = len(sim_out) - rec
    varr.append({"limiar": float(t), "aceita_em_escopo": vp / len(sim_in), "recusa_fora": rec / len(sim_out)})
R["calibracao"] = {"curva": varr, "sim_em_escopo_min": float(sim_in.min()), "sim_em_escopo_med": float(np.median(sim_in)),
                   "sim_fora_max": float(sim_out.max()), "sim_fora_med": float(np.median(sim_out))}
lim = ag.LIMIAR_RETRIEVAL
R["limiar_usado"] = lim
R["recusa_em_escopo_errada"] = [x["q"] for x, s in zip(ES, sim_in) if s < lim]
R["fora_aceito_errado"] = [x["q"] for x, s in zip(P["fora"], sim_out) if s >= lim]
R["sim_fora"] = {x["q"]: round(float(s), 3) for x, s in zip(P["fora"], sim_out)}

# agente completo (extrativo)
A = Assistente()
cert = fato = recusa_ind = 0
falhas_fato, saida = [], []
for x in ES:
    r = A.responder(x["q"])
    if r["tipo"] != "resposta":
        recusa_ind += 1
        saida.append({"q": x["q"], "tipo": r["tipo"]}); continue
    ok_doc = bool(set(r["fontes"]) & set(x["docs"]))
    ok_fato = (x["fato"] is None) or bool(re.search(x["fato"], r["texto"], re.I))
    cert += ok_doc; fato += ok_fato
    if not ok_fato: falhas_fato.append(x["q"])
    saida.append({"q": x["q"], "tipo": r["tipo"], "fontes": r["fontes"], "ok_doc": ok_doc, "ok_fato": ok_fato, "texto": r["texto"]})
com_fato = [x for x in ES if x["fato"]]
n = len(ES)
R["agente_extrativo"] = {"n": n, "respondeu": n - recusa_ind, "recusou_indevido": recusa_ind, "fonte_correta": cert / n,
                         "fato_esperado_presente": fato / n, "falhas_fato": falhas_fato}
R["saidas"] = saida
out_ok = sum(A.responder(x["q"])["tipo"] == "fora_de_escopo" for x in P["fora"])
R["agente_fora_escopo"] = {"n": len(P["fora"]), "recusou": out_ok}

def prf(vp, fp, fn):
    p = vp / (vp + fp) if vp + fp else 1.0; r = vp / (vp + fn) if vp + fn else 1.0
    return {"vp": vp, "fp": fp, "fn": fn, "precisao": p, "revocacao": r}
# emergencia
vp = sum(eh_emergencia(q) for q in P["emergencia"]); fp = sum(eh_emergencia(q) for q in P["emergencia_neg"])
R["emergencia"] = {**prf(vp, fp, len(P["emergencia"]) - vp), "n_pos": len(P["emergencia"]), "n_neg": len(P["emergencia_neg"]),
                   "perdidos": [q for q in P["emergencia"] if not eh_emergencia(q)], "falsos": [q for q in P["emergencia_neg"] if eh_emergencia(q)]}
# pii
pv = pf = pn = 0; perd = []
for x in P["pii"]:
    _, tipos = ocultar_pii(x["q"]); tipos = set(tipos)
    for t in x["tipos"]:
        if t in tipos: pv += 1
        else: pn += 1; perd.append((x["q"], t))
    pf += len(tipos - set(x["tipos"]))
neg_fp = [q for q in P["pii_neg"] if ocultar_pii(q)[1]]
pf += len(neg_fp)
R["pii"] = {**prf(pv, pf, pn), "n_casos": len(P["pii"]), "n_neg": len(P["pii_neg"]), "perdidos": perd, "falsos": neg_fp}
# injecao
iv = sum(tenta_injecao(q) for q in P["injecao"])
neg_inj = [x["q"] for x in ES] + P["emergencia_neg"] + P["emergencia"]
ifp = [q for q in neg_inj if tenta_injecao(q)]
R["injecao"] = {**prf(iv, len(ifp), len(P["injecao"]) - iv), "n_pos": len(P["injecao"]), "n_neg": len(neg_inj),
                "perdidos": [q for q in P["injecao"] if not tenta_injecao(q)], "falsos": ifp}
# status
sv = 0; sf = []
for x in P["status"]:
    txt, arq = consultar_ocorrencia(x["id"])
    ok = (arq is None) if x["estado"] is None else (arq is not None and x["estado"] in arq)
    sv += ok
    if not ok: sf.append((x["id"], arq))
R["status"] = {"n": len(P["status"]), "corretos": sv, "falhas": sf}
json.dump(R, open(RAIZ / "avaliacao" / "resultados.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ---- resumo
print("RECUPERACAO (todas | dificeis)")
for m in MODOS:
    a, b = tab[f"{m}|todas"], tab[f"{m}|dificeis"]
    print(f"{m:10s} R@1 {a['R@1']:.2f} R@3 {a['R@3']:.2f} R@5 {a['R@5']:.2f} MRR {a['MRR']:.2f} | dif R@1 {b['R@1']:.2f} R@3 {b['R@3']:.2f} MRR {b['MRR']:.2f}")
c = R["calibracao"]; print("sim em-escopo min/med", round(c["sim_em_escopo_min"], 3), round(c["sim_em_escopo_med"], 3), "| fora max/med", round(c["sim_fora_max"], 3), round(c["sim_fora_med"], 3))
print("limiar", lim, "| recusa indevida:", R["recusa_em_escopo_errada"], "| fora aceito:", R["fora_aceito_errado"])
print("agente", R["agente_extrativo"]); print("fora", R["agente_fora_escopo"])
for k in ("emergencia", "pii", "injecao", "status"): print(k, {a: b for a, b in R[k].items()})
