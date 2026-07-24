import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, "app/rooms/page.tsx");
if (!fs.existsSync(target)) throw new Error("Missing app/rooms/page.tsx");
const source = fs.readFileSync(target, "utf8");

const checks = [
  ["large empty-state image reference removed", !source.includes("empty-rooms-gentle-first-room.png")],
  ["text-only empty marker present", source.includes('data-rooms-empty-state="text-only-v141"')],
  ["performance build tag present", source.includes("rooms-empty-state-text-only-v141-2026-07-24")],
  ["scene images are lazy", source.includes('loading="lazy"')],
  ["scene images decode async", source.includes('decoding="async"')],
  ["scene images reserve dimensions", source.includes("width={320}") && source.includes("height={110}")],
];

const failures = checks.filter(([, passed]) => !passed).map(([name]) => name);
console.log(JSON.stringify({
  ok: failures.length === 0,
  build_tag: "rooms-empty-state-performance-contract-v141",
  passed: checks.length - failures.length,
  total: checks.length,
  failures,
}, null, 2));
if (failures.length) process.exit(1);
