# Plano Urgente — Correção da Unidade de Custo no Rendimento de Proteínas

**Data:** 20/08/2026  
**Estado de risco atual:** a falha está confirmada no código, mas a consulta de impacto encontrou **0 testes de rendimento**, **0 movimentos de transformação de rendimento** e **0 artigos limpos com entrada por rendimento**. Portanto, **não há recuperação histórica a executar neste momento**. [1] [2]

> **Decisão operacional imediata:** não corrigir movimentos manualmente nem alterar custos médios antes de confirmar a existência de dados afetados. A primeira versão corretiva deve impedir a criação de novos registos incorretos e provar o cálculo por testes automatizados.

## 1. O defeito e a fórmula correta

O router calcula corretamente o custo total da compra em euros, mas calcula `custoRealPorKg` dividindo esse valor pelo peso limpo em **gramas**. O resultado é, na realidade, um custo em **€/g**. Depois, ao criar a entrada do artigo limpo, divide esse mesmo valor novamente por 1 000, reduzindo o custo do stock limpo por um fator de 1 000. [1]

| Exemplo de controlo | Fórmula correta | Resultado esperado |
|---|---|---:|
| Peso bruto | dado de entrada | 1 000 g |
| Preço bruto | dado de entrada | 10,00 €/kg |
| Custo total da compra | `(1 000 / 1 000) × 10` | 10,00 € |
| Peso limpo | dado de entrada | 800 g |
| Custo real por kg limpo | `(10 / 800) × 1 000` | 12,50 €/kg |
| Custo por grama limpa | `12,50 / 1 000` | 0,012500 €/g |

O movimento de entrada em stock trabalha com gramas; por isso, deve receber **0,012500 €/g**, não **0,0000125 €/g**.

## 2. Plano de contenção e correção

| Etapa | Ação concreta | Ficheiros/localização | Critério de aceitação |
|---|---|---|---|
| 1. Preservar evidência | Exportar, apenas para auditoria, testes e movimentos com `documentoTipo = 'rendimento'`. Não fazer `UPDATE`/`DELETE` manual. | Consulta de leitura a `testes_rendimento` e `movimentos` | A matriz de impacto é guardada antes da publicação. |
| 2. Isolar o cálculo | Criar `calcularCustoRendimento()` em `server/engine/rendimento.ts`, com entradas em gramas e preço por kg. | Novo módulo de domínio; `server/routers/rendimento.ts:82–88` passa a chamar a função. | Uma única fonte de verdade para `custoTotal`, `custoLiquido`, `custoRealPorKg` e `custoPorGrama`. |
| 3. Corrigir unidades | Aplicar `custoRealPorKg = (custoLiquido / pesoLimpo) * 1000` e `custoPorGrama = custoRealPorKg / 1000`. | `server/routers/rendimento.ts:85–111` | O registo histórico guarda €/kg e o movimento de entrada recebe €/g. |
| 4. Validar entradas | Rejeitar peso limpo superior ao bruto; rejeitar custo líquido negativo; apresentar unidade explicitamente no resultado. | Validação Zod e motor de cálculo | Não é possível gravar rendimento fisicamente impossível ou unidade ambígua. |
| 5. Tornar atómico | Criar saída do bruto, entrada do limpo e teste de rendimento numa única transação, com um `documentoId` comum. | Router de rendimento e serviço de movimentos | Falha simulada não deixa transformação parcial. |
| 6. Publicar com controlo | Executar TypeScript, testes unitários/integrados e um rendimento de teste em ambiente de desenvolvimento. | CI local e sessão autenticada | Valores da interface, da tabela e do movimento coincidem. |

## 3. Alteração técnica proposta

