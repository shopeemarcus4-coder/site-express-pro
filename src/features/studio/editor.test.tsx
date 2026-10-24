import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StudioPage } from "./StudioPage";
import { createSiteProject } from "./presets";

afterEach(cleanup);

describe("editor canvas", () => {
  it("switches between desktop and mobile previews while allowing the tools to be hidden", () => {
    const project = createSiteProject({ name: "Ateliê Aurora" });
    const { container } = render(
      <StudioPage project={project} onChange={() => {}} onBack={() => {}} />,
    );
    const canvas = container.querySelector(".sx-canvas-viewport");
    const panel = container.querySelector("#sx-studio-tools");

    expect(canvas).toHaveAttribute("data-viewport", "desktop");
    expect(container.querySelector(".sx-canvas-screen .sx-site")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Celular" }));
    expect(canvas).toHaveAttribute("data-viewport", "mobile");

    fireEvent.click(screen.getByRole("button", { name: "Recolher ferramentas" }));
    expect(panel).toHaveAttribute("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar ferramentas" }));
    expect(panel).not.toHaveAttribute("hidden");
  });
});
