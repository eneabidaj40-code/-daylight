import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

// Inspect the actual production output before an artifact can be published.
const base = process.env.VITE_BASE_PATH || "/";
const origin = "https://pages-check.invalid";
const output = path.resolve("dist");
const documentURL = new URL(base, origin);
const html = await readFile(path.join(output, "index.html"), "utf8");
const worker = await readFile(path.join(output, "sw.js"), "utf8");
const manifest = JSON.parse(
  await readFile(path.join(output, "manifest.webmanifest"), "utf8"),
);

async function localAsset(value, relativeTo = documentURL) {
  const url = new URL(value, relativeTo);
  assert.equal(url.origin, origin, `Unexpected external asset: ${value}`);
  assert.ok(
    url.pathname.startsWith(base),
    `Asset escapes the Pages base ${base}: ${value}`,
  );
  const relative = decodeURIComponent(url.pathname.slice(base.length));
  const file = path.resolve(output, relative);
  assert.ok(
    file.startsWith(`${output}${path.sep}`),
    `Asset escapes the build folder: ${value}`,
  );
  assert.ok((await stat(file)).isFile(), `Missing built asset: ${value}`);
  return file;
}

assert.equal(manifest.start_url, base, "Manifest launch URL must match Pages");
assert.equal(manifest.scope, base, "Manifest scope must match Pages");
assert.equal(manifest.id, base, "Manifest identity must match Pages");
assert.equal(manifest.display, "standalone");
assert.ok(html.includes('name="apple-mobile-web-app-capable"'));
assert.ok(!html.includes("%BASE_URL%"), "Unresolved Vite HTML placeholder");

for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (!match[1].startsWith("#")) await localAsset(match[1]);
}
const touchIcon = html.match(/rel="apple-touch-icon"\s+href="([^"]+)"/);
assert.ok(touchIcon, "Missing Apple touch icon");
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const touch = await readFile(await localAsset(touchIcon[1]));
assert.ok(touch.subarray(0, 8).equals(pngSignature));
assert.equal(touch.readUInt32BE(16), 180, "Apple touch icon must be 180px");
assert.equal(touch.readUInt32BE(20), 180);

for (const icon of manifest.icons) {
  const png = await readFile(await localAsset(icon.src));
  assert.ok(
    png.subarray(0, 8).equals(pngSignature),
    `Invalid PNG: ${icon.src}`,
  );
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
}
assert.ok(manifest.icons.some((i) => i.sizes === "192x192"));
assert.ok(manifest.icons.some((i) => i.sizes === "512x512"));
assert.ok(manifest.icons.some((i) => i.purpose === "maskable"));

const scripts = (await readdir(path.join(output, "assets"))).filter((name) =>
  name.endsWith(".js"),
);
const javascript = (
  await Promise.all(
    scripts.map((name) => readFile(path.join(output, "assets", name), "utf8")),
  )
).join("\n");
assert.ok(
  javascript.includes(`${base}sw.js`),
  "Service worker registration URL is outside the app base",
);
assert.ok(
  javascript.includes(`scope:"${base}"`),
  "Service worker registration scope does not match Pages",
);
assert.ok(
  worker.includes(`${base}index.html`),
  "Offline navigation fallback does not match Pages",
);
assert.ok(worker.includes("precacheAndRoute"), "Missing offline precache");
for (const essential of [
  "index.html",
  "favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
]) {
  assert.ok(worker.includes(essential), `Offline cache omits ${essential}`);
}
for (const match of worker.matchAll(/url:"([^"]+)"/g))
  await localAsset(match[1]);

console.log(
  `Verified Pages build at ${base}: HTML assets, PWA identity/scope, service worker, offline fallback, and PNG icons.`,
);
