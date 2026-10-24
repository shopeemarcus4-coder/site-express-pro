/** Creates a standards-compliant ZIP using STORE. The exported site is already small
 * and self-contained, so avoiding a compression dependency keeps delivery reliable. */
export function createZip(files: { name: string; content: string | Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const entries = files.map(({ name, content }) => {
    if (!name || name.includes("/") || name.includes("\\") || name === "." || name === "..") {
      throw new Error("Nome de arquivo inválido no pacote ZIP.");
    }
    const nameBytes = encoder.encode(name);
    const body = typeof content === "string" ? encoder.encode(content) : content;
    if (nameBytes.length > 0xffff || body.length > 0xffffffff) {
      throw new Error("Arquivo grande demais para o pacote ZIP.");
    }
    return { nameBytes, body, crc: crc32(body) };
  });
  if (entries.length > 0xffff) throw new Error("Há arquivos demais no pacote ZIP.");
  const localSize = entries.reduce(
    (sum, entry) => sum + 30 + entry.nameBytes.length + entry.body.length,
    0,
  );
  const centralSize = entries.reduce((sum, entry) => sum + 46 + entry.nameBytes.length, 0);
  if (localSize + centralSize + 22 > 0xffffffff) {
    throw new Error("Pacote ZIP grande demais.");
  }
  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  const now = new Date();
  const year = Math.max(1980, Math.min(2107, now.getFullYear()));
  const dosDate = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  let offset = 0;
  const localOffsets: number[] = [];
  for (const entry of entries) {
    localOffsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 0x0800, true); // UTF-8 names
    view.setUint16(offset + 8, 0, true); // STORE; no compressor needed
    view.setUint16(offset + 10, dosTime, true);
    view.setUint16(offset + 12, dosDate, true);
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, entry.body.length, true);
    view.setUint32(offset + 22, entry.body.length, true);
    view.setUint16(offset + 26, entry.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true);
    output.set(entry.nameBytes, offset + 30);
    output.set(entry.body, offset + 30 + entry.nameBytes.length);
    offset += 30 + entry.nameBytes.length + entry.body.length;
  }
  const centralStart = offset;
  for (const [index, entry] of entries.entries()) {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, dosTime, true);
    view.setUint16(offset + 14, dosDate, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.body.length, true);
    view.setUint32(offset + 24, entry.body.length, true);
    view.setUint16(offset + 28, entry.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, 0, true);
    view.setUint32(offset + 42, localOffsets[index]!, true);
    output.set(entry.nameBytes, offset + 46);
    offset += 46 + entry.nameBytes.length;
  }
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, centralSize, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true);
  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
