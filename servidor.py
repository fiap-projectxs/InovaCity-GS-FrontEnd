"""Servidor único da plataforma InovaCity: site (front-end), InovaBot (RAG + Qwen no Ollama), robô de RPA e Gradio.
Uso: python servidor.py [--porta 8000] [--sem-navegador]
Só escuta em 127.0.0.1. Sem dependências além das do InovaBot (numpy, scikit-learn); Gradio é opcional."""
import argparse, ast, collections, hashlib, hmac, json, mimetypes, os, secrets, subprocess, sys, tempfile, threading, time, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import base64, urllib.parse
from urllib.parse import urlparse, parse_qs

RAIZ = Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ / "inovabot" / "src")); sys.path.insert(0, str(RAIZ))
SITE, RPA_SITE, RPA = RAIZ / "site", RAIZ / "rpa" / "site", RAIZ / "rpa"
MAX_CORPO = 300_000
MAX_UPLOAD = 60_000_000

estado = {"assistente": None, "gradio": None, "erro_gradio": None, "iot": None, "detector": None, "corpus": None, "analise": None}
ADMIN_EMAILS = {"admin", "admin@inovacity.demo"}
ADMIN_SAL, ADMIN_HASH = b"inovacity-admin-sal", "cf62914f744583a6a60c6503f82b770be5da5f4d5895c9b26b8fb66da2387fc3"
tokens = set()
conversas = collections.deque(maxlen=500)
LOG = RAIZ / "dados_servidor" / "conversas.jsonl"


def registrar(msg, r):
    """Guarda a pergunta já sem dados pessoais, o tipo de resposta e as fontes."""
    from guardrails import ocultar_pii
    e = {"t": time.strftime("%Y-%m-%d %H:%M:%S"), "q": ocultar_pii(msg)[0][:200], "tipo": r.get("tipo"), "fontes": r.get("fontes", []),
         "sim": r.get("similaridade"), "modo": r.get("modo")}
    conversas.append(e)
    try:
        LOG.parent.mkdir(exist_ok=True)
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    except OSError:
        pass


def resumo_admin():
    por_tipo = collections.Counter(c["tipo"] for c in conversas)
    docs = collections.Counter(d for c in conversas for d in c["fontes"])
    sims = [c["sim"] for c in conversas if c["sim"] is not None]
    return {**status(), "total": len(conversas), "por_tipo": dict(por_tipo), "docs": docs.most_common(8),
            "sim_media": round(sum(sims) / len(sims), 3) if sims else None,
            "sem_resposta": [c["q"] for c in conversas if c["tipo"] == "fora_de_escopo"][-20:], "ultimas": list(conversas)[-50:][::-1]}
trava = threading.Lock()


def carregar_assistente(preferido=None):
    from llm import criar_llm
    from agente import Assistente
    with trava:
        estado["assistente"] = Assistente(criar_llm(preferido or os.getenv("INOVACITY_LLM", "auto")))
    return estado["assistente"]


def status():
    a = estado["assistente"]
    return {"ok": True, "modelo": a.llm.nome, "generativo": bool(a.llm.generativo), "gradio": estado["gradio"], "erro_gradio": estado["erro_gradio"]}


def iniciar_gradio(porta):
    try:
        from gradio_relato import criar_app
        app = criar_app(estado["assistente"], trava)
        try:
            app.launch(server_name="127.0.0.1", server_port=porta, prevent_thread_lock=True, show_api=False, inbrowser=False, quiet=True)
        except TypeError:
            app.launch(server_name="127.0.0.1", server_port=porta, prevent_thread_lock=True)
        estado["gradio"] = f"http://127.0.0.1:{porta}"
    except Exception as e:  # noqa: BLE001
        estado["erro_gradio"] = f"{type(e).__name__}: {e}"
        print(f"[aviso] Gradio indisponível ({estado['erro_gradio']}). O site usa o formulário próprio de redigir relato.")


def rodar_robo(csv_texto=None):
    """Executa o robô de RPA (Python) em pasta temporária e devolve o resumo."""
    with tempfile.TemporaryDirectory() as tmp:
        cmd = [sys.executable, str(RPA / "main.py"), "--sem-site", "--saida", str(Path(tmp) / "saida")]
        if csv_texto:
            ent = Path(tmp) / "entrada.csv"; ent.write_text(csv_texto, encoding="utf-8"); cmd += ["--entrada", str(ent)]
        p = subprocess.run(cmd, cwd=RPA, capture_output=True, text=True, timeout=180)
        linhas = [l for l in p.stdout.splitlines() if l.strip().startswith("{")]
        if p.returncode or not linhas:
            return {"ok": False, "erro": (p.stderr or p.stdout)[-400:]}
        r = ast.literal_eval(linhas[-1]); r["ok"] = True
        return r