```ts
// server/engine/rendimento.ts
export function calcularCustoRendimento(input: {
  pesoBrutoGramas: number;
  pesoLimpoGramas: number;
  precoKgBruto: number;
  valorAparas?: number;
}) {
  if (input.pesoLimpoGramas > input.pesoBrutoGramas) {
    throw new Error("O peso limpo não pode ser superior ao peso bruto.");
  }

  const custoTotalCompra = (input.pesoBrutoGramas / 1000) * input.precoKgBruto;
  const custoLiquido = custoTotalCompra - (input.valorAparas ?? 0);
  if (custoLiquido < 0) throw new Error("O valor das aparas não pode exceder o custo da compra.");

  const custoRealPorKg = (custoLiquido / input.pesoLimpoGramas) * 1000;
  const custoPorGrama = custoRealPorKg / 1000;

  return { custoTotalCompra, custoLiquido, custoRealPorKg, custoPorGrama };
}
```

No router, o movimento `transformacao_entrada` deve receber `custoUnitario: resultado.custoPorGrama`; `testes_rendimento.custoRealPorKg` deve receber `resultado.custoRealPorKg`. Isto torna explícita a unidade em cada destino.

## 4. Testes obrigatórios antes da publicação

| Caso | Entradas | Verificação esperada |
|---|---|---|
| Caso-base | 1 000 g bruto, 800 g limpo, 10 €/kg | 10 € de custo total; 12,5 €/kg; 0,0125 €/g. |
| Compra maior | 5 000 g bruto, 4 250 g limpo, 14,80 €/kg | 74 € de custo total; 17,411765 €/kg; 0,017411765 €/g. |
| Aparas valorizadas | 1 000 g bruto, 800 g limpo, 10 €/kg, 2 € de aparas | 8 € de custo líquido; 10 €/kg; 0,010 €/g. |
| Conservação de valor | Qualquer caso válido | `custoLiquido = pesoLimpoGramas × custoPorGrama + valorAparas`, dentro da tolerância decimal. |
| Peso inválido | Peso limpo > peso bruto | Erro de validação; nenhum movimento ou teste criado. |
| Falha na entrada limpa | Simular erro após saída bruta | A transação é revertida; nenhum movimento permanece. |
| Reenvio idêntico | Mesma chave de operação | Não duplica saída, entrada ou teste. |

## 5. Estratégia de recuperação caso surjam registos antigos

Como hoje não existem registos afetados, esta secção é um **procedimento de contingência**, não uma instrução para correr já.

| Cenário encontrado na exportação | Recuperação segura |
|---|---|
| Teste sem movimentos | Corrigir apenas o valor calculado do teste, com migração auditada que registe data, motivo e valor anterior. |
| Transformação com entrada e sem movimentos posteriores no artigo limpo | Criar **movimento de correção de valor**, não editar a entrada original. O ajuste altera apenas o custo médio/valor conforme regra contabilística aprovada. |
| Transformação seguida de produção, venda ou inventário | Não executar correção automática. Produzir relatório de cadeia de dependências e aprovar, com gestão, um recálculo cronológico controlado ou lançamento de ajuste financeiro. |
| Dados incompletos | Não inferir valores. Sinalizar exceção e exigir confirmação do Head Chef/Admin. |

> O princípio é imutabilidade: **nunca apagar ou reescrever movimentos históricos**. A recuperação deve acrescentar estornos/correções vinculados à operação de origem e preservar a auditoria.

## 6. Sequência de execução e decisão de publicação

1. Fazer checkpoint da versão atual e exportação de leitura dos rendimentos/movimentos.
2. Implementar o motor puro de cálculo e os testes de tabela acima.
3. Migrar o router para a função nova e agrupar a transformação numa transação.
4. Executar `pnpm exec tsc --noEmit` e `pnpm test`.
5. Registar um caso de teste autenticado: 1 000 g → 800 g a 10 €/kg.
6. Confirmar no livro: saída de 1 000 g do bruto, entrada de 800 g do limpo a 0,012500 €/g, ambos com o mesmo documento de operação.
7. Publicar apenas se os testes, interface e movimentos coincidirem.

## Referências

[1]: ../server/routers/rendimento.ts "Cálculo e movimentos de rendimento de proteínas"
[2]: auditoria_tecnica_evidencias_20260820.md "Evidências de auditoria técnica — impacto atual dos rendimentos"
