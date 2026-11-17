"""Protecoes que rodam ANTES e DEPOIS do modelo: dados pessoais, emergencia, injecao de instrucoes e fundamentacao."""
import re
from rag import norm, tokens, STOP

# ---- dados pessoais (regras; nomes de pessoas NAO sao detectados) ----
_PII = [
    ("cpf", re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")),  # 11 digitos sem pontuacao so valem se os digitos verificadores baterem
    ("cnpj", re.compile(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b")),
    ("email", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
    ("telefone", re.compile(r"(?<!\d)(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}(?!\d)")),
    ("telefone", re.compile(r"(?<!\d)\d{10,13}(?!\d)")),  # sequencias longas de digitos (mesmo com digito a mais ou a menos)
    ("placa", re.compile(r"\b[A-Za-z]{3}-?\d[A-Za-z0-9]\d{2}\b")),
    ("cep", re.compile(r"\b\d{5}-\d{3}\b")),
]


def _cpf_valido(txt):
    d = [int(c) for c in txt if c.isdigit()]
    if len(d) != 11 or len(set(d)) == 1:
        return False
    for n in (9, 10):
        v = sum(d[i] * (n + 1 - i) for i in range(n)) * 10 % 11 % 10
        if v != d[n]:
            return False
    return True


def ocultar_pii(texto):
    achados, saida = [], texto
    for nome, rx in _PII:
        def sub(m, nome=nome):
            if nome == "cpf" and m.group(0).isdigit() and not _cpf_valido(m.group(0)):
                return m.group(0)  # 11 digitos soltos que nao sao CPF: deixa para a regra de telefone
            achados.append(nome)
            return f"[{nome.upper()} OCULTO]"
        saida = rx.sub(sub, saida)
    return saida, sorted(set(achados))


# ---- emergencia: situacao de risco imediato nao deve ser tratada pelo assistente ----
_EMERG = [r"inc[eê]ndi", r"\bfogo\b", r"pegando fogo", r"desab", r"desmoron", r"fio.{0,15}(ca[ií]d|solt|exposto|desencapad).{0,40}(fa[ií]sc|choque|rua)|fa[ií]sc",
          r"vazamento de g[aá]s|cheiro de g[aá]s", r"afog", r"ferid[oa]s?\b", r"desmai", r"inconsciente", r"socorro",
          r"\bsamu\b|ambul[aâ]ncia", r"parou de respirar|infarto|convuls", r"send[oa]\s*(assaltad|agredid|atacad|ameaçad|perseguid|sequestrad)|(estou|fui|fomos|estamos|sou|fui)\s*(atacad|ameaçad|agredid|assaltad|perseguid)|\b(ataque|ameaç\w*|sequestr\w*|estupr\w*|agress[aã]o)\b|tiroteio|\barma\b|me (bater|matar)|vão me (bater|matar)",
          r"(risco|perigo) de vida|correndo risco de morrer|vai morrer"]
_EMERG_RX = re.compile("|".join(_EMERG), re.I)
MSG_EMERGENCIA = ("Isto parece uma emergência. A InovaCity não atende emergências e não tem prazo de resposta. "
                  "Ligue agora: Bombeiros 193, SAMU 192, Polícia Militar 190 ou Defesa Civil 199. "
                  "Depois que a situação passar, você pode registrar o problema de infraestrutura na página Nova ocorrência.")


def eh_emergencia(texto):
    return bool(_EMERG_RX.search(str(texto)))


# ---- tentativa de mudar as instrucoes do assistente ----
_INJ = re.compile(r"ignor[ea].{0,40}(instru|regras|anteriores|infos?\b|informa|orienta|comandos|prompt)|"
                  r"(passe|passa|mostr[ae]|revele|diga|exiba|me d[eê]|qual [eé]).{0,25}(system|sistema|s[yi]st[ae]m|seu|suas?) ?(prompt|instru|regras)|s[yi]st[ae]m prompt|"
                  r"esque[cç]a.{0,25}(instru|regras)|desconsidere.{0,25}(instru|regras)|"
                  r"voc[eê] agora [eé]|finja (ser|que)|aja como|modo desenvolvedor|reveal.{0,15}prompt|mostre (o )?(seu )?prompt|"
                  r"prompt do sistema|system prompt|ignore (all|previous)", re.I)


def tenta_injecao(texto):
    return bool(_INJ.search(str(texto)))


# ---- fundamentacao da resposta gerada ----
def citacoes(resposta):
    return re.findall(r"\[(\d{2}_[a-z_]+)(?:#\d+)?\]", resposta)


def fundamentada(resposta, contexto, minimo=0.6):
    """Parte das palavras de conteudo da resposta que aparece no contexto recuperado. Barata e imperfeita:
    detecta resposta que fugiu do contexto, nao detecta erro sutil com as mesmas palavras."""
    ctx = set(tokens(contexto))
    r = [w for w in tokens(re.sub(r"\[[^\]]*\]", " ", resposta)) if not w.isdigit()]
    if not r:
        return 0.0, False
    p = sum(w in ctx for w in r) / len(r)
    return p, p >= minimo
