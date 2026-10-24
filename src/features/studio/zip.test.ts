import { describe, expect, it } from "vitest";
import { createZip } from "./zip";

describe("site ZIP export", () => {
  it("stores UTF-8 HTML and README with a valid central directory", () => {
    const files = [
      { name: "index.html", content: '<!doctype html><html lang="pt-BR"><body>Olá</body></html>' },
      { name: "README.txt", content: "Extraia e abra index.html.\n" },
    ];
    const archive = createZip(files);
    const view = new DataView(archive.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const eocd = archive.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(2);
    const centralOffset = view.getUint32(eocd + 16, true);
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50);
    const decoder = new TextDecoder();
    let offset = 0;
    for (const file of files) {
      expect(view.getUint32(offset, true)).toBe(0x04034b50);
      expect(view.getUint16(offset + 8, true)).toBe(0); // STORE
      const length = view.getUint32(offset + 18, true);
      const nameLength = view.getUint16(offset + 26, true);
      const name = decoder.decode(archive.subarray(offset + 30, offset + 30 + nameLength));
      const body = decoder.decode(
        archive.subarray(offset + 30 + nameLength, offset + 30 + nameLength + length),
      );
      expect(name).toBe(file.name);
      expect(body).toBe(file.content);
      offset += 30 + nameLength + length;
    }
  });

  it("rejects paths that could escape the extracted folder", () => {
    expect(() => createZip([{ name: "../outside", content: "x" }])).toThrow();
  });

  it("stores image bytes unchanged alongside text files", () => {
    const image = Uint8Array.from([0, 255, 44, 10]);
    const archive = createZip([{ name: "capa-desktop.webp", content: image }]);
    const nameLength = new DataView(archive.buffer).getUint16(26, true);
    expect(archive.subarray(30 + nameLength, 30 + nameLength + image.length)).toEqual(image);
  });
});
