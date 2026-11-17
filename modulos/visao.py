"""Visão computacional da InovaCity.
Detector YOLO: lê um modelo ONNX exportado do Ultralytics (YOLOv8) colocado em modelos/ (modelo.onnx + classes.txt) e roda com onnxruntime + OpenCV.
Sem modelo, só há a "leitura básica da imagem" (qualidade de imagem e regiões de contraste), que NÃO detecta buracos, lixo ou placas."""
import io, time
from pathlib import Path
import cv2, numpy as np

PASTA = Path(__file__).resolve().parent.parent / "modelos"
LIMITE_IMG_MB, LIMITE_VIDEO_MB, MAX_QUADROS, DIM = 8, 40, 60, 640


class Detector:
    def __init__(self, pasta=PASTA):
        self.sessao, self.classes, self.erro = None, [], None
        onnx = Path(pasta) / "modelo.onnx"; cls = Path(pasta) / "classes.txt"
        if onnx.is_file():
            try:
                import onnxruntime as ort
                self.sessao = ort.InferenceSession(str(onnx), providers=["CPUExecutionProvider"])
                self.entrada = self.sessao.get_inputs()[0].name
                self.classes = [l.strip() for l in cls.read_text(encoding="utf-8").splitlines() if l.strip()] if cls.is_file() else []
            except Exception as e:  # noqa: BLE001
                self.erro = f"{type(e).__name__}: {e}"

    @property
    def ativo(self): return self.sessao is not None

    def detectar(self, bgr, conf=0.25, iou=0.45):
        h, w = bgr.shape[:2]; esc = min(DIM / h, DIM / w)
        nh, nw = int(round(h * esc)), int(round(w * esc))
        img = np.full((DIM, DIM, 3), 114, np.uint8); img[:nh, :nw] = cv2.resize(bgr, (nw, nh))
        x = img[:, :, ::-1].transpose(2, 0, 1)[None].astype(np.float32) / 255
        t0 = time.perf_counter(); saida = self.sessao.run(None, {self.entrada: x})[0]; ms = (time.perf_counter() - t0) * 1000
        p = saida[0].T                      # (N, 4+nc)
        nc = p.shape[1] - 4; sc = p[:, 4:]; cid = sc.argmax(1); cf = sc.max(1); m = cf >= conf
        p, cid, cf = p[m], cid[m], cf[m]
        caixas = [[float((q[0] - q[2] / 2) / esc), float((q[1] - q[3] / 2) / esc), float(q[2] / esc), float(q[3] / esc)] for q in p]
        ks = cv2.dnn.NMSBoxes(caixas, cf.tolist(), conf, iou) if caixas else []
        det = []
        for i in np.array(ks).flatten():
            b = caixas[i]
            det.append({"classe": self.classes[cid[i]] if cid[i] < len(self.classes) else f"classe {int(cid[i])}", "confianca": round(float(cf[i]), 3),
                        "caixa": [max(0, int(b[0])), max(0, int(b[1])), min(w, int(b[0] + b[2])), min(h, int(b[1] + b[3]))]})
        return det, ms


def decodificar(dados):
    a = cv2.imdecode(np.frombuffer(dados, np.uint8), cv2.IMREAD_COLOR)
    if a is None: raise ValueError("arquivo não é uma imagem válida (use JPG ou PNG)")
    return a


def leitura_basica(bgr):
    """Medidas simples de qualidade; não são detecções de ocorrências."""
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    brilho = float(g.mean()); nitidez = float(cv2.Laplacian(g, cv2.CV_64F).var())
    obs = []
    if brilho < 60: obs.append("imagem escura: detecções podem falhar")
    if brilho > 200: obs.append("imagem muito clara: detalhes podem se perder")
    if nitidez < 60: obs.append("imagem pouco nítida ou borrada")
    return {"largura": bgr.shape[1], "altura": bgr.shape[0], "brilho_medio": round(brilho, 1), "nitidez": round(nitidez, 1), "observacoes": obs or ["qualidade aparentemente adequada"]}


