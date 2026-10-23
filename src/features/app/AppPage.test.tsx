import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppPage } from "./AppPage";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("studio workflow", () => {
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
