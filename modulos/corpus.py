"""Fábrica de Corpus CitizenTech: ingestão, extração, limpeza, normalização, anonimização, segmentação e geração de 3 corpus JSONL.
Não remove stop words nem faz stemming (o texto precisa continuar natural)."""
import collections, io, json, random, re, unicodedata
from pathlib import Path

NOMES = set("""Ana Maria João José Antonio Antônio Carlos Paulo Pedro Lucas Luiz Luís Marcos Marcelo Rafael Fernando Rodrigo Ricardo Gabriel Daniel Bruno Felipe Francisco
Juliana Fernanda Patricia Patrícia Aline Camila Amanda Bruna Jessica Jéssica Larissa Letícia Luciana Mariana Beatriz Cláudia Claudia Sandra Sônia Sonia Tânia Tania
Eduardo Roberto Sérgio Sergio Alexandre André Andre Fábio Fabio Gustavo Leonardo Henrique Vinicius Vinícius Thiago Tiago Diego Renato Márcio Marcio Wolkoff Jeniffer Faria Jr Giorgi Mamede Silva Santos Oliveira Souza Pereira Costa Rodrigues Almeida Nascimento Lima Araújo Fernandes Carvalho Gomes Martins Rocha Ribeiro Alves Monteiro""".split())
PADROES = [("CPF", r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", "[CPF]"), ("CNPJ", r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b", "[CNPJ]"),
           ("EMAIL", r"[\w.+-]+@[\w-]+(\.[\w-]+)+", "[EMAIL]"),
           ("TELEFONE", r"(?<!\d)(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}(?!\d)", "[TELEFONE]"),
           ("TELEFONE", r"(?<!\d)\d{3,4}\s*/\s*\d{4}\s*-\s*\d{4}(?!\d)", "[TELEFONE]"), ("TELEFONE", r"(?<!\d)\d{3,4}-\d{4}(?!\d)", "[TELEFONE]")]
TITULOS = re.compile(r"\b(Sr\.|Sra\.|Srta\.|Dr\.|Dra\.|Prof\.|Profa\.|senhor|senhora|doutor|doutora)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wáéíóúâêôãõç]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wáéíóúâêôãõç]+){0,3})")
URL = re.compile(r"(https?://\S+|www\.\S+)")
SIGLAS_NAO_NOME = {"Defesa", "Civil", "Saúde", "Brasil"}


def ntok(t): return len(re.findall(r"\w+|[^\w\s]", t, re.UNICODE))


def extrair(nome, dados):
    """Devolve lista de (origem, texto). origem = arquivo + página/seção."""
    ext = Path(nome).suffix.lower(); out = []
    if ext == ".pdf":
        import pypdf
        for i, p in enumerate(pypdf.PdfReader(io.BytesIO(dados)).pages, 1):
            out.append((f"{nome}#p{i}", p.extract_text() or ""))
    elif ext == ".docx":
        import docx
        d = docx.Document(io.BytesIO(dados)); out.append((nome, "\n".join(p.text for p in d.paragraphs)))
    elif ext in (".html", ".htm"):
        from bs4 import BeautifulSoup
        s = BeautifulSoup(dados.decode("utf-8", "replace"), "html.parser")
        for t in s(["script", "style", "nav", "footer", "header"]): t.decompose()
        out.append((nome, s.get_text("\n")))
    elif ext in (".txt", ".md", ""):
        t = dados.decode("utf-8", "replace")
        if ext == ".md": t = re.sub(r"^#+\s*", "", t, flags=re.M)
        out.append((nome, t))
    else:
        raise ValueError(f"formato não aceito: {ext} (use PDF, TXT, DOCX ou HTML)")
    return out


def limpar(paginas):
    """paginas: lista de (origem, texto). Remove cabeçalhos/rodapés repetidos, numeração, URLs, caracteres estranhos; junta hifenização."""
    cont = collections.Counter()
    for _, t in paginas:
        for l in {x.strip() for x in t.splitlines() if x.strip()}: cont[l] += 1
    rep = {l for l, n in cont.items() if n >= 3 and len(paginas) >= 3 and len(l) < 120}
    saida, removidas = [], collections.Counter()
    for o, t in paginas:
        linhas = []
        for l in t.splitlines():
            s = l.strip()
            if not s: linhas.append(""); continue
            if s in rep: removidas["cabeçalho/rodapé repetido"] += 1; continue
            if re.fullmatch(r"(?:p[áa]gina\s*)?\d{1,4}(?:\s*(?:/|de)\s*\d{1,4})?|[-–—\s]*\d{1,4}[-–—\s]*", s, re.I): removidas["numeração de página"] += 1; continue
            if URL.search(s): removidas["URL"] += len(URL.findall(s)); s = URL.sub("", s).strip()
            linhas.append(s)
        txt = "\n".join(linhas)
        txt = re.sub(r"(\w)-\n(\w)", r"\1\2", txt)
        txt = re.sub(r"[^\S\n]+", " ", txt)
        txt = "".join(c for c in txt if c == "\n" or unicodedata.category(c)[0] != "C")
        saida.append((o, txt))
    # linhas repetidas consecutivas
    return saida, dict(removidas)


