"""Fábrica de Corpus pela linha de comando. Uso: python corpus_cli.py doc1.pdf doc2.docx doc3.html --saida corpus/ [--texto "texto colado"]
Gera corpus_texto.jsonl, corpus_qa.jsonl e corpus_chat.jsonl e imprime o relatório de qualidade."""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from modulos import corpus

ap = argparse.ArgumentParser(); ap.add_argument("arquivos", nargs="*"); ap.add_argument("--saida", default="corpus"); ap.add_argument("--texto", default="")
a = ap.parse_args()
r = corpus.processar([(Path(f).name, Path(f).read_bytes()) for f in a.arquivos], a.texto)
corpus.gravar(r, a.saida)
E = r["estatisticas"]
for k in ("corpus_texto.jsonl", "corpus_qa.jsonl", "corpus_chat.jsonl"):
    print(f"{k}: {E[k]['exemplos']} exemplos (mínimo {E[k]['minimo']}), média {E[k]['media_tokens']} tokens")
print("duplicatas removidas:", E["duplicatas_removidas"]); print("removido na limpeza:", r["removido_na_limpeza"]); print("anonimizado:", r["anonimizado"])
for x in r["antes_depois"]: print("ANTES: ", x["antes"]); print("DEPOIS:", x["depois"])
for k in ("corpus_texto.jsonl", "corpus_qa.jsonl", "corpus_chat.jsonl"):
    print("5 exemplos de", k)
    for e in E[k]["amostras"]: print(" ", json.dumps(e, ensure_ascii=False)[:300])
for al in r["alertas"]: print("ATENÇÃO:", al)
