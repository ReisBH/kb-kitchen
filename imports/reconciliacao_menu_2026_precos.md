# Reconciliação de preços — Menu Degustação e À La Carte 2026

**Fonte:** `Menu_Degustacao_-_A_La_Carte_2026.pdf`  
**Ação efetuada:** atualização de preço de venda nas fichas com correspondência de nome e produto considerada segura.  
**Ação não efetuada:** criação de fichas vazias ou atualização de preços por grama sem confirmação explícita.

## Atualizações aplicadas

Foram atualizadas **50 fichas técnicas**. As correspondências incluem nomes iguais, variantes ortográficas evidentes e prefixos funcionais, por exemplo `Sashimi Sake` para **Sake**, `Usuzukuri Bulhao Pato` para **Bulhão Pato** e `N Kagoshima A5` para o nigiri **Kagoshima**. Os preços foram copiados exatamente do menu.

| Grupo do menu | Fichas atualizadas | Exemplos de preço |
|---|---:|---|
| Menu / sashimi / donburi | 12 | Menu Kabuki 125 €, Kaisendon 42 €, Sashimi Kabuki 120 € |
| Tártaro e otsukuri | 12 | Maguro Picante 36 €, Tártaro Toro 52 €, Carabineiro 44 € |
| Sushi, nigiri, maki e temaki | 20 | Edomae Sushi 72 €, Kabuki Sushi 80 €, Nigiris 8–32 € |
| Robata, niku e acompanhamentos | 6 | Niku-Take Nabe 52 €, Costela Wagyu 42 €, Gohan 6 € |

> As fichas `Edomae Sushi`, `Kabuki Sushi`, `N Burguer`, `Gohan` e algumas outras permanecem em **rascunho**; o preço foi preenchido, mas a publicação continua dependente da validação normal de componentes e preço.

## Itens que requerem decisão antes de criar ou atualizar

| Prato/preço no menu | Situação no banco | Decisão necessária |
|---|---|---|
| Menu Kabuki Ampliado — 150 €/pessoa | Existe `Menu Extendido`, mas o nome não prova que seja o mesmo menu. | Confirmar associação ou criar ficha vazia. |
| Menu Degustação Vegan — 100 €/pessoa | Não encontrada ficha correspondente. | Criar ficha vazia? |
| Menu Vegan Ampliado — 120 €/pessoa | Não encontrada ficha correspondente. | Criar ficha vazia? |
| Ostra Natural — 5 €/un | Existe `Trio de Ostras`, produto diferente. | Criar ficha vazia para unidade? |
| Gyoza Kabuki — 16 € | Existe `Gyoza Buta Aper`, produto diferente. | Criar ficha vazia? |
| Gyoza Carabineiro — 36 € | Não encontrada ficha correspondente. | Criar ficha vazia? |
| Preparações vegan do menu | Não há fichas inequívocas para Agadashi Tofu, Abacate Picante, Kakiage, Couve Chinesa, Yasai Sushi e Mochi tradicional. | Confirmar quais devem ter ficha individual. |
| Abacate Estrelado — 26 € | Existe `Tartaro Abacate Picante`; não foi assumida equivalência porque o menu indica ovo e batata. | Confirmar associação ou criar ficha vazia. |
| Belota, Toro Flambé | Não encontradas fichas específicas. | Criar fichas vazias? |
| Unagi Kabayaki (nigiri) — 8 € | Existe `N Unagi`, mas a designação não confirma a preparação kabayaki. | Confirmar associação ou criar ficha vazia. |
| Yasai Maki — 14 € | Existe `Maki Vegetariano`, mas a equivalência não é comprovada. | Confirmar associação ou criar ficha vazia. |
| Temaki Bochecha — 14 € | Não encontrada ficha correspondente. | Criar ficha vazia? |
| Yasai/Moriawase/Ebi Tempura | Não encontradas fichas inequívocas; `N Ebi` é uma ficha de nigiri. | Criar fichas vazias? |
| Minhota Vazia — 0,50 €/g | Não há ficha correspondente; o campo atual de preço não distingue claramente preço por grama. | Criar ficha com regra de preço por peso? |
| Kagoshima — 1,10 €/g | Existe ficha `Kagoshima`, mas o preço no menu é por grama e não por dose. | Confirmar regra de preço por peso; não preencher como 1,10 €/dose. |

## Observação de controlo financeiro

Os preços por pessoa e por unidade foram guardados como preço da ficha porque a unidade comercial é explícita no menu. Os preços por grama foram deliberadamente excluídos, pois gravá-los no campo `precoVenda` sem uma unidade comercial associada produziria margem e food cost incorretos.