def normalizar(t):
    t = unicodedata.normalize("NFC", t).replace("﻿", "")
    t = t.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'").replace("«", '"').replace("»", '"')
    t = re.sub(r"\r\n?", "\n", t); t = re.sub(r"[ \t]+", " ", t); t = re.sub(r"\n{3,}", "\n\n", t)
    t = re.sub(r"(?<![.!?:;\n])\n(?!\n)", " ", t)   # une quebras de linha dentro de frases
    return t.strip()


def anonimizar(t):
    cont = collections.Counter()
    for nome, rx, marca in PADROES:
        t, n = re.subn(rx, marca, t); cont[nome] += n
    def _tit(m):
        cont["NOME"] += 1; return f"{m.group(1)} [NOME]"
    t = TITULOS.sub(_tit, t)
    def _seq(m):
        p = m.group(0).split()
        if sum(1 for w in p if w in NOMES) >= 2: cont["NOME"] += 1; return "[NOME]"
        return m.group(0)
    t = re.sub(r"\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+){1,3}\b", _seq, t)
    return t, {k: v for k, v in cont.items() if v}


def frases(t):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ\"(\d])", t) if s.strip()]


def segmentar(texto, minimo=256, maximo=300):
    """Junta frases inteiras até chegar perto de `maximo` tokens; um trecho final curto é anexado ao anterior se couber."""
    trechos, atual, n = [], [], 0
    for f in frases(texto):
        k = ntok(f)
        if k > maximo:
            f = " ".join(f.split()[: maximo // 2]); k = ntok(f)
        if atual and n + k > maximo:
            trechos.append(" ".join(atual)); atual, n = [], 0
        atual.append(f); n += k
    if atual:
        if trechos and n < minimo and ntok(trechos[-1]) + n <= maximo: trechos[-1] += " " + " ".join(atual)
        else: trechos.append(" ".join(atual))
    return trechos


SISTEMA = "Você é um atendente de serviços públicos. Responda de forma simples e educada, só com base nos documentos oficiais."
RECUSAS = [("Qual é a receita de bolo de cenoura?", "Não tenho informação sobre isso. Só posso ajudar com os temas dos documentos oficiais usados aqui."),
           ("Quem vai ganhar o campeonato este ano?", "Esse assunto está fora do que posso responder. Posso ajudar com dúvidas sobre os serviços públicos tratados nos documentos."),
           ("Qual remédio devo tomar para dor de cabeça forte?", "Não posso indicar remédios. Procure um médico ou uma Unidade Básica de Saúde."),
           ("Posso processar meu vizinho por causa do barulho?", "Para saber seus direitos no seu caso, procure um advogado ou a Defensoria Pública."),
           ("Como investir meu dinheiro na bolsa?", "Esse tema está fora do meu alcance. Procure um profissional de finanças."),
           ("Me diga o CPF de outra pessoa.", "Não posso informar dados pessoais de ninguém. Isso é protegido pela LGPD."),
           ("Qual o diagnóstico para minha febre há três dias?", "Não posso fazer diagnóstico. Procure atendimento médico em uma Unidade Básica de Saúde ou ligue 192 se for urgente."),
           ("Vou ganhar a causa na Justiça?", "Não posso prever resultados de processos. Converse com um advogado ou com a Defensoria Pública."),
           ("Qual a previsão do tempo para amanhã?", "Esse tema está fora do que posso responder. Consulte um serviço de meteorologia."),
           ("Quanto tempo a prefeitura leva para resolver meu problema?", "Não posso prometer prazos. Procure o órgão responsável para saber o andamento."),
           ("Pode escrever meu trabalho de escola?", "Esse tipo de pedido está fora do que posso fazer. Posso explicar o conteúdo dos documentos oficiais.")]


_RUIM = re.compile(r"(mente|ados?|idos?|adas?|idas?|ando|endo|indo|ar|er|ir|ões|ção)$")
_FICHA = re.compile(r"Creative Commons|reprodução|Tiragem|Modo de acesso|ISBN|Departamento|Secretaria|Ministério d|Biblioteca Virtual|Brasília|Elaboração|Impresso|Edição|edição|licen[çc]a|direitos autorais", re.I)
_STOP = set("desde intensas quando durante porque assim ainda sobre entre contra apenas outros outras todos todas cada mesmo mesma também depois antes onde essa esse esta este aquele aquela seus suas pelo pela pelos pelas para como mais menos muito muita sempre nunca algum alguma qualquer".split())


_DET = {"a","o","as","os","um","uma","uns","umas","de","do","da","dos","das","no","na","nos","nas","com","sem","para","pelo","pela","seu","sua","seus","suas","esse","essa","este","esta","em","por","ao","aos"}
_NAO_ASSUNTO = set("próxima próximo próximas próximos possível possíveis outra outro grande grandes pequeno pequena melhor maior menor geral gerais mesma local locais devido forma tipo tipos parte partes caso casos vez vezes modo lugar quais qualquer algum alguma nenhum nenhuma primeiro primeira segundo segunda terceiro todo toda demais diversos diversas vários várias semana semanas mínimo máximo centro meses dias horas minutos anos ano casas lado dentro fora meio ponto pontos exemplo exemplos algumas alguns".split())


def _termos(f):
    """Assuntos candidatos: palavras que aparecem depois de artigo, preposição ou possessivo (posição de substantivo),
    sem verbos no imperativo, advérbios, adjetivos genéricos ou formas verbais."""
    toks = re.findall(r"[A-Za-zÀ-ÿ]+", f)
    out = []
    for i, w in enumerate(toks):
        lw = w.lower()
        if len(lw) < 5 or lw in _STOP or lw in _NAO_ASSUNTO or _RUIM.search(lw): continue
        if i == 0 or toks[i - 1].lower() not in _DET: continue
        out.append(lw)
    return out


def gerar_qa(trechos_fonte):
    """Pergunta pelo termo mais raro da frase (IDF no conjunto); descarta fragmentos de lista e frases sem sentido isolado."""
    todas = []
    for fonte, t in trechos_fonte:
        for f in frases(t):
            n = len(f.split())
            if not 8 <= n <= 40 or f.count("[") > 1 or "\n" in f or "•" in f: continue
            if not re.match(r"^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]", f) or not f.endswith((".", "!", "?")): continue
            if re.match(r"^\d+[.)]", f) or _FICHA.search(f): continue
            todas.append((fonte, f))
    df = collections.Counter(w for _, f in todas for w in set(_termos(f)))
    pares = []
    for fonte, f in todas:
        ts = _termos(f)
        m = re.match(r"^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^,.;:]{2,60}?)\s+(é|são|significa|servem para|serve para)\s+(.+)$", f)
        if m: q = f"O que {'é' if m.group(2) in ('é','significa') else 'são'} {m.group(1).lower() if m.group(1).split()[0].lower() in ('a','o','as','os') else m.group(1)}?"
        elif ts:
            k = min(ts, key=lambda w: (df[w] if df[w] > 1 else 999, -len(w)))
            q = (f"O que o documento orienta sobre {k}?" if re.search(r"\b(deve|devem|pode|podem|precisa|precisam|evite|procure|use|lave|mantenha)\b", f, re.I)
                 else f"O que o documento informa sobre {k}?")
        else: continue
        pares.append({"instruction": q, "input": "", "output": f, "fonte": fonte})
    return pares


def gerar_chat(qa, n=40, seed=7):
    por = collections.defaultdict(list)
    for p in qa: por[p["fonte"]].append(p)
    out = []
    for fonte, ps in por.items():
        for i in range(0, len(ps) - 1, 2):
            a, b = ps[i], ps[i + 1]
            out.append({"messages": [{"role": "system", "content": SISTEMA}, {"role": "user", "content": a["instruction"]}, {"role": "assistant", "content": a["output"]},
                                     {"role": "user", "content": b["instruction"]}, {"role": "assistant", "content": b["output"]}], "fonte": fonte})
    random.Random(seed).shuffle(out)
    return out[:n] if n else out


def _chave(x): return re.sub(r"\W+", " ", json.dumps(x, ensure_ascii=False, sort_keys=True).lower()).strip()


def sem_duplicatas(lista, campo=None):
    vistos, out = set(), []
    for x in lista:
        k = re.sub(r"\W+", " ", (x[campo] if campo else _chave(x)).lower()).strip()
        if k in vistos: continue
        vistos.add(k); out.append(x)
    return out, len(lista) - len(out)


def processar(arquivos, texto_colado="", minimos=(50, 100, 30), semente=7):
    """arquivos: lista de (nome, bytes). Devolve dict com corpus, estatísticas e antes/depois da anonimização."""
    paginas, avisos = [], []
    for nome, dados in arquivos:
        try: paginas += extrair(nome, dados)
        except Exception as e: avisos.append(f"{nome}: {e}")
    if texto_colado.strip(): paginas.append(("texto_colado", texto_colado))
    if not paginas: raise ValueError("nenhum documento válido; " + "; ".join(avisos))
    por_arq = collections.OrderedDict()
    for o, t in paginas: por_arq.setdefault(o.split("#")[0], []).append((o, t))
    n_paginas_pdf = sum(len(v) for k, v in por_arq.items() if k.lower().endswith(".pdf"))
    removidas, anon_tot, antes_depois = collections.Counter(), collections.Counter(), []
    texto, trechos = [], []
    for arq, pgs in por_arq.items():
        lim, rem = limpar(pgs); removidas.update(rem)
        bruto = normalizar("\n\n".join(t for _, t in lim))
        an, c = anonimizar(bruto); anon_tot.update(c)
        if c and len(antes_depois) < 3:
            for a, b in zip(frases(bruto), frases(an)):
                if a != b: antes_depois.append({"antes": a[:300], "depois": b[:300], "fonte": arq}); break
        for t in segmentar(an):
            ps = re.findall(r"\w+", t); cap = sum(1 for w in ps if w[0].isupper())
            if ps and cap / len(ps) > 0.33: continue   # página de créditos/equipe: quase só nomes próprios
            trechos.append({"text": t, "fonte": arq})
        texto.append((arq, an))
    trechos, dup_t = sem_duplicatas(trechos, "text")
    qa, dup_q = sem_duplicatas(gerar_qa(texto) , "instruction")  # perguntas repetidas (mesmo tema) removidas
    qa2 = []
    vistos = set()
    for p in qa:
        k = re.sub(r"\W+", " ", p["output"].lower())
        if k not in vistos: vistos.add(k); qa2.append(p)
    qa = qa2
    for i, (q, r) in enumerate(RECUSAS): qa.append({"instruction": q, "input": "", "output": r, "fonte": "regras_de_limite"})
    chat = gerar_chat([p for p in qa if p["fonte"] != "regras_de_limite"], n=0, seed=semente)
    for i in range(0, len(RECUSAS) - 1, 2):
        chat.append({"messages": [{"role": "system", "content": SISTEMA}, {"role": "user", "content": RECUSAS[i][0]}, {"role": "assistant", "content": RECUSAS[i][1]},
                                  {"role": "user", "content": RECUSAS[i + 1][0]}, {"role": "assistant", "content": RECUSAS[i + 1][1]}], "fonte": "regras_de_limite"})
    chat, dup_c = sem_duplicatas(chat)
    corp = {"corpus_texto.jsonl": trechos, "corpus_qa.jsonl": qa, "corpus_chat.jsonl": chat}
    rnd = random.Random(semente); est = {}
    for nome, c in corp.items():
        toks = [ntok(x["text"]) if "text" in x else ntok(json.dumps(x, ensure_ascii=False)) for x in c]
        est[nome] = {"exemplos": len(c), "media_tokens": round(sum(toks) / len(toks), 1) if toks else 0, "amostras": rnd.sample(c, min(5, len(c)))}
    est["corpus_texto.jsonl"]["minimo"] = minimos[0]; est["corpus_qa.jsonl"]["minimo"] = minimos[1]; est["corpus_chat.jsonl"]["minimo"] = minimos[2]
    for nome in est: est[nome]["atingiu_minimo"] = est[nome]["exemplos"] >= est[nome]["minimo"]
    est["duplicatas_removidas"] = {"texto": dup_t, "qa": dup_q + (len(qa2) - len(qa) if False else 0), "chat": dup_c}
    return {"corpus": corp, "estatisticas": est, "documentos": {k: len(v) for k, v in por_arq.items()}, "paginas_pdf": n_paginas_pdf, "paginas_ou_secoes": len(paginas),
            "removido_na_limpeza": dict(removidas), "anonimizado": dict(anon_tot), "antes_depois": antes_depois, "avisos": avisos,
            "alertas": ([f"Entrada tem {n_paginas_pdf} páginas de PDF; o enunciado pede pelo menos 20 páginas no total."] if n_paginas_pdf < 20 else []) +
                       ([f"{k} abaixo do mínimo ({est[k]['exemplos']}/{est[k]['minimo']})." for k in corp if not est[k]["atingiu_minimo"]])}


def jsonl(lista): return "\n".join(json.dumps(x, ensure_ascii=False) for x in lista) + "\n"


def gravar(res, pasta):
    p = Path(pasta); p.mkdir(parents=True, exist_ok=True)
    for nome, c in res["corpus"].items(): (p / nome).write_text(jsonl(c), encoding="utf-8")
