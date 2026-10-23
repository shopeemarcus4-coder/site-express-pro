import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContractsPage } from "./ContractsPage";
import { addCalendarDays, toBrazilCalendarDate, type ContractsState } from "./model";

describe("contract drafts", () => {
  it("opens a due alert and keeps owner-authored draft text in workspace changes", () => {
    const today = toBrazilCalendarDate(new Date());
    const endsOn = addCalendarDays(today, 15) ?? today;
    const value: ContractsState = {
      version: 1,
      clients: [
        { id: "first", name: "Primeiro cliente", email: "", phone: "", sites: [] },
        { id: "second", name: "Segundo cliente", email: "", phone: "", sites: [] },
      ],
      contracts: [
        {
          id: "draft-1",
          clientId: "second",
          siteId: null,
          kind: "site-maintenance",
          status: "review",
          title: "Manutenção acordada",
          providerName: "Agência",
          clientName: "Segundo cliente",
          scope: "Atualização de conteúdo",
          amountCents: 10000,
          installments: 1,
          startsOn: today,
          endsOn,
          firstPaymentOn: today,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    const onChange = vi.fn();
    render(<ContractsPage value={value} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Manutenção acordada · 15 dias até/ }));
    fireEvent.change(screen.getByLabelText("Texto da minuta (opcional)"), {
      target: { value: "Texto fornecido e revisado pelo responsável." },
    });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0]?.[0].contracts[0].draftText).toBe(
      "Texto fornecido e revisado pelo responsável.",
    );
    expect(onChange.mock.calls[0]?.[0].contracts[0].status).toBe("draft");
    expect(screen.queryByText("Dados salvos apenas neste navegador")).not.toBeInTheDocument();
  });
});
