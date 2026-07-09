import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_SVG = join(ROOT, "static", "logo_loading.svg");
const OUT_DIR = join(ROOT, "static", "icons");

mkdirSync(OUT_DIR, { recursive: true });

const svgBuffer = readFileSync(SRC_SVG);
const PNG_SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];
const pngBuffers = {};

console.log("Gerando PNGs...");
for (const size of PNG_SIZES) {
    pngBuffers[size] = await sharp(svgBuffer)
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    console.log(`  ${size}x${size} ✓`);
}

// ── Linux: 512x512 PNG ──────────────────────────────────────────────────────
writeFileSync(join(OUT_DIR, "icon.png"), pngBuffers[512]);
console.log("icon.png (Linux) ✓");

// ── Windows: ICO multi-size ─────────────────────────────────────────────────
const icoSizes = [16, 32, 48, 64, 128, 256];
const icoImages = icoSizes.map(s => pngBuffers[s]);

const HEADER = 6, DIR_ENTRY = 16;
let offset = HEADER + DIR_ENTRY * icoImages.length;
const offsets = icoImages.map(img => { const o = offset; offset += img.length; return o; });

const icoBuffer = Buffer.alloc(offset);
icoBuffer.writeUInt16LE(0, 0);
icoBuffer.writeUInt16LE(1, 2);
icoBuffer.writeUInt16LE(icoImages.length, 4);

for (let i = 0; i < icoImages.length; i++) {
    const s = icoSizes[i], b = HEADER + i * DIR_ENTRY;
    icoBuffer.writeUInt8(s >= 256 ? 0 : s, b);
    icoBuffer.writeUInt8(s >= 256 ? 0 : s, b + 1);
    icoBuffer.writeUInt8(0, b + 2); icoBuffer.writeUInt8(0, b + 3);
    icoBuffer.writeUInt16LE(1, b + 4); icoBuffer.writeUInt16LE(32, b + 6);
    icoBuffer.writeUInt32LE(icoImages[i].length, b + 8);
    icoBuffer.writeUInt32LE(offsets[i], b + 12);
}
let pos = HEADER + DIR_ENTRY * icoImages.length;
for (const img of icoImages) { img.copy(icoBuffer, pos); pos += img.length; }
writeFileSync(join(OUT_DIR, "icon.ico"), icoBuffer);
console.log("icon.ico (Windows) ✓");

// ── macOS: ICNS ─────────────────────────────────────────────────────────────
const icnsTypes = [
    { osType: "ic04", size: 16 },
    { osType: "ic05", size: 32 },
    { osType: "ic08", size: 256 },
    { osType: "ic09", size: 512 },
    { osType: "ic10", size: 1024 },
    { osType: "ic11", size: 32 },
    { osType: "ic12", size: 64 },
    { osType: "ic13", size: 256 },
    { osType: "ic14", size: 512 },
];
// icns only uses ic07-ic14 for PNG chunks; simplify to standard set:
const icnsChunks = [];
for (const { osType, size } of [
    { osType: "ic08", size: 256 },
    { osType: "ic09", size: 512 },
    { osType: "ic10", size: 1024 },
    { osType: "ic07", size: 128 },
]) {
    const img = pngBuffers[size];
    if (!img) continue;
    const type = Buffer.from(osType, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(8 + img.length, 0);
    icnsChunks.push(type, len, img);
}
const body = Buffer.concat(icnsChunks);
const header = Buffer.alloc(8);
header.write("icns", 0, "ascii");
header.writeUInt32BE(8 + body.length, 4);
writeFileSync(join(OUT_DIR, "icon.icns"), Buffer.concat([header, body]));
console.log("icon.icns (macOS) ✓");

console.log("\nÍcones em static/icons/");
