import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "assets", "materials", "paper");
const outputDir = path.join(root, "public", "assets", "kavachpay", "materials");
const overlayDir = path.join(root, "public", "assets", "kavachpay", "overlays");

const papers = [
  ["PAPER_01_MASTER_IVORY_4K.jpeg", "paper-master-ivory"],
  ["PAPER_02_HANDLED_AUTHORITY_4K.jpeg", "paper-handled-authority"],
  ["PAPER_03_THIN_RECEIPT_4K.jpeg", "paper-thin-receipt"],
  ["PAPER_04_TICKET_STOCK_4K.jpeg", "paper-ticket-stock"],
  ["PAPER_05_OFFICIAL_DOCUMENT_4K.jpeg", "paper-official-document"],
];

await mkdir(outputDir, { recursive: true });
await mkdir(overlayDir, { recursive: true });

for (const [sourceName, runtimeName] of papers) {
  const source = path.join(sourceDir, sourceName);

  await sharp(source)
    .rotate()
    .resize(1600, 1600, { fit: "cover", kernel: "lanczos3" })
    .webp({ quality: 84, effort: 6, smartSubsample: true })
    .toFile(path.join(outputDir, `${runtimeName}-1600.webp`));

  await sharp(source)
    .rotate()
    .resize(900, 900, { fit: "cover", kernel: "lanczos3" })
    .webp({ quality: 80, effort: 6, smartSubsample: true })
    .toFile(path.join(outputDir, `${runtimeName}-900.webp`));
}

let seed = 0x4b415641;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
};

const noiseSize = 256;
const noise = Buffer.alloc(noiseSize * noiseSize * 4);
for (let index = 0; index < noiseSize * noiseSize; index += 1) {
  const value = Math.round(104 + random() * 82);
  const offset = index * 4;
  noise[offset] = value;
  noise[offset + 1] = value;
  noise[offset + 2] = value;
  noise[offset + 3] = Math.round(22 + random() * 48);
}

await sharp(noise, {
  raw: { width: noiseSize, height: noiseSize, channels: 4 },
})
  .webp({ quality: 72, alphaQuality: 72, effort: 6 })
  .toFile(path.join(overlayDir, "stock-grain-256.webp"));

console.log(`Derived ${papers.length * 2} protected-source runtime textures and one deterministic grain tile.`);