def desenhar(bgr, det):
    img = bgr.copy()
    for d in det:
        x1, y1, x2, y2 = d["caixa"]; cv2.rectangle(img, (x1, y1), (x2, y2), (2, 103, 251), 3)
        txt = f"{d['classe']} {d['confianca']:.0%}"; cv2.putText(img, txt, (x1 + 3, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (88, 43, 1), 3); cv2.putText(img, txt, (x1 + 3, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
    return img


def png_b64(bgr, max_lado=900):
    import base64
    h, w = bgr.shape[:2]; e = min(1, max_lado / max(h, w))
    if e < 1: bgr = cv2.resize(bgr, (int(w * e), int(h * e)))
    return "data:image/jpeg;base64," + base64.b64encode(cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])[1]).decode()


def analisar_imagem(dados, det: Detector, conf=0.25):
    if len(dados) > LIMITE_IMG_MB * 1_048_576: raise ValueError(f"imagem maior que {LIMITE_IMG_MB} MB")
    img = decodificar(dados); r = {"basica": leitura_basica(img), "modelo_ativo": det.ativo, "limiar": conf}
    if det.ativo:
        d, ms = det.detectar(img, conf); r.update(deteccoes=d, latencia_ms=round(ms, 1), imagem=png_b64(desenhar(img, d)),
                                                resumo=_resumo(d))
    else:
        r.update(deteccoes=[], imagem=png_b64(img), resumo="Nenhum modelo de detecção carregado: só a leitura básica da imagem foi feita.")
    return r


def _resumo(d):
    if not d: return "Nenhuma detecção acima do limiar. Isso não garante que não haja problema na imagem."
    from collections import Counter
    c = Counter(x["classe"] for x in d)
    return "Detectado nesta imagem: " + ", ".join(f"{n} × {k}" for k, n in c.items()) + ". Confiança é uma estimativa do modelo, não uma probabilidade de acerto."


def analisar_video(dados, det: Detector, conf=0.25, cada_n=15):
    if len(dados) > LIMITE_VIDEO_MB * 1_048_576: raise ValueError(f"vídeo maior que {LIMITE_VIDEO_MB} MB")
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f: f.write(dados); nome = f.name
    try:
        cap = cv2.VideoCapture(nome)
        if not cap.isOpened(): raise ValueError("vídeo ilegível")
        fps = cap.get(cv2.CAP_PROP_FPS) or 0; total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        quadros, i, t0, lat = [], 0, time.perf_counter(), []
        while len(quadros) < MAX_QUADROS:
            ok, fr = cap.read()
            if not ok: break
            if i % cada_n == 0:
                reg = {"quadro": i, "segundo": round(i / fps, 2) if fps else None, "basica": leitura_basica(fr)}
                if det.ativo:
                    d, ms = det.detectar(fr, conf); lat.append(ms); reg["deteccoes"] = d
                    if d and len(quadros) < 12: reg["imagem"] = png_b64(desenhar(fr, d), 500)
                quadros.append(reg)
            i += 1
        cap.release(); dur = time.perf_counter() - t0
    finally:
        os.unlink(nome)
    nd = sum(len(q.get("deteccoes", [])) for q in quadros)
    return {"fps_video": round(fps, 1), "quadros_totais": total, "amostragem": f"1 a cada {cada_n} quadros (máximo {MAX_QUADROS} analisados)", "quadros_analisados": len(quadros),
            "modelo_ativo": det.ativo, "deteccoes_somadas": nd, "latencia_media_ms": round(sum(lat) / len(lat), 1) if lat else None,
            "tempo_total_s": round(dur, 2), "quadros": quadros,
            "aviso": "Sem rastreamento: a mesma ocorrência vista em vários quadros aparece várias vezes; 'deteccoes_somadas' NÃO é a quantidade de objetos diferentes."}
