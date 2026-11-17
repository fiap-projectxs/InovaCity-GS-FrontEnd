"""Compara execução simples e paralela (multiprocessing) do pré-processamento de texto da Fábrica de Corpus.
Uso: python -m modulos.benchmark_cluster   (na raiz da plataforma). Resultado salvo em dados_servidor/benchmark_cluster.json"""
import json, multiprocessing as mp, os, platform, statistics, sys, time
from pathlib import Path
RAIZ = Path(__file__).resolve().parent.parent; sys.path.insert(0, str(RAIZ))
from modulos import corpus

BASE = " ".join(f.read_text(encoding="utf-8") for f in sorted((RAIZ / "inovabot" / "base_conhecimento").glob("*.md")))
N = 400


def tarefa(i):
    t = corpus.normalizar(BASE); t, _ = corpus.anonimizar(t); return len(corpus.segmentar(t))


def medir(f, rep=5):
    v = []
    for _ in range(rep):
        t0 = time.perf_counter(); f(); v.append(time.perf_counter() - t0)
    return round(statistics.median(v), 3), round(min(v), 3), round(max(v), 3)


if __name__ == "__main__":
    r = {"hardware": {"cpus": os.cpu_count(), "so": platform.platform(), "python": platform.python_version()}, "tarefas": N, "repeticoes": 5}
    r["serial_s(mediana,min,max)"] = medir(lambda: [tarefa(i) for i in range(N)])
    for w in range(2, (os.cpu_count() or 2) + 1):
        def par(w=w):
            with mp.Pool(w) as p: p.map(tarefa, range(N), chunksize=10)
        r[f"{w}_processos_s(mediana,min,max)"] = medir(par)
    r["observacao"] = "Máquina única, vários processos; não é um cluster de várias máquinas."
    (RAIZ / "dados_servidor").mkdir(exist_ok=True); (RAIZ / "dados_servidor" / "benchmark_cluster.json").write_text(json.dumps(r, ensure_ascii=False, indent=1))
    print(json.dumps(r, ensure_ascii=False, indent=1))
