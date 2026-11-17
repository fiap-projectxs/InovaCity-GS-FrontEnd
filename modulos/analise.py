"""Análise de corpus de relatos ("Entenda os relatos da comunidade"): validação, limpeza, tokenização, frequências, temas, semelhantes, resumo.
Cada linha do CSV (coluna de texto) ou cada linha não vazia do TXT é um relato. Sem análise de sentimentos."""
import collections, csv, io, re, unicodedata
import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer

STOP = set("""a o as os um uma uns umas de da do das dos em no na nos nas por para com sem sobre entre e ou mas que se ao aos à às é são foi ser está estão há tem têm tinha
muito muita muitos muitas mais menos já não sim também lá aqui ali isso isto esse essa esses essas este esta estes estas meu minha seu sua nosso nossa dele dela eles elas
como quando onde porque pois até desde ainda só então la ha ja nao tambem eu nós voce você vocês me te lhe""".split())


def ler(nome, dados):
    t = dados.decode("utf-8-sig", "replace")
    if nome.lower().endswith(".csv"):
        amostra = t[:2000]
        try: sep = csv.Sniffer().sniff(amostra, delimiters=",;\t|").delimiter
        except csv.Error: sep = ","
        linhas = list(csv.DictReader(io.StringIO(t), delimiter=sep))
        if not linhas: raise ValueError("CSV sem linhas")
        cols = list(linhas[0].keys())
        pref = next((c for c in cols if c and c.lower() in ("descricao", "descrição", "texto", "relato", "text")), None)
        if not pref:
            pref = max(cols, key=lambda c: sum(len(l.get(c) or "") for l in linhas))
        return [(l.get(pref) or "") for l in linhas], f"coluna usada: {pref}"
    if nome.lower().endswith(".txt") or not nome:
        return t.splitlines(), "cada linha do TXT é um relato"
    raise ValueError("formato não aceito (use CSV ou TXT)")


def norm(t):
    t = unicodedata.normalize("NFC", t).lower()
    t = re.sub(r"https?://\S+|\S+@\S+|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def tokens(t): return [w for w in re.findall(r"[a-zà-ÿ]{3,}", norm(t)) if w not in STOP]


def analisar(nome, dados, k=None, limiar_semelhante=0.6):
    brutos, nota = ler(nome, dados)
    vazios = sum(1 for x in brutos if not x.strip())
    docs = [x.strip() for x in brutos if x.strip()]
    if len(docs) < 3: raise ValueError("são necessários pelo menos 3 relatos não vazios")
    vistos, unicos, dup = set(), [], 0
    for d in docs:
        c = norm(d)
        if c in vistos: dup += 1; continue
        vistos.add(c); unicos.append(d)
    toks = [tokens(d) for d in unicos]
    freq = collections.Counter(w for t in toks for w in t)
    big = collections.Counter(" ".join(t[i:i + 2]) for t in toks for i in range(len(t) - 1))
    vec = TfidfVectorizer(tokenizer=tokens, token_pattern=None, lowercase=False, ngram_range=(1, 2), min_df=1)
    X = vec.fit_transform(unicos)
    k = k or max(2, min(6, len(unicos) // 4))
    k = min(k, len(unicos))
    km = KMeans(n_clusters=k, n_init=10, random_state=0).fit(X)
    termos = np.array(vec.get_feature_names_out()); temas = []
    for i in range(k):
        idx = np.where(km.labels_ == i)[0]
        top = termos[np.argsort(-km.cluster_centers_[i])[:5]]
        temas.append({"tema": i + 1, "termos": list(top), "relatos": int(len(idx)), "exemplos": [unicos[j][:140] for j in idx[:2]]})
    S = (X @ X.T).toarray(); np.fill_diagonal(S, 0)
    pares = [(i, j, float(S[i, j])) for i in range(len(unicos)) for j in range(i + 1, len(unicos)) if S[i, j] >= limiar_semelhante]
    pares.sort(key=lambda p: -p[2])
    semelhantes = [{"a": unicos[i][:140], "b": unicos[j][:140], "similaridade": round(s, 2)} for i, j, s in pares[:15]]
    tam = [len(t) for t in toks]
    return {"nota": nota, "relatos_lidos": len(brutos), "vazios_descartados": vazios, "duplicados_removidos": dup, "relatos_analisados": len(unicos),
            "tokens_medios": round(sum(tam) / len(tam), 1), "vocabulario": len(freq),
            "termos": freq.most_common(20), "expressoes": [b for b in big.most_common(12) if b[1] > 1], "temas": temas, "semelhantes": semelhantes,
            "resumo": "Principais assuntos: " + "; ".join(f"tema {t['tema']} ({t['relatos']} relatos): {', '.join(t['termos'][:3])}" for t in sorted(temas, key=lambda x: -x['relatos'])),
            "decisoes": ["minúsculas, NFC, remoção de URLs, e-mails e CPFs antes de contar", "palavras muito comuns removidas só para contagem e temas", "relatos vazios descartados, repetidos exatos contados uma vez",
                         "temas por KMeans sobre TF-IDF (agrupamento não supervisionado; os temas precisam de leitura humana)", "frequência de um termo não mede urgência"]}


def exportar_csv(r):
    b = io.StringIO(); w = csv.writer(b); w.writerow(["tipo", "item", "valor"])
    for t, n in r["termos"]: w.writerow(["termo", t, n])
    for t in r["temas"]: w.writerow(["tema", f"tema {t['tema']}: " + ", ".join(t["termos"]), t["relatos"]])
    for s in r["semelhantes"]: w.writerow(["semelhantes", s["a"] + " || " + s["b"], s["similaridade"]])
    return b.getvalue()
