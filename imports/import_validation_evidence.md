# Evidência de Validação Final

## Consulta autenticada e custos

O teste de integração `server/fichas.listar.integration.test.ts` foi executado com sucesso em 19/08/2026. A consulta autenticada `fichas.listar` devolveu **128 fichas técnicas**, incluiu **Tártaro Toro** e não devolveu o nome excluído **Tartaro Toro**. O teste também confirmou a presença de custos calculados positivos, incluindo a ficha **1/4 Gyutataki**.

O teste autenticado `server/receitas.import.integration.test.ts` confirmou as **104 receitas base**. Todas permanecem com rendimento esperado e custo médio a zero, por decisão explícita de não criar valores provisórios; a consulta de custo da receita **Shari** devolve uma árvore vazia e custo total de **0 €** até ao preenchimento manual do rendimento.

## Renderização da interface

Após a otimização de cálculo em lotes no router de fichas, a verificação visual autenticada da página `/fichas` mostrou **128 fichas activas** e a tabela preenchida, incluindo custos por dose visíveis para fichas como **1/4 Gyutataki**, **1/4 Usuzukuri Carabineiro** e **Abacate Maki**.

Na captura, a navegação lateral mostra o utilizador autenticado **Rafael Reis — Administrador**. A inspeção da sessão autenticada em 19/08/2026 confirmou diretamente o cabeçalho **128 fichas activas**, a tabela de fichas preenchida e a resposta tRPC com os mesmos registos e custos calculados.

## Regras preservadas

- Os rendimentos das receitas base permanecem sem preenchimento, para edição manual posterior.
- O ingrediente existente **Wasabi fresco** foi preservado e não foi criada receita base duplicada.
- Foi mantida apenas a ficha técnica do item 294, com o nome **Tártaro Toro**.
