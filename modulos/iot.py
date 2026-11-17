"""Módulo IoT da InovaCity: broker MQTT local -> assinante -> SQLite -> regras com limites configuráveis -> alertas.
Origem dos dados: "simulado" (simulador de ESP32 deste código) ou "real" (placa publicando no broker)."""
import csv, io, json, os, random, socket, sqlite3, threading, time
from pathlib import Path
from .mqtt_min import Broker, Cliente

TOPICO = "inovacity/bairro-piloto/{dev}/leituras"
FILTRO = "inovacity/bairro-piloto/+/leituras"
LIMITES_PADRAO = {"temp_alta_c": 35, "umid_alta": 90, "dist_obstrucao_cm": 60, "leituras_consecutivas": 3, "segundos_sem_atualizar": 30}
SENSORES = [{"campo": "temp_c", "nome": "Temperatura (DHT22)", "unidade": "graus Celsius"},
            {"campo": "umid", "nome": "Umidade do ar (DHT22)", "unidade": "% de umidade relativa"},
            {"campo": "dist_cm", "nome": "Distância (HC-SR04)", "unidade": "centímetros"}]
CENARIOS = {
    "calor": {"nome": "Calor extremo, calçada livre", "temp": (36.0, 40.0), "umid": (35, 50), "dist": (230, 260)},
    "chuva": {"nome": "Ar saturado (risco de chuva forte), calçada livre", "temp": (20.0, 24.0), "umid": (92, 98), "dist": (230, 260)},
    "obstrucao": {"nome": "Objeto na calçada, clima normal", "temp": (24.0, 28.0), "umid": (55, 65), "dist": (25, 45)},
    "normal": {"nome": "Tudo normal", "temp": (24.0, 28.0), "umid": (50, 65), "dist": (230, 260)},
}


