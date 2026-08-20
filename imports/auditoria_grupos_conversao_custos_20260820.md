# Auditoria por grupo convertido — 20/08/2026

Esta auditoria confirma que a quantidade apresentada em gramas é convertida para a fração da unidade nativa antes do cálculo do custo. Todos os valores abaixo foram verificados no banco de dados e em sessão autenticada.

| Grupo | Receita base validada | Evidência na receita | Ficha técnica validada | Evidência na ficha |
|---|---|---|---|---|
| Ovos | **Gema curada — Semi-Elaborado** (60082) | 900,0 g = 20 ovos × 0,200000 €/un = **4,0000 €** | **Tártaro Sake Estrellado** (30071) | 45,0 g = 1 ovo × 0,200000 €/un = **0,2000 €** |
| Flores / folhas | **Micro salada mix — Semi-elaborado** (60087) | Amaranto 0,8 g = 0,16 un × 3,550000 €/un = **0,5680 €** | **Usuzukuri Akami Caviar** (30046) | Flor manjericão 0,45 g = 0,09 un × 0,400000 €/un = **0,0360 €** |
| Shiso | **Micro salada mix — Semi-elaborado** (60087) | Vaso shiso verde 0,8 g = 0,16 un × 3,650000 €/un = **0,5840 €** | **Sashimi Akami** (30068) | Shiso verde 0,3 g = 0,06 un × 5,400000 €/un = **0,3240 €** |
| Microvasos | **Micro salada mix — Semi-elaborado** (60087) | Vaso sorrel 0,8 g = 0,16 un × 4,350000 €/un = **0,6960 €** | **Tataki Chutoro** (30058) | Vaso rabanate 0,05 g = 0,01 un × 4,350000 €/un = **0,0435 €** |

> A quantidade de referência continua mostrada em g. O custo unitário indica a unidade nativa de compra (`un`) e o custo total é calculado pela fração física correspondente, evitando multiplicação indevida.

## Exceções de unidade mantidas

| Artigo | Referências em `un` | Regra |
|---|---:|---|
| Folha bambu | 4 | Mantida em unidade, conforme solicitado. |
| Ovos cordoniz | 2 | Mantidos em unidade, conforme solicitado. |
