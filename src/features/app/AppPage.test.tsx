import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppPage } from "./AppPage";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("studio workflow", () => {
  it("suggests matching businesses and opens a focused confirmation before the editor", async () => {
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === "/api/places/search" && init?.method !== "POST")
        return Response.json({ configured: true, availableWithoutAccount: true });
      if (input === "/api/places/search" && init?.method === "POST")
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
            photos: [{ name: "places/ChIJdemo/photos/PhotoA", attributions: [] }],
            rating: 4.8,
            userRatingCount: 27,
            reviews: [
              {
                rating: 5,
                text: "Pão excelente.",
                author: { displayName: "Ana", uri: null },
                relativeTime: "há 1 mês",
              },
            ],
          },
        });
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<AppPage />);
    expect(screen.queryByRole("button", { name: /criar conta|entrar/i })).not.toBeInTheDocument();
    fireEvent.change(await screen.findByRole("textbox", { name: /nome da empresa e cidade/i }), {
      target: { value: "Padaria Central" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /padaria central/i }, { timeout: 2000 }),
    );
    const dialog = screen.getByRole("dialog", { name: /criar novo site/i });
    expect(await screen.findByText("Confira a empresa encontrada.")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("Buscar empresa cadastrada");
    expect(dialog).toHaveTextContent("Gastronomia");
    expect(await screen.findByText("27 avaliações no Google")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("1 foto(s) retornada(s)");
    fireEvent.click(screen.getByText(/ver avaliações retornadas pelo Google/i));
    expect(dialog).toHaveTextContent("Pão excelente.");
    expect(fetcher).not.toHaveBeenCalledWith("/api/auth/session", expect.anything());
  });

  it("starts without login, explains unavailable Google search and keeps manual creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ configured: false, availableWithoutAccount: false })),
    );
    render(<AppPage />);
    expect(screen.getByRole("heading", { name: /digite a empresa/i })).toBeInTheDocument();
    expect(
      await screen.findByText(/busca do Google ainda não foi configurada/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /nome da empresa e cidade/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /criar sem buscar/i }));
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

  it("saves an authorized cover photo with a new site", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ configured: false, availableWithoutAccount: false })),
    );
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 1200, height: 800, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/webp;base64,QUJD",
    );
    render(<AppPage />);
    fireEvent.click(await screen.findByRole("button", { name: /criar sem buscar/i }));
    const dialog = screen.getByRole("dialog", { name: /criar novo site/i });
    fireEvent.change(dialog.querySelector('input[placeholder="Ex.: Estúdio Aurora"]')!, {
      target: { value: "Café Aurora" },
    });
    fireEvent.change(screen.getByLabelText(/foto própria ou autorizada para a capa/i), {
      target: { files: [new File(["photo"], "capa.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /^criar site$/i }));

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("site-express-local-workspace-v1") ?? "{}");
      expect(saved.sites[0].publicData.appearance.heroImage).toBe("data:image/webp;base64,QUJD");
      expect(saved.sites[0].publicData.isDemo).toBe(false);
    });
  });
});
