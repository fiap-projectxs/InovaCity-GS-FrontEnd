# Revisão humana
## Quando um relato vai para uma pessoa
Se a confiança da classificação for menor que 0,45, ou seja, menos de 45%, o robô não decide sozinho. O relato recebe o status Revisão humana e entra na fila da equipe de administração.
## O que a equipe faz
Quem administra a plataforma vê o texto, a categoria que o robô sugeriu e a confiança. Pode confirmar ou corrigir a categoria, o que encaminha o relato, ou rejeitar o relato.
## Por que existe essa etapa
O classificador foi treinado com dados sintéticos e erra: no teste, acertou 80% no total e 89,8% nos casos que decidiu sozinho. A revisão humana evita que um erro de baixa confiança vire um encaminhamento errado.
## Pedir uma revisão
Se você acha que a categoria do seu relato está errada, descreva o caso a uma pessoa da equipe: no protótipo, a decisão final de qualquer relato duvidoso é humana.
