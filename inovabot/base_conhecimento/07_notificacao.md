# Notificação ao órgão
## Como funciona no protótipo
Depois da triagem, o sistema tenta notificar o órgão da categoria. A notificação é simulada: não existe integração real com nenhuma prefeitura ou órgão público.
## Tentativas e falhas
O envio tenta até 3 vezes. Se todas falharem, o relato continua com status Em análise e a notificação fica pendente para reenvio. A administração pode reenviar pela aba Notificações.
## Falha simulada
Para demonstrar o tratamento de erros, cerca de 30% das tentativas falham de propósito. Na administração há uma opção para simular o serviço do órgão fora do ar, em que todas as tentativas falham.
## Protocolo
Quando o envio dá certo, o relato recebe um protocolo simulado que começa com SIM. Esse protocolo não existe fora da InovaCity.
