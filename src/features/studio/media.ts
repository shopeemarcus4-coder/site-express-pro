export function safeImageSrc(value: string | undefined): string | null {
  if (!value) return null;
  if (/^data:image\/(?:jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
