"""Interface Gradio do InovaBot (IA generativa da InovaCity).

Execução:  python app_gradio.py      (abre em http://127.0.0.1:7860)

Três abas: conversa com fontes e etapas (RAG), redigir relato e status de uma ocorrência.
Com o Ollama ligado e um modelo Qwen instalado, usa LangChain + Ollama; sem ele, cai no modo extrativo.
"""
import os
import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))
import gradio as gr
from agente import Assistente
from llm import criar_llm

TRAVA = threading.Lock()
A = Assistente(criar_llm(os.getenv("INOVACITY_LLM", "auto")))
MODO = A.llm.nome


def conversar(msg, historico):
    msg = (msg or "").strip()
    if not msg:
        return "", historico, "", ""
    with TRAVA:
        r = A.responder(msg)
    historico = (historico or []) + [{"role": "user", "content": msg}, {"role": "assistant", "content": r["texto"]}]
    fontes = ", ".join(r.get("fontes") or []) or "nenhuma"
    etapas = "\n".join(f"- {t}" for t in r.get("trace", []))
    for a in r.get("alertas", []):
        etapas += f"\n- ALERTA: {a}"
    return "", historico, fontes, etapas


def redigir(texto, local):
    if not (texto or "").strip():
        return "", "", "", "Escreva o que está acontecendo.", ""
    with TRAVA:
        d = A.relato(texto, local or "")
    if d.get("tipo") == "emergencia":
        return "", "", "", d["texto"], ""
    aviso = f"Dados pessoais ocultados: {', '.join(d['pii'])}." if d.get("pii") else ""
    s = d.get("triagem") or {}
    dec = "vai para revisão humana" if "revis" in str(s.get("decisao", "")) else "segue automático"
    tri = f"{s.get('rotulo', '')} · confiança {float(s.get('confianca', 0)):.0%} · prioridade {s.get('prioridade') or '-'} · {dec}"
    return d.get("titulo", ""), d.get("descricao", ""), tri, aviso, ", ".join(d.get("fontes") or [])


with gr.Blocks(title="InovaBot · InovaCity") as demo:
    gr.Markdown(f"# InovaBot – assistente de IA da InovaCity\nModelo em uso: **{MODO}**. "
                "As respostas são apoio informativo e não substituem a vistoria técnica nem o atendimento de emergência (193, 192, 190, 199).")
    with gr.Tab("Conversar"):
        try:
            chat = gr.Chatbot(type="messages", height=380, label="Conversa")   # Gradio 4 e 5
        except TypeError:
            chat = gr.Chatbot(height=380, label="Conversa")                    # Gradio 6: o formato de mensagens já é o padrão
        entrada = gr.Textbox(label="Pergunta", placeholder="Ex.: como tratar a água depois da enchente?")
        fontes = gr.Textbox(label="Fontes usadas", interactive=False)
        etapas = gr.Textbox(label="Etapas (proteções, busca, verificação)", lines=4, interactive=False)
        entrada.submit(conversar, [entrada, chat], [entrada, chat, fontes, etapas])
        gr.Button("Enviar").click(conversar, [entrada, chat], [entrada, chat, fontes, etapas])
    with gr.Tab("Redigir relato"):
        t = gr.Textbox(label="O que está acontecendo", lines=4)
        l = gr.Textbox(label="Onde fica (rua, referência)")
        ti = gr.Textbox(label="Título sugerido")
        de = gr.Textbox(label="Descrição sugerida", lines=3)
        tr = gr.Textbox(label="Triagem prévia (sugestão; exige revisão humana)")
        av = gr.Textbox(label="Dados ocultados")
        fo = gr.Textbox(label="Fontes relacionadas")
        gr.Button("Preparar relato", variant="primary").click(redigir, [t, l], [ti, de, tr, av, fo])

if __name__ == "__main__":
    demo.launch(server_name="127.0.0.1", server_port=int(os.getenv("PORT", "7860")))
