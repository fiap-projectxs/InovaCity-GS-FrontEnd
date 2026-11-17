# Robô de triagem (RPA)
## O que o robô faz
O robô de RPA processa lotes de relatos em CSV com as colunas id, texto, lat, lon e data. Para cada linha ele valida, classifica, verifica duplicidade, define prioridade e notifica o órgão.
## Quarentena
Linhas inválidas, como texto vazio, coordenada fora do intervalo ou data impossível, vão para a quarentena com o motivo, e o robô segue com as demais.
## Rodar duas vezes
O robô guarda os identificadores já processados. Se o mesmo arquivo for processado de novo, as linhas repetidas são ignoradas, o que evita notificar o órgão duas vezes.
## Teste no site
Na página Robô é possível enviar um CSV e ver a triagem no próprio navegador, sem notificação ao serviço externo. Na administração, quem é administrador pode importar as linhas processadas como ocorrências.
