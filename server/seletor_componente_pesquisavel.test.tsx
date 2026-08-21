// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeletorComponentePesquisavel } from "../client/src/components/SeletorComponentePesquisavel";

const opcoes = [
  { id: 1, nome: "Abacate", unidadeBase: "g", tipo: "ingrediente" as const },
  { id: 2, nome: "Molho Tare", unidadeBase: "g", tipo: "receita_base" as const },
  { id: 3, nome: "Kabuki Sushi", unidadeBase: "ficha", tipo: "ficha_tecnica" as const },
];

afterEach(cleanup);

describe("SeletorComponentePesquisavel", () => {
  it("abre por parâmetro de URL e mostra resultados de ingrediente, receita e ficha", () => {
    window.history.replaceState({}, "", "?pesquisarComponentes=1");
    render(<SeletorComponentePesquisavel value="" onChange={vi.fn()} onSelecionarFicha={vi.fn()} opcoes={opcoes} />);

    expect(screen.getByRole("button", { name: /abacate/i }).textContent).toContain("Ingrediente · g");
    expect(screen.getByRole("button", { name: /molho tare/i }).textContent).toContain("Receita · g");
    expect(screen.getByRole("button", { name: /kabuki sushi/i }).textContent).toContain("Ficha · copiar componentes · ficha");
    window.history.replaceState({}, "", "/");
  });

  it("pesquisa e seleciona ingrediente, receita base e ficha técnica", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSelecionarFicha = vi.fn();
    render(<SeletorComponentePesquisavel value="" onChange={onChange} onSelecionarFicha={onSelecionarFicha} opcoes={opcoes} />);

    const pesquisa = screen.getByPlaceholderText("Pesquisar ingrediente ou receita…");
    await user.type(pesquisa, "abaca");
    await user.click(screen.getByRole("button", { name: /abacate/i }));
    expect(onChange).toHaveBeenLastCalledWith("1");

    await user.type(pesquisa, "tare");
    await user.click(screen.getByRole("button", { name: /molho tare/i }));
    expect(onChange).toHaveBeenLastCalledWith("2");

    await user.type(pesquisa, "kabuki");
    await user.click(screen.getByRole("button", { name: /kabuki sushi/i }));
    expect(onSelecionarFicha).toHaveBeenCalledWith(3);
  });

  it("mostra o conteúdo aninhado quando a ficha técnica é expandida", async () => {
    const user = userEvent.setup();
    const alternar = vi.fn();
    render(<SeletorComponentePesquisavel value="3" tipoSelecionado="ficha" onChange={vi.fn()} opcoes={opcoes} permitirReferenciaFicha permitirExpansaoFicha fichaExpandida={false} onAlternarFichaExpandida={alternar} conteudoFichaExpandida={<p>Ingredientes da ficha</p>} />);

    await user.click(screen.getByTitle("Mostrar ingredientes"));
    expect(alternar).toHaveBeenCalledOnce();
    expect(screen.queryByText("Ingredientes da ficha")).toBeNull();
  });
});
