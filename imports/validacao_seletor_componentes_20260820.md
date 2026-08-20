# Validação do seletor pesquisável de componentes — 20/08/2026

| Cenário | Evidência | Resultado |
|---|---|---|
| Receita base — formulário aberto em desktop | `/receitas?editar=60070&pesquisarComponentes=1` | O formulário de edição abre com o campo de pesquisa e resultados visíveis. |
| Ficha técnica — formulário aberto em desktop | `/fichas?editar=30001&pesquisarComponentes=1` | O formulário de edição abre com o campo de pesquisa e resultados visíveis. |
| Receita base — formulário aberto em móvel | Mesma rota, viewport 390 × 844 | O seletor e os resultados mantêm-se acessíveis no diálogo responsivo. |
| Ficha técnica — formulário aberto em móvel | Mesma rota, viewport 390 × 844 | O seletor e os resultados mantêm-se acessíveis no diálogo responsivo. |
| DOM — opções por tipo | `server/seletor_componente_pesquisavel.test.tsx` | O parâmetro `pesquisarComponentes=1` abre o seletor e mostra simultaneamente ingrediente, receita e ficha. |
| Pesquisa e seleção | `server/seletor_componente_pesquisavel.test.tsx` | A pesquisa aproxima-se de Abacate, Molho Tare e Kabuki Sushi; a seleção devolve o ingrediente/receita e a ficha é enviada para cópia de componentes. |

## Resultado automatizado

`pnpm exec tsc --noEmit && pnpm test -- seletor_componente_pesquisavel.test.tsx`

- 14 ficheiros de teste aprovados;
- 40 testes aprovados;
- a prova DOM confirma a abertura por URL e os rótulos **Ingrediente**, **Receita** e **Ficha**;
- a prova interativa confirma pesquisa e seleção de cada tipo de componente.

## Confirmação autenticada em browser

Em sessão autenticada de **Rafael Reis — Administrador**, foram confirmados no DOM do browser os dois formulários abertos por URL:

- receita: `/receitas?editar=60070&pesquisarComponentes=1` — 104 receitas carregadas; seletor aberto com botões de resultados como **Abacate — Ingrediente · g**;
- ficha: `/fichas?editar=30001&pesquisarComponentes=1` — 128 fichas ativas carregadas; formulário **Maguro Korokke Aper** com seletor aberto e resultados de ingredientes.

As capturas adicionais em viewport móvel 390 × 844 confirmaram a continuidade do diálogo e a lista de resultados sem sair do formulário.
