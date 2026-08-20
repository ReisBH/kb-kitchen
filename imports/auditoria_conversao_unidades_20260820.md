# Auditoria de conversão de unidades e custos — 20/08/2026

## Regra aplicada

As referências culinárias passaram a usar gramas quando existe uma equivalência de peso confirmada. A unidade nativa do artigo continua a fundamentar o custo e o stock; a interface apresenta ambas de forma explícita quando diferem.

| Artigo ou grupo | Regra confirmada | Aplicação |
|---|---:|---|
| Ovos | 45 g por unidade | Referências convertidas para g; o custo continua calculado por unidade física |
| Flores, folhas, shiso, amaranto e microvasos | 5 g por unidade | Referências convertidas para g com equivalência de peso definida |
| Ovos de codorniz | Manter em un | 2 referências preservadas em unidade |
| Folha bambu | Manter em un | 4 referências preservadas em unidade |

## Conferência de unidades

| Unidade em componentes | Referências | Observação |
|---|---:|---|
| `g` ou `ml` | 518 | Aplicam a regra normal de receita/ficha técnica |
| `un` | 6 | Apenas **Folha bambu** (4) e **Ovos cordoniz** (2), conforme exceções confirmadas |

## Conferência de custos

O motor passou a distinguir a **quantidade de referência** da receita (por exemplo, 45,0 g de ovos) da **quantidade nativa** usada no custo e no stock (1 unidade de ovo). Assim, a ficha **Tártaro Sake Estrellado** apresenta 45,0 g de ovos, custo de 0,200000 €/un e custo de componente de 0,2000 €, sem multiplicação pelo fator de embalagem.

> Os custos detalhados continuam restritos aos perfis Administrador, Head-Chef e Sub-Chefe (Chef). A validação TypeScript e a suíte de 35 testes passaram após esta correção.
