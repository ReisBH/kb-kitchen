# Reconciliação de preços — Menu Degustação e À La Carte 2026

**Fonte:** `Menu_Degustacao_-_A_La_Carte_2026.pdf`  
**Ação efetuada:** atualização de preço de venda nas fichas com correspondência de nome e produto considerada segura.  
**Decisões posteriores:** aplicadas após confirmação explícita do utilizador; as novas fichas mantêm-se em rascunho até receberem componentes e passarem pela publicação controlada.

## Atualizações aplicadas

Foram atualizadas **50 fichas técnicas**. As correspondências incluem nomes iguais, variantes ortográficas evidentes e prefixos funcionais, por exemplo `Sashimi Sake` para **Sake**, `Usuzukuri Bulhao Pato` para **Bulhão Pato** e `N Kagoshima A5` para o nigiri **Kagoshima**. Os preços foram copiados exatamente do menu.

| Grupo do menu | Fichas atualizadas | Exemplos de preço |
|---|---:|---|
| Menu / sashimi / donburi | 12 | Menu Kabuki 125 €, Kaisendon 42 €, Sashimi Kabuki 120 € |
| Tártaro e otsukuri | 12 | Maguro Picante 36 €, Tártaro Toro 52 €, Carabineiro 44 € |
| Sushi, nigiri, maki e temaki | 20 | Edomae Sushi 72 €, Kabuki Sushi 80 €, Nigiris 8–32 € |
| Robata, niku e acompanhamentos | 6 | Niku-Take Nabe 52 €, Costela Wagyu 42 €, Gohan 6 € |

> As fichas `Edomae Sushi`, `Kabuki Sushi`, `N Burguer`, `Gohan` e algumas outras permanecem em **rascunho**; o preço foi preenchido, mas a publicação continua dependente da validação normal de componentes e preço.

## Decisões confirmadas e aplicadas

| Prato/preço no menu | Decisão aplicada | Resultado |
|---|---|---|
| Menu Kabuki Ampliado — 150 €/pessoa | Associar a `Menu Extendido` | Preço de 150 € preenchido; permanece em rascunho. |
| Menu Degustação Vegan — 100 €/pessoa | Criar ficha vazia | Ficha criada em rascunho. |
| Menu Vegan Ampliado — 120 €/pessoa | Criar ficha vazia | Ficha criada em rascunho. |
| Ostra Natural — 5 €/un | Criar ficha vazia | Ficha criada em rascunho. |
| Gyoza Kabuki — 16 € | Não criar | Excluído da criação, conforme decisão. |
| Gyoza Carabineiro — 36 € | Criar ficha vazia | Ficha criada em rascunho. |
| Agadashi Tofu, Abacate Picante, Kakiage, Couve Chinesa, Yasai Sushi e Mochi Tradicional | Criar fichas individuais | Seis fichas criadas em rascunho; preço apenas quando o menu o especifica. |
| Abacate Estrelado — 26 € | Criar ficha vazia | Ficha criada em rascunho. |
| Belota — 8 €; Toro Flambé — 9 € | Criar fichas vazias | Duas fichas criadas em rascunho. |
| Unagi Kabayaki (nigiri) — 8 € | Associar a `N Unagi` | Preço de 8 € preenchido na ficha existente. |
| Yasai Maki — 14 € | Associar a `Maki Vegetariano` | Preço de 14 € preenchido na ficha existente. |
| Temaki Bochecha — 14 € | Criar ficha vazia | Ficha criada em rascunho. |
| Tempura Yasai — 28 €; Tempura Moriawase — 32 €; Tempura Ebi — 36 € | Criar fichas vazias | Três fichas criadas em rascunho. |
| Minhota Vazia — 0,50 €/g | Criar regra por peso | Ficha criada com preço por grama e pedido mínimo de 200 g. |
| Kagoshima — 1,10 €/g | Atualizar regra por peso | Ficha existente atualizada com pedido mínimo de 150 g. |

## Observação de controlo financeiro

Os preços por pessoa, unidade e dose foram guardados como preço da ficha porque a unidade comercial é explícita no menu. Para Minhota Vazia e Kagoshima, foi acrescentada a unidade comercial `g` e o campo `quantidadeMinimaVenda`. O registo de vendas valida esse mínimo no servidor antes de aceitar uma venda, evitando tratar 0,50 € ou 1,10 € como preço por dose.
