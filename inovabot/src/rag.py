"""RAG da InovaCity: base de conhecimento em Markdown -> trechos (chunks) -> recuperacao lexical (BM25 / TF-IDF).

Tudo roda offline com numpy e scikit-learn. A recuperacao densa (embeddings) fica no modo LLM, em llm.py.
"""
import math, re, unicodedata
from collections import Counter
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

BASE = Path(__file__).resolve().parent.parent / "base_conhecimento"

STOP = set("""a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sobre entre e ou mas que se ja
mais muito muita como qual quais quando onde quem eu me meu minha meus minhas voce vc ele ela eles elas nao sim ao aos
isso isto esse essa esses essas este esta estes estas ser sao foi tem ter tenho pode posso podem faz fazer fazem
site pagina""".split())


def norm(t):
    t = unicodedata.normalize("NFKD", str(t).lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9 ]+", " ", t)


_SUF = ("mente", "acoes", "acao", "idades", "idade", "adores", "ador", "ismos", "oes", "ões", "ais", "eis", "res", "ns",
        "s", "es", "ando", "endo", "indo", "ar", "er", "ir", "ado", "ido", "ada", "ida")


def stem(w):
    for s in _SUF:
        if len(w) - len(s) >= 4 and w.endswith(s):
            return w[: -len(s)]
    return w


def tokens(t, usar_stem=True, stop=True):
    out = []
    for w in norm(t).split():
        if len(w) < 2 or (stop and w in STOP):
            continue
        out.append(stem(w) if usar_stem else w)
    return out


def carregar_kb(pasta=BASE):
    """Cada secao (## ...) de cada arquivo vira um trecho. O titulo do documento entra no texto indexado."""
    chunks = []
    for f in sorted(Path(pasta).glob("*.md")):
        txt = f.read_text(encoding="utf-8")
        titulo = re.search(r"^# (.+)$", txt, re.M).group(1).strip()
        partes = re.split(r"^## (.+)$", txt, flags=re.M)
        for i in range(1, len(partes), 2):
            chunks.append({"id": f"{f.stem}#{(i + 1) // 2}", "doc": f.stem, "titulo": titulo,
                           "secao": partes[i].strip(), "texto": partes[i + 1].strip()})
    return chunks


def indexado(c):
    return f"{c['titulo']}. {c['secao']}. {c['texto']}"


class BM25:
    def __init__(self, docs, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.tf = [Counter(d) for d in docs]
        self.len = np.array([len(d) for d in docs], float)
        self.avg = self.len.mean() or 1.0
        df = Counter(w for d in docs for w in set(d))
        n = len(docs)
        self.idf = {w: math.log(1 + (n - c + 0.5) / (c + 0.5)) for w, c in df.items()}

    def scores(self, q):
        s = np.zeros(len(self.tf))
        for w in set(q):
            if w not in self.idf:
                continue
            for i, tf in enumerate(self.tf):
                f = tf.get(w, 0)
                if f:
                    s[i] += self.idf[w] * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * self.len[i] / self.avg))
        return s


class Recuperador:
    """modo: tfidf | bm25 | bm25_stem | hibrido (fusao por posicao de bm25_stem e tf-idf de caracteres)."""

    def __init__(self, chunks=None, modo="hibrido"):
        self.chunks = chunks or carregar_kb()
        self.modo = modo
        txt = [indexado(c) for c in self.chunks]
        self.tfidf = TfidfVectorizer(preprocessor=norm, ngram_range=(1, 2), sublinear_tf=True)
        self.Xw = self.tfidf.fit_transform(txt)
        self.tfidf_s = TfidfVectorizer(tokenizer=lambda t: tokens(t), preprocessor=None, lowercase=False, sublinear_tf=True, token_pattern=None)
        self.Xs = self.tfidf_s.fit_transform(txt)
        self.char = TfidfVectorizer(preprocessor=norm, analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)
        self.Xc = self.char.fit_transform(txt)
        self.bm = BM25([tokens(t, False, False) for t in txt])
        self.bms = BM25([tokens(t) for t in txt])

    def _sc(self, q, modo):
        if modo == "tfidf":
            return (self.Xw @ self.tfidf.transform([q]).T).toarray().ravel()
        if modo == "tfidf_stem":
            return (self.Xs @ self.tfidf_s.transform([q]).T).toarray().ravel()
        if modo == "bm25":
            return self.bm.scores(tokens(q, False, False))
        if modo == "bm25_stem":
            return self.bms.scores(tokens(q))
        if modo == "char":
            return (self.Xc @ self.char.transform([q]).T).toarray().ravel()
        raise ValueError(modo)

    def pontuar(self, q, modo=None):
        modo = modo or self.modo
        if modo != "hibrido":
            return self._sc(q, modo)
        r = np.zeros(len(self.chunks))
        for m in ("bm25_stem", "char"):
            s = self._sc(q, m)
            ordem = np.argsort(-s)
            for pos, i in enumerate(ordem):
                r[i] += 1.0 / (60 + pos + 1)       # fusao por posicao reciproca (RRF)
        return r

    def buscar(self, q, k=3, modo=None):
        s = self.pontuar(q, modo)
        ordem = np.argsort(-s)[:k]
        return [(float(s[i]), self.chunks[i]) for i in ordem]

    def similaridade(self, q):
        """Cosseno TF-IDF (com radical) entre a pergunta e o melhor trecho: escala 0-1, usada para recusar fora de escopo."""
        s = self._sc(q, "tfidf_stem")
        return float(s.max())


def frases(texto):
    return [f.strip() for f in re.split(r"(?<=[.!?])\s+", texto) if f.strip()]
