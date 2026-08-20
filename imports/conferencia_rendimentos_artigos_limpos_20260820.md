# Conferência de artigos limpos — ferramenta de rendimentos

**Data:** 20/08/2026  
**Âmbito:** ingredientes indicados pelo utilizador para inclusão na ferramenta de rendimentos de proteínas.

A lista recebida contém **18 ingredientes**, e não 20. Todos os 18 artigos foram marcados como `requerLimpeza = true`, pelo que já surgem no seletor de proteína da ferramenta de rendimentos.

Foi também verificada a tabela de artigos para encontrar, para cada ingrediente bruto, um artigo ativo do tipo `proteina_limpa` com `artigoBrutoId` igual ao ID do artigo bruto. **Não existe atualmente nenhum par bruto → limpo registado** para os itens abaixo.

| ID bruto | Ingrediente | Artigo limpo ligado | Estado |
|---:|---|---|---|
| 15 | Ameijoa | — | Não existe |
| 72 | Kagoshima | — | Não existe |
| 104 | Ostras | — | Não existe |
| 238 | Bacalhau | — | Não existe |
| 239 | Bacalhau fresco | — | Não existe |
| 250 | Costela wagyu | — | Não existe |
| 253 | Enguia fresca | — | Não existe |
| 255 | Espadarte | — | Não existe |
| 272 | Lírio | — | Não existe |
| 274 | Lula | — | Não existe |
| 275 | Lula puntilha | — | Não existe |
| 276 | Maminha wagyu/Lomo Bajo | — | Não existe |
| 298 | Salmao selvagem | — | Não existe |
| 299 | Salmonete | — | Não existe |
| 300 | Sardinha | — | Não existe |
| 301 | Sarrajão | — | Não existe |
| 308 | Unagi Kabayaki (enguia) | — | Não existe |
| 310 | Vazia | — | Não existe |

> A ferramenta apresenta estes ingredientes na lista de proteínas e informa, de forma explícita, quando ainda não há um destino limpo associado. Não é possível registar uma transformação de stock até ser criado ou ligado um artigo `proteina_limpa` correspondente; esta limitação impede entradas de stock em artigos errados.

## Validações efetuadas

| Verificação | Resultado |
|---|---|
| Inclusão dos 18 artigos no seletor de rendimentos | Confirmada em sessão autenticada |
| Pesquisa de artigos `proteina_limpa` por `artigoBrutoId` | 0 pares encontrados |
| Seleção de Bacalhau no browser | Aviso de ausência de artigo limpo apresentado |
| Compilação TypeScript | Sem erros |
| Testes automatizados | 43 testes aprovados |
| Cálculo no servidor | Corrigido para converter g para kg antes de aplicar o preço €/kg |
