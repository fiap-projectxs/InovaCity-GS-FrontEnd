"""Broker e cliente MQTT 3.1.1 mínimos (só QoS 0), em Python puro, para a demonstração local.
Aceita clientes reais (ESP32, mosquitto_pub, paho). Escuta em 127.0.0.1 por padrão."""
import collections, socket, struct, threading, time


def _tam(n):
    b = bytearray()
    while True:
        d, n = n % 128, n // 128
        b.append(d | (128 if n else 0))
        if not n:
            return bytes(b)


def _str(s):
    s = s.encode(); return struct.pack(">H", len(s)) + s


def _ler_pacote(sock):
    h = sock.recv(1)
    if not h:
        return None
    mult, n = 1, 0
    while True:
        b = sock.recv(1)
        if not b:
            return None
        n += (b[0] & 127) * mult
        if not b[0] & 128:
            break
        mult *= 128
    dados = b""
    while len(dados) < n:
        p = sock.recv(n - len(dados))
        if not p:
            return None
        dados += p
    return h[0], dados


def casa(filtro, topico):
    if topico.startswith("$") and filtro[:1] in "#+":
        return False
    f, t = filtro.split("/"), topico.split("/")
    for i, x in enumerate(f):
        if x == "#":
            return True
        if i >= len(t) or (x != "+" and x != t[i]):
            return False
    return len(f) == len(t)


class Broker:
    def __init__(self, host="127.0.0.1", porta=1883):
        self.host, self.porta = host, porta
        self.clientes, self.trava, self.srv, self.mensagens = [], threading.Lock(), None, 0
        self.retidas, self.recentes = {}, collections.deque(maxlen=60)

    def iniciar(self):
        self.srv = socket.socket(); self.srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.srv.bind((self.host, self.porta)); self.srv.listen(20)
        threading.Thread(target=self._aceitar, daemon=True).start()

    def listar(self):
        with self.trava: return [{"id": c.get("id"), "ip": c.get("ip"), "assina": list(c["subs"])} for c in self.clientes]

    def parar(self):
        try: self.srv.close()
        except Exception: pass

    def _aceitar(self):
        while True:
            try: s, _ = self.srv.accept()
            except OSError: return
            threading.Thread(target=self._atender, args=(s,), daemon=True).start()

    def _atender(self, s):
        c = {"s": s, "subs": [], "id": "?", "ip": ""}
        try:
            c["ip"] = s.getpeername()[0]
            while True:
                p = _ler_pacote(s)
                if p is None:
                    break
                tipo, d = p[0] >> 4, p[1]
                if tipo == 1:
                    n = struct.unpack(">H", d[:2])[0]; i = 2 + n + 1 + 1 + 2
                    m = struct.unpack(">H", d[i:i + 2])[0]; c["id"] = d[i + 2:i + 2 + m].decode("utf-8", "replace") or "sem-id"
                    with self.trava: self.clientes.append(c)
                    s.sendall(b"\x20\x02\x00\x00")
                elif tipo == 8:
                    pid = d[:2]; i = 2; rc = b""
                    while i < len(d):
                        n = struct.unpack(">H", d[i:i + 2])[0]; f = d[i + 2:i + 2 + n].decode(); c["subs"].append(f); i += 2 + n + 1; rc += b"\x00"
                        with self.trava: ret = list(self.retidas.items())
                        for top, carga in ret:
                            if casa(f, top):
                                dd = _str(top) + carga; s.sendall(b"\x31" + _tam(len(dd)) + dd)
                    s.sendall(b"\x90" + _tam(2 + len(rc)) + pid + rc)
                elif tipo == 10:
                    pid = d[:2]; i = 2
                    while i < len(d):
                        n = struct.unpack(">H", d[i:i + 2])[0]; f = d[i + 2:i + 2 + n].decode(); i += 2 + n
                        if f in c["subs"]: c["subs"].remove(f)
                    s.sendall(b"\xb0\x02" + pid)
                elif tipo == 3:
                    qos = (p[0] >> 1) & 3; ret = p[0] & 1
                    n = struct.unpack(">H", d[:2])[0]; top = d[2:2 + n].decode("utf-8", "replace"); i = 2 + n
                    if qos:
                        pid = d[i:i + 2]; i += 2
                        if qos == 1: s.sendall(b"\x40\x02" + pid)
                        else: s.sendall(b"\x50\x02" + pid)
                    carga = d[i:]
                    self._publicar(top, carga, ret, c["id"])
                elif tipo == 6:
                    s.sendall(b"\x70\x02" + d[:2])
                elif tipo == 12:
                    s.sendall(b"\xd0\x00")
                elif tipo == 14:
                    break
        except OSError:
            pass
        finally:
            with self.trava:
                if c in self.clientes: self.clientes.remove(c)
            try: s.close()
            except OSError: pass

    def _publicar(self, top, carga, retida=False, origem="?"):
        self.mensagens += 1
        self.recentes.append({"t": time.time(), "topico": top, "carga": carga.decode("utf-8", "replace")[:300], "de": origem})
        if not top.startswith("$"):
            with self.trava:
                if retida:
                    if carga: self.retidas[top] = carga
                    else: self.retidas.pop(top, None)
        dd = _str(top) + carga; pac = b"\x30" + _tam(len(dd)) + dd
        with self.trava: alvo = list(self.clientes)
        for o in alvo:
            if any(casa(f, top) for f in o["subs"]):
                try: o["s"].sendall(pac)
                except OSError: pass

    def lista_clientes(self):
        with self.trava: return [{"id": c["id"], "ip": c["ip"], "assinaturas": list(c["subs"])} for c in self.clientes]


class Cliente:
    def __init__(self, host="127.0.0.1", porta=1883, id_="cli"):
        self.s = socket.create_connection((host, porta), timeout=5); self.s.settimeout(None)
        carga = _str("MQTT") + b"\x04\x02" + struct.pack(">H", 60) + _str(id_)
        self.s.sendall(b"\x10" + _tam(len(carga)) + carga)
        p = _ler_pacote(self.s)
        if not p or p[0] >> 4 != 2 or p[1][1] != 0:
            raise ConnectionError("broker recusou a conexão")
        self.ao_receber = None
        threading.Thread(target=self._ping, daemon=True).start()

    def _ping(self):
        while True:
            time.sleep(25)
            try: self.s.sendall(b'\xc0\x00')
            except OSError: return

    def publicar(self, topico, texto):
        d = _str(topico) + texto.encode()
        self.s.sendall(b"\x30" + _tam(len(d)) + d)

    def assinar(self, filtro, ao_receber):
        self.ao_receber = ao_receber
        d = struct.pack(">H", 1) + _str(filtro) + b"\x00"
        self.s.sendall(b"\x82" + _tam(len(d)) + d)
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        try:
            while True:
                p = _ler_pacote(self.s)
                if p is None:
                    return
                if p[0] >> 4 == 3:
                    d = p[1]; n = struct.unpack(">H", d[:2])[0]
                    self.ao_receber(d[2:2 + n].decode(), d[2 + n:].decode("utf-8", "replace"))
        except OSError:
            return

    def fechar(self):
        try: self.s.sendall(b"\xe0\x00"); self.s.close()
        except OSError: pass
