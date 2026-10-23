import { z } from "zod";

const DEFAULT_MODEL = "gemini-2.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const rewriteInput = z.object({
  text: z.string().trim().min(10).max(3_000),
  tone: z.enum(["profissional", "amigavel", "direto"]).default("profissional"),
});

type Fetcher = typeof fetch;

export class AiError extends Error {
  constructor(
    public readonly code:
      | "not_configured"
      | "invalid_key"
      | "quota_exceeded"
      | "unavailable"
      | "blocked"
      | "bad_response",
    public readonly status: number,
  ) {
    super(code);
  }
}

export function aiEnabled(): boolean {
  return (
    process.env["SITE_EXPRESS_ENABLE_AI"] === "1" && Boolean(process.env["GEMINI_API_KEY"]?.trim())
  );
}

function configuredKey(key: string | undefined): string {
  if (!key?.trim()) throw new AiError("not_configured", 503);
  return key.trim();
}

function configuredModel(): string {
  const model = process.env["SITE_EXPRESS_GEMINI_MODEL"]?.trim() || DEFAULT_MODEL;
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(model)) throw new AiError("not_configured", 503);
  return model;
}

function responseError(status: number): AiError {
  if (status === 400 || status === 401 || status === 403) return new AiError("invalid_key", 502);
  if (status === 429) return new AiError("quota_exceeded", 503);
  return new AiError("unavailable", 502);
}

function readGeneratedText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const response = data as { candidates?: unknown; promptFeedback?: unknown };
  if (!Array.isArray(response.candidates) || !response.candidates.length) {
    if (response.promptFeedback) throw new AiError("blocked", 422);
    return null;
  }
  const candidate = response.candidates[0] as { content?: { parts?: unknown } } | null;
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const content = parts
    .map((part) =>
      part && typeof part === "object" && "text" in part ? (part as { text: unknown }).text : null,
    )
    .filter((part): part is string => typeof part === "string")
    .join("")
    .trim();
  return content || null;
}

export async function rewriteCopy(
  input: z.input<typeof rewriteInput>,
  key = aiEnabled() ? process.env["GEMINI_API_KEY"] : undefined,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const { text, tone } = rewriteInput.parse(input);
  const apiKey = configuredKey(key);
  const toneDescription = {
    profissional: "profissional e claro",
    amigavel: "acolhedor e natural",
    direto: "breve e direto",
  }[tone];
  const instructions = [
    `Reescreva o texto abaixo em português do Brasil com tom ${toneDescription}.`,
    "Preserve nomes, números, preços, endereço, benefícios e afirmações exatamente como foram informados.",
    "Não invente fatos, resultados, garantias, avaliações, depoimentos ou credenciais.",
    "Responda apenas com o texto reescrito, sem explicações nem Markdown.",
    "Texto a reescrever:",
    text,
  ].join("\n\n");

  let response: Response;
  try {
    response = await fetcher(
      `${GEMINI_BASE}/${encodeURIComponent(configuredModel())}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: instructions }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    throw new AiError("unavailable", 502);
  }
  if (!response.ok) throw responseError(response.status);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new AiError("bad_response", 502);
  }
  const rewritten = readGeneratedText(data);
  if (!rewritten) throw new AiError("bad_response", 502);
  return rewritten;
}

export function aiMessage(error: unknown): { message: string; status: number; code: string } {
  if (error instanceof AiError) {
    switch (error.code) {
      case "not_configured":
        return {
          message: "A reescrita por IA não foi ativada. Continue editando o texto manualmente.",
          status: 503,
          code: error.code,
        };
      case "invalid_key":
        return {
          message:
            "A chave da IA não autorizou esta consulta. Revise a configuração ou edite manualmente.",
          status: 502,
          code: error.code,
        };
      case "quota_exceeded":
        return {
          message: "O limite da IA foi atingido. Edite o texto manualmente ou tente mais tarde.",
          status: 503,
          code: error.code,
        };
      case "blocked":
        return {
          message: "A IA não gerou uma resposta para este texto. Edite o texto manualmente.",
          status: 422,
          code: error.code,
        };
      default:
        return {
          message: "Não foi possível reescrever o texto agora. Continue editando manualmente.",
          status: error.status,
          code: error.code,
        };
    }
  }
  if (
    error instanceof z.ZodError ||
    error instanceof SyntaxError ||
    (error instanceof Error && ["too_large", "content_type"].includes(error.message))
  ) {
    return {
      message: "Confira o texto enviado e tente novamente.",
      status: 400,
      code: "invalid_input",
    };
  }
  return {
    message: "Não foi possível reescrever o texto agora. Continue editando manualmente.",
    status: 502,
    code: "unavailable",
  };
}
