import { describe, expect, it } from "vitest";
import { buildImageInstructions, imageSlots } from "./image-prompt";

describe("business image brief", () => {
  it("keeps real products faithful to the source image", () => {
    const instructions = buildImageInstructions({
      mode: "enhance",
      slot: "heroDesktop",
      prompt: "Ajuste a luz da foto da vitrine.",
      business: { name: "Padaria do Bairro", category: "Padaria", colors: ["#071930"] },
    });
    expect(instructions).toContain("Preserve cor, formato, dimensões, material, textura");
    expect(instructions).toContain("não invente partes ocultas");
    expect(instructions).toContain("40% à esquerda");
    expect(instructions).toContain("Padaria do Bairro");
  });

  it("uses separate responsive directions and keeps source-free scenes illustrative", () => {
    const instructions = buildImageInstructions({
      mode: "generate",
      slot: "heroMobile",
      prompt: "Cena neutra de serviço local.",
    });
    expect(imageSlots.heroMobile.aspectRatio).toBe("1:1");
    expect(instructions).toContain("Não apenas corte a imagem desktop");
    expect(instructions).toContain("cena genérica ilustrativa");
    expect(instructions).toContain("Nunca represente como real um produto à venda");
  });
});
