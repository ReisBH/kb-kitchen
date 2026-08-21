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
              componenteId: 41,
              nomeComponente: "Kombu",
              quantidade: "30",
              unidade: "g",
              tipoComponente: "ingrediente",
            }],
          },
          isLoading: false,
        })),
      },
    },
  },
}));

import { LinhaComponenteFichaExpandida } from "../client/src/pages/FichasTecnicas";

afterEach(cleanup);

describe("Receita expandida dentro do editor de ficha", () => {
  it("mantém os ingredientes da receita ocultos até ao clique na seta", () => {
    render(<LinhaComponenteFichaExpandida componente={{
      id: 1,
      componenteId: 60042,
      nomeComponente: "Sukiyaki Semi-elaborado",
      quantidade: "1",
      unidade: "ml",
      tipoComponente: "receita_base",
    }} />);

    expect(screen.getByText("Sukiyaki Semi-elaborado")).toBeTruthy();
    expect(screen.queryByText("Kombu")).toBeNull();

    fireEvent.click(screen.getByTitle("Mostrar ingredientes da receita"));
    expect(screen.getByText("Kombu")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Ocultar ingredientes da receita"));
    expect(screen.queryByText("Kombu")).toBeNull();
  });
});
