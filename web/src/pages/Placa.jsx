import { useEffect, useState, useCallback } from 'react'
import { iot } from '../inovabot/api.js'

const CEN = [['calor', 'Calor extremo, calçada livre'], ['chuva', 'Ar saturado (risco de chuva forte)'], ['obstrucao', 'Objeto na calçada, clima normal'], ['normal', 'Tudo normal']]
const hora = (t) => new Date(t * 1000).toLocaleTimeString('pt-BR')
const NOME = { ALTA_TEMPERATURA: 'Calor extremo', UMIDADE_ALTA: 'Umidade alta (risco de chuva)', POSSIVEL_OBSTRUCAO: 'Possível obstrução' }

function Grafico({ dados, campo, titulo, unidade, limite }) {
  if (!dados.length) return <p>Sem leituras ainda.</p>
  const v = dados.map((d) => d[campo]); const max = Math.max(...v, limite || 0) * 1.1 || 1; const W = 420, H = 130
  const pt = v.map((y, i) => `${(i / Math.max(1, v.length - 1)) * (W - 50) + 40},${H - 20 - (y / max) * (H - 30)}`).join(' ')
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${titulo}: ${v.length} leituras, última ${v[v.length - 1]} ${unidade}`} style={{ width: '100%', maxWidth: 460 }}>
        <rect x="0" y="0" width={W} height={H} fill="#fff" stroke="#012B58" strokeWidth="2" rx="10" />
        {limite != null && <line x1="40" x2={W - 10} y1={H - 20 - (limite / max) * (H - 30)} y2={H - 20 - (limite / max) * (H - 30)} stroke="#FB6702" strokeDasharray="6 4" strokeWidth="2" />}
        <polyline points={pt} fill="none" stroke="#039882" strokeWidth="3" />
        <text x="6" y="16" fontSize="11" fill="#012B58">{Math.round(max)}</text><text x="6" y={H - 22} fontSize="11" fill="#012B58">0</text>
      </svg>
      <figcaption>{titulo} ({unidade}). {limite != null && 'Linha laranja tracejada: limite do alerta.'}</figcaption>
    </figure>
  )
}


function Esquema({ placa, broker, explorer }) {
  const cor = (ok) => (ok ? '#039882' : '#8a97a8')
  return (
    <figure>
      <svg viewBox="0 0 640 210" role="img" aria-label={`Esquema: ESP32, Wi-Fi, servidor MQTT no computador e MQTT Explorer. Placa ${placa ? 'conectada' : 'não detectada'}; servidor MQTT ${broker ? 'ligado' : 'desligado'}; MQTT Explorer ${explorer ? 'conectado' : 'não conectado'}.`} style={{ width: '100%', maxWidth: 680 }}>
        <rect x="2" y="2" width="636" height="206" rx="18" fill="#fff" stroke="#012B58" strokeWidth="3" />
        <g><rect x="24" y="60" width="130" height="90" rx="12" fill="#012B58" stroke={cor(placa)} strokeWidth="4" /><text x="89" y="94" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700">ESP32</text><text x="89" y="116" textAnchor="middle" fill="#cfe" fontSize="12">clima + distância</text><text x="89" y="138" textAnchor="middle" fill="#fff" fontSize="12">{placa ? 'detectada' : 'não detectada'}</text></g>
        <g><rect x="250" y="40" width="150" height="130" rx="12" fill="#fff" stroke={cor(broker)} strokeWidth="4" /><text x="325" y="72" textAnchor="middle" fill="#012B58" fontSize="16" fontWeight="700">Seu computador</text><text x="325" y="98" textAnchor="middle" fill="#012B58" fontSize="13">servidor MQTT</text><text x="325" y="118" textAnchor="middle" fill="#012B58" fontSize="13">banco de dados</text><text x="325" y="138" textAnchor="middle" fill="#012B58" fontSize="13">site InovaCity</text><text x="325" y="158" textAnchor="middle" fill={cor(broker)} fontSize="12" fontWeight="700">{broker ? 'ligado' : 'desligado'}</text></g>
        <g><rect x="500" y="60" width="120" height="90" rx="12" fill="#fff" stroke={cor(explorer)} strokeWidth="4" /><text x="560" y="96" textAnchor="middle" fill="#012B58" fontSize="15" fontWeight="700">MQTT</text><text x="560" y="114" textAnchor="middle" fill="#012B58" fontSize="15" fontWeight="700">Explorer</text><text x="560" y="136" textAnchor="middle" fill={cor(explorer)} fontSize="12" fontWeight="700">{explorer ? 'conectado' : 'não conectado'}</text></g>
        <line x1="154" y1="105" x2="250" y2="105" stroke={cor(placa)} strokeWidth="4" strokeDasharray="10 8" className={placa ? 'fluxo' : ''} />
        <line x1="400" y1="105" x2="500" y2="105" stroke={cor(explorer)} strokeWidth="4" strokeDasharray="10 8" className={explorer ? 'fluxo' : ''} />
        <text x="202" y="92" textAnchor="middle" fontSize="12" fill="#012B58">Wi-Fi</text><text x="450" y="92" textAnchor="middle" fontSize="12" fill="#012B58">assina o tópico</text>
        <text x="320" y="198" textAnchor="middle" fontSize="12" fill="#012B58">Cada linha animada indica dados passando agora. Linha cinza parada: sem conexão.</text>
      </svg>
    </figure>
  )
}

export default function Placa() {
  const [est, setEst] = useState(null); const [L, setL] = useState([]); const [al, setAl] = useState([]); const [msg, setMsg] = useState(''); const [erro, setErro] = useState('')
  const [cen, setCen] = useState('calor'); const [n, setN] = useState(5); const [carga, setCarga] = useState(false); const [lim, setLim] = useState(null); const [ult, setUlt] = useState(null); const [usb, setUsb] = useState(null); const [usbOk, setUsbOk] = useState(false); const [porta, setPorta] = useState(null); const [linha, setLinha] = useState(''); const [ext, setExt] = useState({ host: 'broker.hivemq.com', porta: 1883, filtro: 'inovacity/bairro-piloto/#' }); const [ping, setPing] = useState(null)
  const atualizar = useCallback(async () => {
    try { const e = await iot.estado(); setEst(e); setLim((x) => x || e.limites); setL(await iot.leituras()); setAl(await iot.alertas()); setErro('') } catch { setErro('Servidor não encontrado. Abra o site pelo executar.bat ou executar.sh.') }
  }, [])
  useEffect(() => { atualizar(); const t = setInterval(atualizar, 4000); return () => clearInterval(t) }, [atualizar])
  async function simular() {
    setCarga(true); setMsg(''); try { const r = await iot.simular(cen, n); setUlt(r); setMsg(`${r.mensagens.length} mensagens de dados simulados enviadas pelo MQTT e gravadas.`); await atualizar() } catch (e) { setErro(e.message) } finally { setCarga(false) }
  }
  async function salvarLim(e) { e.preventDefault(); setMsg(''); setErro(''); try { const r = await iot.limites(lim); setLim(r); setMsg('Limites salvos.') } catch (x) { setErro(x.message) } }
  const ehPlaca = (c) => c.assina.length === 0 && !/teste|simul|poste-sim/i.test(c.id)
  const placaOk = !!(est && (est.clientes_mqtt.some(ehPlaca) || est.dispositivos.some((d) => d.origem !== 'simulado' && d.situacao === 'conectado'))) || usbOk
  const explorerOk = !!(est && est.clientes_mqtt.some((c) => c.assina.length > 0))
  async function detectarUsb() {
    if (!('serial' in navigator)) { setUsb('Este navegador não consegue listar portas USB. Use o Chrome ou o Edge, ou confira a placa pelos clientes MQTT abaixo.'); return }
    try {
      const p = await navigator.serial.requestPort(); const i = p.getInfo()
      const nomes = { 0x10c4: 'conversor CP210x (comum em placas ESP32)', 0x1a86: 'conversor CH340 (comum em placas ESP32)', 0x303a: 'USB nativo da Espressif', 0x0403: 'conversor FTDI' }
      setUsb(`Dispositivo USB selecionado${i.usbVendorId ? `: fabricante 0x${i.usbVendorId.toString(16)}, ${nomes[i.usbVendorId] || 'conversor desconhecido'}` : ''}. Isto indica uma placa compatível, mas não prova que seja um ESP32. Lendo a porta a 115200 baud: se a placa imprimir linhas JSON como {"temp_c":27.5,"umid":60,"dist_cm":120}, elas entram como dado real.`); setUsbOk(true); setPorta(p)
      await p.open({ baudRate: 115200 })
      const dec = new TextDecoderStream(); p.readable.pipeTo(dec.writable).catch(() => {}); const rd = dec.readable.getReader(); let buf = ''
      for (;;) {
        const { value, done } = await rd.read(); if (done) break
        buf += value; const ls = buf.split('\n'); buf = ls.pop()
        for (const l of ls) {
          setLinha(l.trim().slice(0, 160))
          try { const j = JSON.parse(l); const temp_c = j.temp_c ?? j.temperatura; const umid = j.umid ?? j.umidade; const dist = j.dist_cm ?? j.distancia; if (typeof temp_c === 'number' && typeof umid === 'number' && typeof dist === 'number') await iot.usb({ device: j.device || 'placa-usb', temp_c, umid, dist_cm: dist }) } catch { /* linha que não é JSON */ }
        }
      }
    } catch { setUsb('Nenhuma porta escolhida. Conecte a placa por USB, instale o driver do conversor (CP210x ou CH340) se necessário e tente de novo.') }
  }
  const sim = L.filter((x) => x.origem === 'simulado'); const real = L.filter((x) => x.origem !== 'simulado'); const ultima = L[L.length - 1]
  return (
    <section className="pagina">
      <h1>Conecte sua placa e acompanhe as medições</h1>
      <p className="lide">Uma placa ESP32 com sensores de temperatura, umidade e distância envia medidas pela internet. A InovaCity guarda os valores, mostra gráficos e avisa quando algo parece errado.</p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {msg && <p role="status">{msg}</p>}

      <div className="cartao aviso"><p><strong>Dados simulados.</strong> Sem placa conectada, os valores vêm do simulador e levam a etiqueta “simulado”.</p></div>

      <h2>1. Como funciona</h2>
      <Esquema placa={placaOk} broker={!!(est && est.broker)} explorer={explorerOk} />
      <p>A placa envia uma mensagem MQTT com as medidas, e a InovaCity guarda a mensagem. O MQTT Explorer mostra essas mensagens em tempo real.</p>

      <h2>2. Endereço deste computador</h2>
      {est ? <>
        <p>Servidor MQTT: {est.broker ? `ligado, ouvindo em ${est.host_broker}, porta ${est.porta}` : `desligado (${est.erro})`}.</p>
        <p>Endereços deste computador: <strong>{est.enderecos_pc.join(', ')}</strong>.</p>
        {est.host_broker === '127.0.0.1'
          ? <p>Agora o servidor só aceita conexões do próprio computador. Isso serve para o MQTT Explorer instalado aqui. Para a placa conectar pelo Wi-Fi, reinicie a InovaCity com a variável <code>INOVACITY_MQTT_HOST=0.0.0.0</code> e use na placa o endereço da sua rede (o que não é 127.0.0.1). Se o computador tiver firewall, libere a porta {est.porta}.</p>
          : <p>O servidor aceita conexões da rede. Use na placa um dos endereços acima que não seja 127.0.0.1. Só faça isso em rede de confiança: este servidor não pede senha.</p>}
      </> : <p>Carregando…</p>}

      <h2>3. Detectar a placa</h2>
      <p>Há duas formas de saber se a placa está ligada. A primeira é pela porta USB do computador (precisa do Chrome ou Edge). A segunda é a placa aparecer como cliente do servidor MQTT, mostrada logo abaixo.</p>
      <p><button type="button" className="btn" onClick={detectarUsb}>Procurar placa na USB</button></p>
      {usb && <p role="status">{usb}</p>}
      {linha && <p>Última linha recebida pela USB: <code>{linha}</code></p>}
      <p>Clientes conectados ao servidor MQTT agora:</p>
      {est && est.clientes_mqtt.length === 0 ? <p>Nenhum. A placa e o MQTT Explorer ainda não conectaram.</p> : (
        <ul className="lista-simples">{est && est.clientes_mqtt.map((c, i) => <li key={i}><strong>{c.id}</strong> — endereço {c.ip}{c.assina.length ? `; assina ${c.assina.join(', ')}` : ''} {ehPlaca(c) && <span className="badge">parece a placa</span>} {c.assina.length > 0 && <span className="badge">parece o MQTT Explorer</span>}</li>)}</ul>
      )}
      

      <h2>4. MQTT Explorer</h2>
      <p>Para ver as mensagens deste computador, crie uma conexão com estes valores e clique em Connect. Para ver as mensagens do simulador Wokwi, conecte a broker.hivemq.com e assine o tópico das leituras (seção 6).</p>
      <table><caption>Valores da conexão</caption><tbody>
        <tr><th scope="row">Protocol</th><td>mqtt://</td></tr>
        <tr><th scope="row">Host</th><td>{est ? (est.host_broker === '127.0.0.1' ? '127.0.0.1 (ou localhost)' : est.enderecos_pc.filter((x) => x !== '127.0.0.1')[0] || '127.0.0.1') : '127.0.0.1'}</td></tr>
        <tr><th scope="row">Port</th><td>{est ? est.porta : 1883}</td></tr>
        <tr><th scope="row">Encryption (tls)</th><td>desligado</td></tr>
        <tr><th scope="row">Validate certificate</th><td>pode deixar como está (sem TLS não é usado)</td></tr>
        <tr><th scope="row">Username e Password</th><td>em branco</td></tr>
        <tr><th scope="row">Tópico para assinar</th><td><code>inovacity/#</code></td></tr>
      </tbody></table>
      <p><button type="button" className="btn" onClick={async () => { try { setPing(await iot.ping()); atualizar() } catch (e) { setErro(e.message) } }}>Enviar mensagem de teste</button></p>
      {ping && <p role="status">Mensagem enviada ao tópico <code>{ping.topico}</code>: {JSON.stringify(ping.carga)}. Ela deve aparecer no MQTT Explorer agora.</p>}
      <p>Quando a placa (ou o simulador abaixo) enviar leituras, elas aparecem no tópico <code>inovacity/bairro-piloto/NOME-DA-PLACA/leituras</code>.</p>

      <h2>5. Código da placa</h2>
      <p><strong>Placa física na mesma rede deste computador.</strong> No arquivo iot/wokwi/sketch.ino, troque estes valores e grave na placa:</p>
      <pre className="codigo" tabIndex="0">{`const char* WIFI_SSID = "nome-da-sua-rede";\nconst char* WIFI_PASS = "senha-da-sua-rede";\nconst char* MQTT_HOST = "${est ? (est.enderecos_pc.filter((x) => x !== '127.0.0.1')[0] || '192.168.x.x') : '192.168.x.x'}";  // endereço deste computador`}</pre>
      <p><strong>Simulador Wokwi.</strong> O Wokwi roda na internet e não alcança este computador. O código dele já usa o servidor público broker.hivemq.com. Use a seção 6 abaixo para a InovaCity assinar esse servidor, e conecte o MQTT Explorer ao mesmo servidor para ver as mesmas mensagens.</p>
      <p>Placa: ESP32. Sensor DHT22 (temperatura e umidade) com o pino de dados no GPIO 13, alimentado em 3,3 V. Sensor de distância HC-SR04 com TRIG no GPIO 22 e ECHO no GPIO 23, alimentado em 5 V. O HC-SR04 trabalha com 5 V e o pino de leitura do ESP32 aceita 3,3 V: na placa real, use um divisor de tensão no ECHO. No simulador Wokwi isso não é necessário. Sem a placa, use o simulador da seção 8.</p>

      <h2>6. Outro servidor MQTT (opcional)</h2>
      <p>Se o seu MQTT Explorer está ligado a um servidor público, como o broker.hivemq.com, e a placa publica lá, a InovaCity pode assinar o mesmo tópico e guardar as mensagens. Use um nome de tópico só seu, porque servidores públicos são abertos a qualquer pessoa, e não envie dados pessoais.</p>
      <form className="cartao" onSubmit={async (e) => { e.preventDefault(); try { await iot.ponte(ext.host, ext.porta, ext.filtro); setMsg('Assinatura iniciada.'); atualizar() } catch (x) { setErro(x.message) } }}>
        <label htmlFor="eh">Servidor</label><input id="eh" value={ext.host} onChange={(e) => setExt({ ...ext, host: e.target.value })} />
        <label htmlFor="ep">Porta</label><input id="ep" type="number" value={ext.porta} onChange={(e) => setExt({ ...ext, porta: e.target.value })} />
        <label htmlFor="ef">Tópico a assinar (as mensagens precisam ter os campos temp_c, umid e dist_cm)</label><input id="ef" value={ext.filtro} onChange={(e) => setExt({ ...ext, filtro: e.target.value })} />
        <p><button className="btn">Assinar</button> <button type="button" className="btn sec" onClick={async () => { await iot.pararPonte(); atualizar() }}>Parar</button></p>
        {est && est.ponte && est.ponte.ativa && <p role="status">Assinando {est.ponte.filtro} em {est.ponte.host}:{est.ponte.porta}.</p>}
      </form>

      <h2>7. Dispositivos</h2>
      {est && est.dispositivos.length === 0 && <p>Nenhum dispositivo enviou dados ainda. Use o simulador abaixo.</p>}
      <ul className="lista-simples">
        {est && est.dispositivos.map((d) => <li key={d.device + d.origem}><strong>{d.device}</strong> <span className="badge">{d.origem === 'simulado' ? 'dados simulados' : 'dado real'}</span> <span className="badge">{d.situacao}</span> — {d.leituras} leituras, última às {hora(d.ultima)}</li>)}
      </ul>
      {est && <p>Mensagens inválidas recebidas e ignoradas: {est.invalidas}.</p>}

      <h2>8. Simulador</h2>
      <form className="cartao" onSubmit={(e) => { e.preventDefault(); simular() }}>
        <label htmlFor="cen">Situação</label>
        <select id="cen" value={cen} onChange={(e) => setCen(e.target.value)}>{CEN.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        <label htmlFor="nl">Quantidade de leituras (1 a 30)</label>
        <input id="nl" type="number" min="1" max="30" value={n} onChange={(e) => setN(Number(e.target.value))} />
        <p><button className="btn" disabled={carga}>{carga ? 'Enviando…' : 'Enviar dados simulados'}</button> <button type="button" className="btn sec" onClick={async () => { await iot.limpar(); setUlt(null); atualizar() }}>Apagar dados simulados</button></p>
      </form>
      {ult && (
        <details open><summary>Mensagens enviadas ao tópico {ult.topico}</summary>
          <pre className="codigo" tabIndex="0">{ult.mensagens.map((m) => JSON.stringify(m)).join('\n')}{'\nisto nao e json   ← mensagem inválida de propósito, ignorada'}</pre></details>
      )}

      <h2>9. Valores e gráficos</h2>
      {ultima ? <p>Última leitura ({ultima.origem === 'simulado' ? 'dados simulados' : 'dado real'}) às {hora(ultima.ts)}: temperatura {ultima.temp_c} °C, umidade {ultima.umid}% e distância {ultima.dist_cm} cm.</p> : <p>Sem leituras ainda.</p>}
      <div className="duas-col">
        <div><h3>Dados simulados</h3><Grafico dados={sim} campo="temp_c" titulo="Temperatura" unidade="°C" limite={lim && lim.temp_alta_c} /><Grafico dados={sim} campo="umid" titulo="Umidade do ar" unidade="%" limite={lim && lim.umid_alta} /><Grafico dados={sim} campo="dist_cm" titulo="Distância" unidade="cm" limite={lim && lim.dist_obstrucao_cm} /></div>
        <div><h3>Dados reais</h3>{real.length ? <><Grafico dados={real} campo="temp_c" titulo="Temperatura" unidade="°C" limite={lim && lim.temp_alta_c} /><Grafico dados={real} campo="umid" titulo="Umidade do ar" unidade="%" limite={lim && lim.umid_alta} /><Grafico dados={real} campo="dist_cm" titulo="Distância" unidade="cm" limite={lim && lim.dist_obstrucao_cm} /></> : <p>Nenhuma placa real conectada.</p>}</div>
      </div>

      <h2>10. Alertas e limites</h2>
      {lim && (
        <form className="cartao" onSubmit={salvarLim}>
          <label htmlFor="l1">Calor extremo quando a temperatura for maior ou igual a (°C)</label><input id="l1" type="number" min="-10" max="60" value={lim.temp_alta_c} onChange={(e) => setLim({ ...lim, temp_alta_c: e.target.value })} />
          <label htmlFor="l0">Umidade alta quando a umidade do ar for maior ou igual a (%)</label><input id="l0" type="number" min="30" max="100" value={lim.umid_alta} onChange={(e) => setLim({ ...lim, umid_alta: e.target.value })} />
          <label htmlFor="l2">Possível obstrução quando a distância for menor que (cm)</label><input id="l2" type="number" min="5" max="400" value={lim.dist_obstrucao_cm} onChange={(e) => setLim({ ...lim, dist_obstrucao_cm: e.target.value })} />
          <label htmlFor="l3">Leituras seguidas para gerar alerta</label><input id="l3" type="number" min="1" max="20" value={lim.leituras_consecutivas} onChange={(e) => setLim({ ...lim, leituras_consecutivas: e.target.value })} />
          <label htmlFor="l4">Segundos sem dados para marcar “sem atualização”</label><input id="l4" type="number" min="5" max="3600" value={lim.segundos_sem_atualizar} onChange={(e) => setLim({ ...lim, segundos_sem_atualizar: e.target.value })} />
          <p><button className="btn">Salvar limites</button></p>
        </form>
      )}
      {al.length === 0 ? <p>Nenhum alerta até agora.</p> : (
        <ul className="lista-simples">{al.map((a) => <li key={a.id}><strong>{NOME[a.tipo] || a.tipo}</strong> <span className="badge">{a.origem === 'simulado' ? 'dados simulados' : 'dado real'}</span> — {a.mensagem} ({a.device}, {hora(a.ts)}) {a.validado ? <span className="badge">validado por pessoa</span> : <button className="btn sec peq" onClick={async () => { await iot.validar(a.id); atualizar() }}>Marcar como validado</button>}</li>)}</ul>
      )}
      <p>Um alerta é uma sugestão de vistoria. Ele não confirma defeito: os sensores só medem temperatura, umidade do ar e distância.</p>

      <h2>11. Exportar</h2>
      <p><a className="btn sec" href={iot.csv} download>Baixar medições (CSV)</a> <a className="btn sec" href={iot.relatorio} download>Baixar relatório das leituras (TXT)</a></p>
    </section>
  )
}
