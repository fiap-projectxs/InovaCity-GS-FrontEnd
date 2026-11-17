"""Seção Gradio 'Redigir relato' do InovaBot (embutida no site em /#/inovabot)."""
import gradio as gr


def criar_app(assistente, trava):
    def redigir(texto, local):
        if not (texto or "").strip():
            return "", "", "", "Escreva o que está acontecendo."
        with trava:
            d = assistente.relato(texto, local or "")
        if d.get("tipo") == "emergencia":
            return "", "", "", d["texto"]
        aviso = f"Dados pessoais ocultados: {', '.join(d['pii'])}. " if d.get("pii") else ""
        s = d.get("triagem") or {}
        dec = "vai para revisão humana" if "revis" in str(s.get("decisao", "")) else "segue automático"
        tri = f"{s.get('rotulo', '')} · confiança {float(s.get('confianca', 0)):.0%} · prioridade {s.get('prioridade') or '-'} · {dec}"
        return d.get("titulo", ""), d.get("descricao", ""), tri, aviso.strip()

    with gr.Blocks(title="InovaBot · Redigir relato") as app:
        gr.Markdown("### Redigir relato")
        t = gr.Textbox(label="O que está acontecendo", lines=4)
        l = gr.Textbox(label="Onde fica (rua, referência)")
        b = gr.Button("Preparar relato", variant="primary")
        ti = gr.Textbox(label="Título sugerido"); de = gr.Textbox(label="Descrição sugerida", lines=3)
        tr = gr.Textbox(label="Triagem prévia (sugestão automática)"); av = gr.Textbox(label="Dados ocultados")
        b.click(redigir, [t, l], [ti, de, tr, av])
    return app