UPLOADS = {"/api/visao/imagem", "/api/visao/video", "/api/analise", "/api/corpus/processar"}


def resumo_corpus(res):
    e = {k: v for k, v in res["estatisticas"].items()}
    return {"estatisticas": e, "documentos": res["documentos"], "paginas_pdf": res["paginas_pdf"], "removido_na_limpeza": res["removido_na_limpeza"],
            "anonimizado": res["anonimizado"], "antes_depois": res["antes_depois"], "alertas": res["alertas"], "avisos": res["avisos"]}


class H(BaseHTTPRequestHandler):
    server_version = "InovaCity"

    def log_message(self, *a):
        pass

    def _json(self, obj, cod=200):
        b = json.dumps(obj, ensure_ascii=False, default=str).encode()
        self.send_response(cod); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b))); self.send_header("Cache-Control", "no-store"); self.end_headers(); self.wfile.write(b)

    def _admin(self):
        return self.headers.get("X-Token", "") in tokens

    def _corpo(self):
        n = int(self.headers.get("Content-Length") or 0)
        if self.path.split("?")[0] in UPLOADS:
            if n > MAX_UPLOAD:
                raise ValueError("arquivo grande demais")
            self._bruto = self.rfile.read(n)
            return ""
        if n > MAX_CORPO:
            raise ValueError("corpo grande demais")
        return self.rfile.read(n).decode("utf-8") if n else ""

    def _texto(self, corpo, nome, tipo="text/plain; charset=utf-8"):
        b = corpo.encode("utf-8") if isinstance(corpo, str) else corpo
        self.send_response(200); self.send_header("Content-Type", tipo)
        self.send_header("Content-Disposition", f'attachment; filename="{nome}"'); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        p = urlparse(self.path).path
        if p == "/api/status":
            return self._json(status())
        if p == "/api/admin/resumo":
            return self._json(resumo_admin()) if self._admin() else self._json({"erro": "não autorizado"}, 401)
        q = parse_qs(urlparse(self.path).query)
        if p == "/api/iot/estado":
            return self._json(estado["iot"].estado())
        if p == "/api/iot/leituras":
            return self._json(estado["iot"].leituras((q.get("origem") or [None])[0]))
        if p == "/api/iot/alertas":
            return self._json(estado["iot"].alertas())
        if p == "/api/iot/csv":
            return self._texto(estado["iot"].csv((q.get("origem") or [None])[0]), "leituras_inovacity.csv", "text/csv; charset=utf-8")
        if p == "/api/iot/relatorio":
            return self._texto(estado["iot"].relatorio((q.get("origem") or [None])[0]), "relatorio_leituras.txt")
        if p == "/api/visao/status":
            d = estado["detector"]; return self._json({"modelo_ativo": d.ativo, "classes": d.classes, "erro": d.erro})
        if p == "/api/corpus/baixar":
            r = estado["corpus"]; a = (q.get("arq") or [""])[0]
            if not r or a not in r["corpus"]:
                return self._json({"erro": "gere os corpus primeiro"}, 404)
            from modulos.corpus import jsonl
            return self._texto(jsonl(r["corpus"][a]), a, "application/x-ndjson; charset=utf-8")
        if p == "/api/analise/csv":
            if not estado["analise"]:
                return self._json({"erro": "faça uma análise primeiro"}, 404)
            from modulos.analise import exportar_csv
            return self._texto(exportar_csv(estado["analise"]), "analise_relatos.csv", "text/csv; charset=utf-8")
        base, rel = (RPA_SITE, p[len("/rpa/"):] or "index.html") if p.startswith("/rpa/") else (SITE, p.lstrip("/") or "index.html")
        alvo = (base / rel).resolve()
        if not str(alvo).startswith(str(base.resolve())) or not alvo.is_file():
            self.send_response(404); self.end_headers(); return
        b = alvo.read_bytes()
        self.send_response(200); self.send_header("Content-Type", (mimetypes.guess_type(str(alvo))[0] or "application/octet-stream") + ("; charset=utf-8" if alvo.suffix in (".html", ".js", ".css") else ""))
        self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    def do_POST(self):
        p = urlparse(self.path).path
        try:
            self._bruto = b""
            corpo = self._corpo()
            d = json.loads(corpo) if corpo.strip().startswith("{") else {}
            if p == "/api/admin/login":
                ok = str(d.get("email", "")).strip().lower() in ADMIN_EMAILS and hmac.compare_digest(
                    hashlib.pbkdf2_hmac("sha256", str(d.get("senha", "")).encode(), ADMIN_SAL, 120000).hex(), ADMIN_HASH)
                if not ok:
                    return self._json({"erro": "credenciais inválidas"}, 401)
                t = secrets.token_hex(16); tokens.add(t); return self._json({"token": t})
            if p == "/api/iot/simular":
                return self._json(estado["iot"].simular(str(d.get("cenario")), min(int(d.get("n", 5)), 30)))
            if p == "/api/iot/ponte":
                return self._json(estado["iot"].ponte(d.get("host"), d.get("porta", 1883), d.get("filtro")))
            if p == "/api/iot/ponte/parar":
                estado["iot"].parar_ponte(); return self._json({"ok": True})
            if p == "/api/iot/usb":
                estado["iot"].leitura_usb({"device": str(d.get("device", "placa-usb"))[:40], "temp_c": float(d["temp_c"]), "umid": float(d["umid"]), "dist_cm": float(d["dist_cm"])}); return self._json({"ok": True})
            if p == "/api/iot/ping":
                return self._json(estado["iot"].ping())
            if p == "/api/iot/limites":
                return self._json(estado["iot"].definir_limites(d))
            if p == "/api/iot/validar":
                estado["iot"].validar(int(d["id"])); return self._json({"ok": True})
            if p == "/api/iot/limpar":
                estado["iot"].limpar_simulados(); return self._json({"ok": True})
            if p == "/api/visao/imagem":
                from modulos import visao
                return self._json(visao.analisar_imagem(self._bruto, estado["detector"], float(self.headers.get("X-Conf", 0.25))))
            if p == "/api/visao/video":
                from modulos import visao
                return self._json(visao.analisar_video(self._bruto, estado["detector"], float(self.headers.get("X-Conf", 0.25)), int(self.headers.get("X-Cada", 15))))
            if p == "/api/analise":
                from modulos import analise
                estado["analise"] = analise.analisar(self.headers.get("X-Nome", "texto.txt"), self._bruto, int(self.headers.get("X-K", 0)) or None)
                return self._json(estado["analise"])
            if p == "/api/corpus/processar":
                from modulos import corpus
                arqs = [(self.headers.get("X-Nome", "colado.txt"), self._bruto)] if self._bruto else []
                if self.headers.get("X-Demo") == "1":
                    arqs = [(f.name, f.read_bytes()) for f in sorted((RAIZ / "inovabot" / "base_conhecimento").glob("*.md"))]
                estado["corpus"] = corpus.processar(arqs, urllib.parse.unquote(self.headers.get("X-Texto", "")))
                return self._json(resumo_corpus(estado["corpus"]))
            if p == "/api/chat":
                msg = str(d.get("mensagem", "")).strip()[:800]
                if not msg:
                    return self._json({"erro": "mensagem vazia"}, 400)
                with trava:
                    resp = estado["assistente"].responder(msg)
                registrar(msg, resp)
                return self._json(resp)
            if p == "/api/relato":
                txt = str(d.get("texto", "")).strip()[:1500]
                if len(txt) < 5:
                    return self._json({"erro": "texto curto demais"}, 400)
                with trava:
                    return self._json(estado["assistente"].relato(txt, str(d.get("local", ""))[:200]))
            if p == "/api/reconectar":
                carregar_assistente(); return self._json(status())
            if p == "/api/rpa/executar":
                return self._json(rodar_robo(corpo if corpo.strip() and not corpo.strip().startswith("{") else None))
            self._json({"erro": "rota inexistente"}, 404)
        except Exception as e:  # noqa: BLE001
            self._json({"erro": f"{type(e).__name__}: {e}"}, 500)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--porta", type=int, default=8000); ap.add_argument("--porta-gradio", type=int, default=7860)
    ap.add_argument("--sem-navegador", action="store_true"); ap.add_argument("--sem-gradio", action="store_true")
    a = ap.parse_args()
    print("Carregando o InovaBot (base de conhecimento e modelo)...")
    from modulos.iot import IoT
    from modulos.visao import Detector
    estado["iot"] = IoT(RAIZ / "dados_servidor", int(os.getenv("INOVACITY_MQTT_PORTA", "1883"))); estado["iot"].iniciar()
    print("MQTT:", f"broker em 127.0.0.1:{estado['iot'].porta}" if estado["iot"].broker else f"indisponível ({estado['iot'].erro})")
    estado["detector"] = Detector()
    print("Visão:", "modelo YOLO carregado" if estado["detector"].ativo else "sem modelo (veja modelos/LEIAME.txt)")
    carregar_assistente()
    print("Modelo:", estado["assistente"].llm.nome)
    if not a.sem_gradio:
        iniciar_gradio(a.porta_gradio)
    srv = ThreadingHTTPServer(("127.0.0.1", a.porta), H)
    url = f"http://127.0.0.1:{a.porta}/"
    print(f"InovaCity no ar: {url}   (Ctrl+C para parar)")
    if not a.sem_navegador:
        webbrowser.open(url)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrado.")
