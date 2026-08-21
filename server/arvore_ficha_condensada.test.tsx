// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ArvoreNo } from "../client/src/pages/FichaDetalhe";

afterEach(cleanup);

describe("Árvore condensada de ficha técnica", () => {
  it("mantém os ingredientes ocultos até ao clique na seta do componente", async () => {
    render(<ArvoreNo mostrarCustos={false} no={{ nome: "Tsukemono Aper", quantidade: 1, unidade: "dose", tipo: "ficha_tecnica", filhos: [{ nome: "Cenoura", quantidade: 1, unidade: "g", tipo: "ingrediente" }] }} />);

    expect(screen.getByText("Tsukemono Aper")).toBeTruthy();
    expect(screen.queryByText("Cenoura")).toBeNull();

    fireEvent.click(screen.getByTitle("Expandir componentes"));
    expect(screen.getByText("Cenoura")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Ocultar componentes"));
    expect(screen.queryByText("Cenoura")).toBeNull();
  });
});
