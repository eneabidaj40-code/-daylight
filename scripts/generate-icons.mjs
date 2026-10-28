import fs from "node:fs";
import zlib from "node:zlib";
const crc = (data) => {
  let c = 0xffffffff;
  for (const b of data) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const t = Buffer.from(type),
    len = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, sum]);
}
function lineDistance(x, y, x1, y1, x2, y2) {
  const t = Math.max(
    0,
    Math.min(
      1,
      ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) /
        ((x2 - x1) ** 2 + (y2 - y1) ** 2),
    ),
  );
  return Math.hypot(x - x1 - t * (x2 - x1), y - y1 - t * (y2 - y1));
}
function icon(size, path) {
  const pixels = Buffer.alloc(size * (1 + size * 4));
  const lines = [
    [26, 63, 74, 63],
    [50, 20, 50, 29],
    [28, 29, 34, 35],
    [72, 29, 66, 35],
    [20, 49, 28, 49],
    [72, 49, 80, 49],
  ];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = (x / size) * 100,
        py = (y / size) * 100;
      const arc = py <= 53 ? Math.abs(Math.hypot(px - 50, py - 53) - 17) : 99;
      const d = Math.min(arc, ...lines.map((l) => lineDistance(px, py, ...l)));
      const blend = Math.max(0, Math.min(1, ((2.3 - d) * size) / 100));
      const offset = y * (1 + size * 4) + 1 + x * 4;
      [37, 77, 63].forEach(
        (v, i) =>
          (pixels[offset + i] = Math.round(
            v + ([232, 237, 185][i] - v) * blend,
          )),
      );
      pixels[offset + 3] = 255;
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  fs.writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", zlib.deflateSync(pixels)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
fs.mkdirSync("public/icons", { recursive: true });
for (const [size, name] of [
  [192, "icon-192"],
  [512, "icon-512"],
  [512, "maskable-512"],
  [180, "apple-touch-icon"],
])
  icon(size, `public/icons/${name}.png`);
