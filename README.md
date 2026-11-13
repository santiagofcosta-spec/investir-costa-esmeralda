# Investir na Costa Esmeralda

Dashboard para apresentar a clientes por que investir em imóveis na Costa Esmeralda (SC):
valorização FipeZap (Itapema, Balneário Camboriú, Florianópolis, Brasil), CUB/SC,
Selic, CDI, IPCA, IGP-M, INCC e simulador de investimento/ROI.

## Como os dados se atualizam

| Dado | Como | Quando |
|---|---|---|
| Selic, CDI, IPCA, IGP-M, INCC, poupança | A página busca direto no Banco Central | Toda vez que alguém abre |
| FipeZap e CUB/SC | Robô `scripts/atualizar.py` (GitHub Actions) | Dias 3, 8, 12, 18 e 25 de cada mês |

Se o Banco Central estiver fora do ar, a página usa os últimos dados salvos em `dados/dados.js`.

Para rodar o robô na hora: aba **Actions** → "Atualizar dados" → **Run workflow**.
