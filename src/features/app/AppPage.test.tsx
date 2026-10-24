import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppPage } from "./AppPage";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("studio workflow", () => {
  it("suggests matching businesses and opens a focused confirmation before the editor", async () => {
    const fetcher = vi.fn(async (input: string) => {
      if (input === "/api/auth/session") return new Response(null, { status: 401 });
      if (input === "/api/places/search")
        return Response.json({
          results: [
            {
              placeId: "ChIJdemo",
              name: "Padaria Central",
              address: "Rua Um, 10",
              category: "bakery",
            },
          ],
        });
      if (input === "/api/places/details")
        return Response.json({
          business: {
            placeId: "ChIJdemo",
            name: "Padaria Central",
            address: "Rua Um, 10",
            photos: [],
          },
        });
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<AppPage />);
    fireEvent.click(await screen.findByRole("button", { name: /continuar neste navegador/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /nome da empresa e cidade/i }), {
      target: { value: "Padaria Central" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /padaria central/i }, { timeout: 2000 }),
    );
    const dialog = screen.getByRole("dialog", { name: /criar novo site/i });
    expect(await screen.findByText("Confira a empresa encontrada.")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("Buscar empresa cadastrada");
    expect(dialog).toHaveTextContent("Gastronomia");
  });

  it("creates and duplicates a local draft without publishing it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<AppPage />);
    fireEvent.click(await screen.findByRole("button", { name: /continuar neste navegador/i }));
    expect(screen.getByRole("heading", { name: /digite a empresa/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /criar site agora/i }));
    const dialog = screen.getByRole("dialog", { name: /criar novo site/i });
    fireEvent.change(dialog.querySelector('input[placeholder="Ex.: Estúdio Aurora"]')!, {
      target: { value: "Ateliê Verde" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^criar site$/i }));
    expect(
      await screen.findByText("Ateliê Verde", { selector: ".sx-studio-title strong" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /voltar aos projetos/i }));
    fireEvent.click(screen.getByRole("button", { name: /duplicar ateliê verde/i }));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /abrir editor/i })).toHaveLength(2),
    );
    expect(screen.getByText(/cópia de “ateliê verde” criada como rascunho/i)).toBeInTheDocument();
  });
});