class IoT:
    def __init__(self, pasta, porta=1883):
        self.db_path = Path(pasta) / "inovacity.db"; Path(pasta).mkdir(exist_ok=True)
        self.broker, self.porta, self.erro = None, porta, None
        self.trava = threading.Lock(); self.hist = {}; self.limites = dict(LIMITES_PADRAO); self.ultimo = {}
        self._db().close()

    def _db(self):
        c = sqlite3.connect(self.db_path); c.row_factory = sqlite3.Row
        c.execute("CREATE TABLE IF NOT EXISTS leituras(id INTEGER PRIMARY KEY, ts REAL, device TEXT, origem TEXT, ldr REAL, dist_cm REAL, condicoes TEXT, topico TEXT)")
        for col in ("temp_c", "umid"):
            try: c.execute(f"ALTER TABLE leituras ADD COLUMN {col} REAL")
            except sqlite3.OperationalError: pass
        c.execute("CREATE TABLE IF NOT EXISTS alertas(id INTEGER PRIMARY KEY, ts REAL, device TEXT, origem TEXT, tipo TEXT, mensagem TEXT, validado INTEGER DEFAULT 0)")
        c.execute("CREATE TABLE IF NOT EXISTS mensagens_invalidas(id INTEGER PRIMARY KEY, ts REAL, topico TEXT, carga TEXT)")
        return c

    def iniciar(self):
        try:
            self.broker = Broker(os.getenv("INOVACITY_MQTT_HOST", "127.0.0.1"), self.porta); self.broker.iniciar()
            self.assinante = Cliente("127.0.0.1", self.porta, "assinante-inovacity")
            self.assinante.assinar(FILTRO, self._ao_receber)
        except OSError as e:
            self.erro = f"{type(e).__name__}: {e}"; self.broker = None

    # ---- ponte para um broker externo (por exemplo broker.hivemq.com) e leitura vinda da porta USB
    def ponte(self, host, porta, filtro):
        self.parar_ponte()
        host = str(host).strip()
        if not host or len(host) > 120 or not all(c.isalnum() or c in ".-" for c in host): raise ValueError("endereço do broker inválido")
        filtro = str(filtro).strip()
        if not filtro or len(filtro) > 200 or filtro.startswith("$"): raise ValueError("tópico inválido")
        cli = Cliente(host, int(porta), "inovacity-ponte-" + str(int(time.time()))[-6:])
        cli.assinar(filtro, self._ao_receber)
        self._ponte = {"cli": cli, "host": host, "porta": int(porta), "filtro": filtro, "desde": time.time()}
        return self.estado_ponte()

    def parar_ponte(self):
        p = getattr(self, "_ponte", None)
        if p:
            p["cli"].fechar(); self._ponte = None

    def estado_ponte(self):
        p = getattr(self, "_ponte", None)
        return {"ativa": bool(p), "host": p["host"], "porta": p["porta"], "filtro": p["filtro"]} if p else {"ativa": False}

    def leitura_usb(self, l):
        """Leitura recebida pela porta serial (USB) no navegador; entra como dado real, pelo mesmo caminho do MQTT."""
        l = dict(l); l["origem"] = "real"; l.setdefault("device", "placa-usb")
        self._ao_receber("usb/" + str(l["device"]) + "/leituras", json.dumps(l))

    # ---- regras
    def classificar(self, l):
        c, L = [], self.limites
        if l.get("temp_c", -99) >= L["temp_alta_c"]: c.append("ALTA_TEMPERATURA")
        if l.get("umid", -1) >= L["umid_alta"]: c.append("UMIDADE_ALTA")
        d = l.get("dist_cm", -1)
        if 0 < d < L["dist_obstrucao_cm"]: c.append("POSSIVEL_OBSTRUCAO")
        return c

    def _ao_receber(self, topico, carga):
        ts = time.time(); con = self._db()
        try:
            try:
                l = json.loads(carga)
                if isinstance(l, dict):
                    for novo, velhos in (("temp_c", ("temperatura", "temperature", "temp")), ("umid", ("umidade", "humidity", "hum")), ("dist_cm", ("distancia", "distancia_cm", "distance", "dist"))):
                        for v in velhos:
                            if novo not in l and v in l: l[novo] = l[v]
                    l.setdefault("device", topico.split("/")[-2] if topico.count("/") >= 2 else "placa")
                if not isinstance(l, dict) or "device" not in l or not all(isinstance(l.get(k), (int, float)) and not isinstance(l.get(k), bool) for k in ("temp_c", "umid", "dist_cm")):
                    raise ValueError("campos obrigatórios: device, temp_c, umid, dist_cm numéricos")
                if not (-40 <= l["temp_c"] <= 80 and 0 <= l["umid"] <= 100): raise ValueError("leitura fora da faixa do DHT22")
            except ValueError:
                con.execute("INSERT INTO mensagens_invalidas(ts,topico,carga) VALUES(?,?,?)", (ts, topico, carga[:200])); con.commit(); return
            dev, origem = str(l["device"])[:40], str(l.get("origem", "real"))
            cond = self.classificar(l)
            con.execute("INSERT INTO leituras(ts,device,origem,temp_c,umid,dist_cm,condicoes,topico) VALUES(?,?,?,?,?,?,?,?)",
                        (ts, dev, origem, l["temp_c"], l["umid"], l["dist_cm"], ",".join(cond), topico))
            with self.trava:
                self.ultimo[dev] = {"ts": ts, "origem": origem}
                h = self.hist.setdefault((dev, origem), []); h.append(cond); n = self.limites["leituras_consecutivas"]; del h[:-n]
                alerta = None
                if len(h) >= n:
                    for tipo, msg in (("ALTA_TEMPERATURA", "Temperatura muito alta no ponto monitorado. Risco de calor extremo: avisar a população e conferir a área."),
                                      ("UMIDADE_ALTA", "Ar muito úmido no ponto monitorado. Possível chuva forte: acompanhar o alerta da Defesa Civil."),
                                      ("POSSIVEL_OBSTRUCAO", "Possível obstrução de passagem ou calçada. Sugerida verificação.")):
                        if all(tipo in x for x in h):
                            alerta = (tipo, msg); h.clear(); break
            if alerta:
                con.execute("INSERT INTO alertas(ts,device,origem,tipo,mensagem) VALUES(?,?,?,?,?)", (ts, dev, origem, alerta[0], alerta[1]))
            con.commit()
        finally:
            con.close()

    # ---- simulador de ESP32 (publica por MQTT de verdade)
    def simular(self, cenario, n=5, intervalo=0.2, device="poste-sim-01"):
        if not self.broker:
            raise RuntimeError("broker MQTT não iniciou: " + str(self.erro))
        c = CENARIOS[cenario]; cli = Cliente("127.0.0.1", self.porta, device); msgs = []
        for i in range(n):
            l = {"device": device, "origem": "simulado", "temp_c": round(random.uniform(*c["temp"]), 1), "umid": round(random.uniform(*c["umid"]), 1), "dist_cm": round(random.uniform(*c["dist"]), 1), "uptime_s": i}
            cli.publicar(TOPICO.format(dev=device), json.dumps(l)); msgs.append(l); time.sleep(intervalo)
        cli.publicar(TOPICO.format(dev=device), "isto nao e json")
        time.sleep(0.3); cli.fechar()
        return {"cenario": c["nome"], "mensagens": msgs, "topico": TOPICO.format(dev=device)}

    # ---- consultas
    def estado(self):
        con = self._db(); agora = time.time()
        r = {"agora": agora, "ponte": self.estado_ponte(), "broker": bool(self.broker), "porta": self.porta, "erro": self.erro, "limites": self.limites, "sensores": SENSORES, "dispositivos": []}
        for d in con.execute("SELECT device, origem, MAX(ts) ts, COUNT(*) n FROM leituras GROUP BY device, origem"):
            idade = agora - d["ts"]
            r["dispositivos"].append({"device": d["device"], "origem": d["origem"], "leituras": d["n"], "ultima": d["ts"], "segundos": round(idade),
                                      "situacao": "conectado" if idade <= self.limites["segundos_sem_atualizar"] else "sem atualização"})
        r["host_broker"] = self.broker.host if self.broker else None
        r["clientes_mqtt"] = [c for c in (self.broker.listar() if self.broker else []) if c["id"] != "assinante-inovacity"]
        r["enderecos_pc"] = self.enderecos()
        r["total_leituras"] = con.execute("SELECT COUNT(*) FROM leituras").fetchone()[0]
        r["invalidas"] = con.execute("SELECT COUNT(*) FROM mensagens_invalidas").fetchone()[0]
        con.close(); return r

    def enderecos(self):
        ips = {"127.0.0.1"}
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("10.255.255.255", 1)); ips.add(s.getsockname()[0]); s.close()
        except OSError: pass
        try: ips.update(i[4][0] for i in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET))
        except OSError: pass
        return sorted(ips)

    def ping(self):
        if not self.broker: raise RuntimeError("broker MQTT desligado")
        cli = Cliente("127.0.0.1", self.porta, "teste-site"); msg = {"mensagem": "teste de conexão da InovaCity", "hora": time.strftime("%H:%M:%S")}
        cli.publicar("inovacity/teste/ping", json.dumps(msg, ensure_ascii=False)); time.sleep(0.2); cli.fechar()
        return {"topico": "inovacity/teste/ping", "carga": msg}

    def leituras(self, origem=None, limite=200):
        con = self._db()
        q, a = "SELECT * FROM leituras" + (" WHERE origem=?" if origem else "") + " ORDER BY id DESC LIMIT ?", ([origem] if origem else []) + [limite]
        r = [dict(x) for x in con.execute(q, a)]; con.close(); return r[::-1]

    def alertas(self, limite=50):
        con = self._db(); r = [dict(x) for x in con.execute("SELECT * FROM alertas ORDER BY id DESC LIMIT ?", (limite,))]; con.close(); return r

    def validar(self, id_):
        con = self._db(); con.execute("UPDATE alertas SET validado=1 WHERE id=?", (id_,)); con.commit(); con.close()

    def definir_limites(self, d):
        for k, (lo, hi) in {"temp_alta_c": (-10, 60), "umid_alta": (30, 100), "dist_obstrucao_cm": (5, 400), "leituras_consecutivas": (1, 20), "segundos_sem_atualizar": (5, 3600)}.items():
            if k in d:
                v = float(d[k])
                if not lo <= v <= hi: raise ValueError(f"{k} deve estar entre {lo} e {hi}")
                self.limites[k] = int(v)
        return self.limites

    def limpar_simulados(self):
        con = self._db()
        for t in ("leituras", "alertas"): con.execute(f"DELETE FROM {t} WHERE origem='simulado'")
        con.commit(); con.close(); self.hist.clear()

    def csv(self, origem=None):
        buf = io.StringIO(); w = csv.writer(buf)
        w.writerow(["data_hora", "dispositivo", "origem", "temperatura_c", "umidade_pct", "distancia_cm", "condicoes"])
        for l in self.leituras(origem, 100000):
            w.writerow([time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(l["ts"])), l["device"], l["origem"], l["temp_c"], l["umid"], l["dist_cm"], l["condicoes"]])
        return buf.getvalue()

    def relatorio(self, origem=None):
        L = self.leituras(origem, 100000); A = self.alertas(1000)
        if origem: A = [a for a in A if a["origem"] == origem]
        if not L: return "Sem leituras para descrever."
        L = [l for l in L if l.get("temp_c") is not None]
        if not L: return "Sem leituras com temperatura e umidade (DHT22) para descrever."
        tp = [l["temp_c"] for l in L]; um = [l["umid"] for l in L]; dist = [l["dist_cm"] for l in L]
        rot = {"simulado": "Dados simulados", "real": "Dados reais"}.get(origem, "Dados simulados e reais (veja a coluna origem)")
        t = [f"Relatório de leituras ({rot})", f"Período: {time.strftime('%d/%m/%Y %H:%M:%S', time.localtime(L[0]['ts']))} a {time.strftime('%d/%m/%Y %H:%M:%S', time.localtime(L[-1]['ts']))}",
             f"Total de leituras: {len(L)}", f"Temperatura (DHT22): mínimo {min(tp):.1f} °C, média {sum(tp)/len(tp):.1f} °C, máximo {max(tp):.1f} °C",
             f"Umidade do ar (DHT22): mínimo {min(um):.0f}%, média {sum(um)/len(um):.0f}%, máximo {max(um):.0f}%",
             f"Distância (HC-SR04): mínimo {min(dist):.1f} cm, média {sum(dist)/len(dist):.1f} cm, máximo {max(dist):.1f} cm",
             f"Leituras com temperatura alta (≥ {self.limites['temp_alta_c']} °C): {sum(1 for l in L if 'ALTA_TEMPERATURA' in l['condicoes'])}",
             f"Leituras com umidade alta (≥ {self.limites['umid_alta']}%): {sum(1 for l in L if 'UMIDADE_ALTA' in l['condicoes'])}",
             f"Leituras com possível obstrução (< {self.limites['dist_obstrucao_cm']} cm): {sum(1 for l in L if 'POSSIVEL_OBSTRUCAO' in l['condicoes'])}",
             f"Alertas gerados: {len(A)} (cada um exige validação humana)",
             "Limite: temperatura, umidade e distância indicam só calor, ar úmido e proximidade de um objeto; não provam chuva, alagamento nem a natureza do objeto."]
        return "\n".join(t)


    # ---- placa ligada por USB (opcional, precisa de pyserial)
    def portas(self):
        try:
            from serial.tools import list_ports
        except ImportError:
            return {"disponivel": False, "motivo": "instale pyserial: pip install pyserial", "portas": []}
        marcas = ("cp210", "ch340", "ch910", "silicon labs", "usb serial", "esp32", "ftdi", "usb-serial", "uart")
        out = []
        for p in list_ports.comports():
            desc = f"{p.description} {p.manufacturer or ''}"
            out.append({"porta": p.device, "descricao": p.description, "provavel_esp32": any(m in desc.lower() for m in marcas)})
        return {"disponivel": True, "portas": out}

    def ligar_serial(self, porta, baud=115200):
        import serial
        self.parar_serial(); ser = serial.Serial(porta, int(baud), timeout=1); self._serial_ativo = True
        self.serial_estado = {"porta": porta, "baud": int(baud), "linhas": 0, "ignoradas": 0}
        cli = Cliente("127.0.0.1", self.porta, "ponte-serial")

        def ler():
            try:
                while self._serial_ativo:
                    linha = ser.readline().decode("utf-8", "replace").strip()
                    if not linha: continue
                    try:
                        l = json.loads(linha); dev = str(l.get("device", "placa-usb"))[:40]
                        l.setdefault("origem", "real"); cli.publicar(TOPICO.format(dev=dev), json.dumps(l)); self.serial_estado["linhas"] += 1
                    except ValueError:
                        self.serial_estado["ignoradas"] += 1
            finally:
                ser.close(); cli.fechar(); self.serial_estado = None
        threading.Thread(target=ler, daemon=True).start()
        return self.serial_estado

    def parar_serial(self):
        self._serial_ativo = False
