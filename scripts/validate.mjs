import { readJson } from "./lib.mjs";

const workflows = await readJson("catalog/workflows.json");
const rejected = await readJson("catalog/rejected.json");
const ids = new Set();
const errors = [];

for (const item of workflows) {
  for (const field of ["id", "name", "url", "description", "kind", "health"]) {
    if (!item[field]) errors.push(`${item.id || "unknown"}: missing ${field}`);
  }
  if (ids.has(item.id)) errors.push(`${item.id}: duplicate id`);
  ids.add(item.id);
  if (item.health?.status !== "working") errors.push(`${item.id}: non-working entry in working catalog`);
  if (!/^https:\/\//.test(item.url)) errors.push(`${item.id}: URL must use HTTPS`);
  if (!Array.isArray(item.sources) || item.sources.length === 0) errors.push(`${item.id}: missing source attribution`);
}

for (const item of rejected) {
  if (item.health?.status === "working") errors.push(`${item.id}: working entry in rejection ledger`);
  if (!item.health?.reasons?.length) errors.push(`${item.id}: rejection has no reason`);
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Validated ${workflows.length} working and ${rejected.length} rejected entries.\n`);
