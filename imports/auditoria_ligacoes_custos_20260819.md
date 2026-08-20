# Auditoria de Ligações e Custos — 19/08/2026

## Cobertura de componentes

| Origem | Componentes | Ligados a artigo existente | Sem artigo | Com custo direto ativo | Sem custo direto |
|---|---:|---:|---:|---:|---:|
| Receitas base | 252 | 252 | 0 | 230 | 22 |
| Fichas técnicas | 272 | 272 | 0 | 214 | 58 |
| **Total** | **524** | **524** | **0** | **444** | **80** |

Todos os componentes guardados nas receitas e fichas apontam para artigos existentes no KB Kitchen. As 80 linhas sem custo médio direto são referências a receitas base, não ingredientes ausentes.

## Motor de custo

O cálculo de custo passou a percorrer as receitas base vinculadas até aos seus ingredientes, sem somar o custo do artigo intermédio em duplicado. Assim, quando uma receita base tiver rendimento preenchido, o custo dos seus produtos vinculados passa para a receita consumidora e para a ficha técnica final.

## Pendência necessária para custo por unidade

As 104 receitas base têm atualmente rendimento esperado igual a zero, por decisão de não introduzir rendimentos provisórios. Sem rendimento, o sistema não pode distribuir o custo do lote por g/ml/unidade de forma rigorosa; por isso, o custo de receitas base permanece pendente até ao respetivo preenchimento manual.
