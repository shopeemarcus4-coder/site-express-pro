import { z } from "zod";
import { AiError } from "./ai";
import { buildImageInstructions, imageSlots } from "./image-prompt";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
const imageDataUrl = z
  .string()
  .max(1_500_000)
  .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/);
const outputImageDataUrl = z
  .string()
  .max(8_000_000)
  .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/);

export const imageInput = z
  .object({
    mode: z.enum(["enhance", "generate"]),
    slot: z
      .enum(["heroDesktop", "heroMobile", "aboutDesktop", "aboutMobile", "gallery"])
      .default("heroDesktop"),
    prompt: z.string().trim().min(10).max(2_000),
    sourceImage: imageDataUrl.optional(),
    referenceImage: imageDataUrl.optional(),
    business: z
      .object({
        name: z.string().trim().max(120).optional(),
        category: z.string().trim().max(120).optional(),
        city: z.string().trim().max(120).optional(),
        colors: z
          .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
          .max(4)
          .optional(),
      })
      .optional(),
  })
  .refine((value) => value.mode !== "enhance" || Boolean(value.sourceImage), {
    message: "Uma foto original é necessária para melhorar a imagem.",
    path: ["sourceImage"],
  })
  .refine((value) => value.mode !== "generate" || !value.sourceImage, {
    message:
      "A geração ilustrativa não recebe foto original. Use o modo de melhoria para editar uma foto.",
    path: ["sourceImage"],
  })
  .refine((value) => value.mode !== "enhance" || !value.referenceImage, {
    message: "A melhoria usa somente a foto original selecionada.",
    path: ["referenceImage"],
  });

export function imageAiEnabled(
  env: {
    SITE_EXPRESS_ENABLE_AI_IMAGES?: string | undefined;
    GEMINI_API_KEY?: string | undefined;
  } = process.env,
): boolean {
  return env.SITE_EXPRESS_ENABLE_AI_IMAGES === "1" && Boolean(env.GEMINI_API_KEY?.trim());
}

export function publicImageAiEnabled(
  env: {
    SITE_EXPRESS_ENABLE_AI_IMAGES?: string | undefined;
    SITE_EXPRESS_ENABLE_PUBLIC_AI_IMAGES?: string | undefined;
    GEMINI_API_KEY?: string | undefined;
  } = process.env,
): boolean {
  return imageAiEnabled(env) && env.SITE_EXPRESS_ENABLE_PUBLIC_AI_IMAGES === "1";
}

export function imageAiMessage(error: unknown): { message: string; status: number; code: string } {
  if (error instanceof AiError) {
    const messages = {
      not_configured: "A criação de imagens com Gemini ainda não foi ativada.",
      invalid_key: "A chave do Gemini não autorizou a criação da imagem.",
      quota_exceeded: "A cota de imagens do Gemini foi atingida. Tente mais tarde.",
      unavailable: "O Gemini não está disponível agora. Tente mais tarde.",
      blocked: "O Gemini não gerou uma imagem para este pedido. Ajuste a descrição.",
      bad_response: "O Gemini retornou uma imagem inválida. Tente novamente.",
      invalid_request:
        "O Gemini recusou este pedido ou modelo de imagem. Revise a descrição e a configuração.",
    };
    return { message: messages[error.code], status: error.status, code: error.code };
  }
  if (
    error instanceof z.ZodError ||
    error instanceof SyntaxError ||
    (error instanceof Error && ["too_large", "content_type"].includes(error.message))
  ) {
    return {
      message: "Confira a foto e a descrição enviadas.",
      status: 400,
      code: "invalid_input",
    };
  }
  return { message: "Não foi possível criar a imagem agora.", status: 502, code: "unavailable" };
}

export async function createBusinessImage(
  input: z.input<typeof imageInput>,
  key: string | undefined,
  fetcher: typeof fetch = fetch,
  modelName = process.env["SITE_EXPRESS_GEMINI_IMAGE_MODEL"],
): Promise<string> {
  const { mode, slot, prompt, sourceImage, referenceImage, business } = imageInput.parse(input);
  if (!key?.trim()) throw new AiError("not_configured", 503);
  const model = modelName?.trim() || DEFAULT_IMAGE_MODEL;
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(model)) throw new AiError("not_configured", 503);

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: buildImageInstructions({
        mode,
        slot,
        prompt,
        business,
        hasReference: Boolean(referenceImage),
      }),
    },
  ];
  if (sourceImage || referenceImage) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(
      sourceImage || referenceImage || "",
    );
    if (!match) throw new AiError("bad_response", 400);
    parts.push({ inlineData: { mimeType: match[1]!, data: match[2]! } });
  }

  let response: Response;
  try {
    response = await fetcher(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key.trim() },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: imageSlots[slot].aspectRatio },
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AiError("unavailable", 502);
  }
  if (!response.ok) {
    if (response.status === 429) throw new AiError("quota_exceeded", 503);
    if (response.status === 400) throw new AiError("invalid_request", 502);
    if ([401, 403].includes(response.status)) throw new AiError("invalid_key", 502);
    throw new AiError("unavailable", 502);
  }
  let result: unknown;
  try {
    if (!response.body) throw new Error("missing_body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let body = "";
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 10_000_000) {
        await reader.cancel();
        throw new Error("response_too_large");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    result = JSON.parse(body) as unknown;
  } catch {
    throw new AiError("bad_response", 502);
  }
  const candidate = (result as { candidates?: { content?: { parts?: unknown[] } }[] })
    ?.candidates?.[0];
  const image = candidate?.content?.parts?.find(
    (part): part is { inlineData: { mimeType: string; data: string } } =>
      Boolean(
        part &&
        typeof part === "object" &&
        "inlineData" in part &&
        part.inlineData &&
        typeof part.inlineData === "object" &&
        "mimeType" in part.inlineData &&
        "data" in part.inlineData &&
        typeof part.inlineData.mimeType === "string" &&
        typeof part.inlineData.data === "string",
      ),
  );
  if (!image) throw new AiError("blocked", 422);
  const dataUrl = `data:${image.inlineData.mimeType};base64,${image.inlineData.data}`;
  if (!outputImageDataUrl.safeParse(dataUrl).success) throw new AiError("bad_response", 502);
  return dataUrl;
}
