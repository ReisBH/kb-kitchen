# Destinos limpos de stock — rendimentos de proteínas

**Data:** 20/08/2026  
**Resultado:** foram configurados **18 pares bruto → limpo** para a ferramenta de rendimentos.

Foi aplicada a regra solicitada: criar um artigo novo com o sufixo **“Limpo”** quando não existia uma correspondência segura e reutilizar um artigo já existente quando a correspondência era inequívoca. Todos os destinos estão ativos, usam gramas e têm `tipo = proteina_limpa` com ligação explícita pelo campo `artigoBrutoId`.

| ID bruto | Ingrediente bruto | ID destino | Destino de stock limpo | Decisão |
|---:|---|---:|---|---|
| 15 | Ameijoa | 90001 | Ameijoa Limpo | Criado |
| 72 | Kagoshima | 90002 | Kagoshima Limpo | Criado |
| 104 | Ostras | 90003 | Ostras Limpo | Criado |
| 238 | Bacalhau | 90004 | Bacalhau Limpo | Criado |
| 239 | Bacalhau fresco | 90005 | Bacalhau fresco Limpo | Criado |
| 250 | Costela wagyu | 45 | Costela wagyu produção | Reutilizado |
| 253 | Enguia fresca | 90006 | Enguia fresca Limpo | Criado |
| 255 | Espadarte | 90007 | Espadarte Limpo | Criado |
| 272 | Lírio | 90008 | Lírio Limpo | Criado |
| 274 | Lula | 90009 | Lula Limpo | Criado |
| 275 | Lula puntilha | 90010 | Lula puntilha Limpo | Criado |
| 276 | Maminha wagyu/Lomo Bajo | 90011 | Maminha wagyu/Lomo Bajo Limpo | Criado |
| 298 | Salmao selvagem | 90012 | Salmao selvagem Limpo | Criado |
| 299 | Salmonete | 90013 | Salmonete Limpo | Criado |
| 300 | Sardinha | 90014 | Sardinha Limpo | Criado |
| 301 | Sarrajão | 90015 | Sarrajão Limpo | Criado |
| 308 | Unagi Kabayaki (enguia) | 90016 | Unagi Kabayaki (enguia) Limpo | Criado |
| 310 | Vazia | 90017 | Vazia Limpo | Criado |

> A verificação autenticada da ferramenta confirmou que, ao selecionar **Bacalhau**, o único destino apresentado é **Bacalhau Limpo**. O destino é selecionado automaticamente quando existe apenas uma associação válida.

## Validações

| Controlo | Resultado |
|---|---|
| Pares bruto → limpo ativos | 18 de 18 |
| Artigos novos criados | 17 |
| Artigos existentes reutilizados | 1 |
| Verificação visual de destino associado | Confirmada para Bacalhau |
| Lógica do seletor para os 18 pares | Um destino único confirmado por teste de integração |
| TypeScript | Sem erros |
| Testes automatizados | 45 testes aprovados |
