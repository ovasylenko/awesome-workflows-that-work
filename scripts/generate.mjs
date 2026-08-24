import { readFile, writeFile } from "node:fs/promises";
import { readJson, root } from "./lib.mjs";

const workflows = await readJson("catalog/workflows.json");
const sources = await readJson("catalog/sources.json");
const checkedAt = workflows[0]?.health?.checkedAt?.slice(0, 10) || "not yet";

function safe(value = "") {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function projectLine(item) {
  const activity = item.health.pushedAt?.slice(0, 10) || "unknown";
  const stars = Number(item.health.stars || 0).toLocaleString("en-US");
  const repo = item.repository ? ` · [source](https://github.com/${item.repository})` : "";
  const disclosure = item.disclosure ? " · **curator disclosure**" : "";
  return `- [${safe(item.name)}](${item.url}) — ${safe(item.description)}${repo} · ★ ${stars} · active ${activity}${disclosure}`;
}

function recipeLine(item) {
  return `- [${safe(item.name)}](${item.url}) — ${safe(item.description)} · ✓ upstream CI-verified`;
}

function patternLine(item) {
  return `- [${safe(item.name)}](${item.url}) — ${safe(item.description)} · [source repo](https://github.com/${item.repository})`;
}

const projects = workflows.filter((item) => item.kind === "project");
const recipes = workflows.filter((item) => item.kind === "recipe");
const patterns = workflows.filter((item) => item.kind === "pattern");

const readme = `# Awesome Workflows That Work

> Workflow engines, automation projects, agent patterns, and reproducible AI workflows that pass current health checks.

[![Catalog health](https://github.com/ovasylenko/awesome-workflows-that-work/actions/workflows/refresh.yml/badge.svg)](https://github.com/ovasylenko/awesome-workflows-that-work/actions/workflows/refresh.yml)
[![Entries](https://img.shields.io/badge/working-${workflows.length}-brightgreen)](catalog/workflows.json)
[![CC0](https://img.shields.io/badge/license-CC0--1.0-blue)](LICENSE)

Most awesome lists only test whether a link existed when it was added. This catalog is regenerated from structured data and keeps a public rejection ledger for archived, disabled, unreachable, or stale projects.

Last verified: **${checkedAt}** · ${projects.length} projects · ${patterns.length} patterns · ${recipes.length} recipes

## What “working” means

- Repository-backed projects are not archived or disabled and have received a push within 365 days.
- Recipes must carry an upstream CI-verified signal and have a reachable workflow page.
- Patterns must link to a live, active source repository.
- Failing candidates remain visible in [catalog/rejected.json](catalog/rejected.json), with the reason and check time.
- This is an activity and reachability check, not a security audit or production endorsement.

## Workflow engines and orchestration projects

${projects.map(projectLine).join("\n") || "_No projects have passed yet._"}

## Reusable agent workflow patterns

${patterns.map(patternLine).join("\n") || "_No patterns have passed yet._"}

## Reproducible AI workflow recipes

${recipes.map(recipeLine).join("\n") || "_No recipes have passed yet._"}

## Sources and attribution

This catalog combines and verifies entries from:

${sources.map((source) => `- [${source.name}](${source.url})`).join("\n")}

Descriptions are normalized from upstream catalogs and public repository metadata. Each upstream list retains its own license; this repository releases its original catalog structure, scripts, and contributions under CC0-1.0.

## Add or restore a workflow

See [CONTRIBUTING.md](CONTRIBUTING.md). A submission needs a reproducible link and evidence that can be checked automatically. If an entry was rejected only because it went stale, a new release or recent maintenance activity is enough to make the next refresh reconsider it.

## Maintainer disclosure

This list is maintained by the creator of [Orch8](https://orch8.io/). Orch8 is included in the catalog, clearly disclosed, and evaluated by the same repository activity rules as every other entry. Inclusion is not pay-to-play.
`;

const path = new URL("README.md", root);
if (process.argv.includes("--check")) {
  const current = await readFile(path, "utf8").catch(() => "");
  if (current !== readme) {
    process.stderr.write("README.md is out of date. Run npm run generate.\n");
    process.exit(1);
  }
} else {
  await writeFile(path, readme);
}
