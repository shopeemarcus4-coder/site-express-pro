export async function optimizeImage(file: File, maxWidth: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem neste navegador.");
    let scale = Math.min(1, maxWidth / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 9; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL("image/webp", Math.max(0.48, 0.84 - attempt * 0.05));
      if (!encoded.startsWith("data:image/webp")) {
        throw new Error("Este navegador não consegue otimizar imagens em WebP.");
      }
      // Ten inline images remain comfortably below the workspace API's 3 MB JSON limit.
      if (encoded.length <= 180_000) return encoded;
      scale *= 0.82;
    }
    throw new Error("A imagem é complexa demais para caber no projeto. Escolha outra foto.");
  } finally {
    bitmap.close();
  }
}
