// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    receitas: {
      obter: {
        useQuery: vi.fn(() => ({
          data: {
            componentes: [{
              id: 2,
              componenteId: 1,
              nomeComponente: "Kombu",
              quantidade: "30",
              unidade: "g",
              custoComponente: "0.035290",
              custoTotal: "1.0587",
              tipoComponente: "ingrediente",
            }],
          },
          isLoading: false,
        })),
      },
    },
  },
}));

import { LinhaComponenteReceita } from "../client/src/pages/ReceitaDetalhe";

afterEach(cleanup);

describe("Árvore condensada de receita base", () => {
  it("mantém a receita filha fechada até ao clique na seta", () => {
    render(<LinhaComponenteReceita mostrarCustos componente={{
      id: 1,
      componenteId: 60007,
      nomeComponente: "Dashi Semi-elaborado",
      quantidade: "400",
      unidade: "ml",
      custoComponente: "0.038692",
      custoTotal: "15.4768",
      tipoComponente: "receita_base",
    }} />);

    expect(screen.getByText("Dashi Semi-elaborado")).toBeTruthy();
    expect(screen.queryByText("Kombu")).toBeNull();

    fireEvent.click(screen.getByTitle("Expandir componentes"));
    expect(screen.getByText("Kombu")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Ocultar componentes"));
    expect(screen.queryByText("Kombu")).toBeNull();
  });
});
