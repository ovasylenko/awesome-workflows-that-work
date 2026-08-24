import { cleanDescription, fetchText, githubRepo, mapLimit, readJson, repoFromText, slugify, writeJson, checkUrl } from "./lib.mjs";

const sources = await readJson("catalog/sources.json");
const curated = await readJson("catalog/curated.json");
const candidates = [...curated];

function markdownEntry(line) {
  const table = line.match(/^\|\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\|\s*([^|]+)/);
  const bullet = line.match(/^\s*[-*]\s+\**\[([^\]]+)\]\((https?:\/\/[^)]+)\)\**\s*(.*)$/);
  const match = table || bullet;
  if (!match) return null;
  return {
    name: match[1].trim(),
    url: match[2].replace(/^http:/, "https:"),
    description: cleanDescription(match[3])
  };
}

function parseGithubProjects(text, source) {
  return text.split("\n").flatMap((line) => {
    const entry = markdownEntry(line);
    const repository = repoFromText(line);
    if (!entry || !repository || repository.toLowerCase() === source.url.split("github.com/")[1]?.toLowerCase()) return [];
    return [{
      id: slugify(repository),
      ...entry,
      repository,
      kind: "project",
      sources: [source.id]
    }];
  });
}

function parseWorkflowSection(text, source) {
  const lines = text.split("\n");
  let inside = false;
  const entries = [];
  for (const line of lines) {
    if (/^##\s+.*Data Pipeline.*Workflow Orchestration/i.test(line)) inside = true;
    else if (inside && /^##\s+/.test(line)) break;
    if (!inside) continue;
    const entry = markdownEntry(line);
    if (!entry) continue;
    const repository = repoFromText(line);
    entries.push({
      id: slugify(repository || entry.name),
      ...entry,
      repository,
      kind: "project",
      sources: [source.id]
    });
  }
  return entries;
}

function parseAgentFrameworks(text, source) {
  const lines = text.split("\n");
  let inside = false;
  const entries = [];
  for (const line of lines) {
    if (/^##\s+Core Frameworks\s*$/i.test(line)) inside = true;
    else if (inside && /^##\s+Agent Communication Protocols/i.test(line)) break;
    if (!inside) continue;
    const entry = markdownEntry(line);
    const repository = repoFromText(line);
    if (!entry || !repository) continue;
    entries.push({
      id: slugify(repository),
      ...entry,
      repository,
      kind: "project",
      sources: [source.id]
    });
  }
  return entries;
}

function parseVerifiedRecipes(text, source) {
  return text.split("\n").flatMap((line) => {
    if (!line.includes("✓ CI-verified")) return [];
    const match = line.match(/^\s*-\s+\[([^\]]+)\]\((https:\/\/flowstacks\.xyz\/workflows\/[^)]+)\)\s+-\s+(.+?)\s+`✓ CI-verified`/);
    if (!match) return [];
    return [{
      id: `recipe-${slugify(match[1])}`,
      name: match[1].trim(),
      url: match[2],
      repository: null,
      description: cleanDescription(match[3]),
      kind: "recipe",
      sources: [source.id],
      upstreamVerification: "CI-verified"
    }];
  });
}

function parseLoopCatalog(text, source) {
  const data = JSON.parse(text);
  return (data.loops || []).flatMap((loop) => {
    const repository = loop.sourceRepo || repoFromText(loop.source || "");
    if (!repository || !loop.source) return [];
    return [{
      id: `pattern-${loop.id || slugify(loop.title)}`,
      name: loop.title,
      url: loop.source,
      repository,
      description: cleanDescription(loop.description),
      kind: "pattern",
      sources: [source.id],
      upstreamVerification: loop.verificationCriteria ? "criteria-defined" : "cataloged"
    }];
  });
}

for (const source of sources) {
  const text = await fetchText(source.raw);
  const parsed = source.parser === "github-projects"
    ? parseGithubProjects(text, source)
    : source.parser === "agent-frameworks"
      ? parseAgentFrameworks(text, source)
    : source.parser === "workflow-orchestration-section"
      ? parseWorkflowSection(text, source)
      : source.parser === "verified-recipes"
        ? parseVerifiedRecipes(text, source)
        : parseLoopCatalog(text, source);
  candidates.push(...parsed);
  process.stdout.write(`${source.id}: ${parsed.length} candidates\n`);
}

const deduped = new Map();
for (const candidate of candidates) {
  const key = candidate.kind === "project" && candidate.repository
    ? `project:${candidate.repository.toLowerCase()}`
    : `${candidate.kind}:${candidate.id}`;
  const existing = deduped.get(key);
  if (!existing) deduped.set(key, candidate);
  else {
    existing.sources = [...new Set([...existing.sources, ...candidate.sources])];
    if (candidate.url.includes("orch8.io")) existing.url = candidate.url;
    if (candidate.disclosure) existing.disclosure = candidate.disclosure;
  }
}

const checkedAt = new Date().toISOString();
const staleBefore = Date.now() - 365 * 24 * 60 * 60 * 1000;
const repositoryChecks = new Map();

function cachedGithubRepo(repository) {
  const key = repository.toLowerCase();
  if (!repositoryChecks.has(key)) repositoryChecks.set(key, githubRepo(repository));
  return repositoryChecks.get(key);
}

const results = await mapLimit([...deduped.values()], 8, async (candidate) => {
  if (candidate.repository) {
    try {
      const repo = await cachedGithubRepo(candidate.repository);
      const reasons = [];
      if (repo.archived) reasons.push("repository archived");
      if (repo.disabled) reasons.push("repository disabled");
      if (new Date(repo.pushed_at).getTime() < staleBefore) reasons.push("no repository push in the last 365 days");
      return {
        ...candidate,
        repository: repo.full_name,
        health: {
          checkedAt,
          status: reasons.length ? "rejected" : "working",
          reasons,
          stars: repo.stargazers_count,
          pushedAt: repo.pushed_at,
          archived: repo.archived,
          defaultBranch: repo.default_branch
        }
      };
    } catch (error) {
      return { ...candidate, health: { checkedAt, status: "rejected", reasons: [`repository check failed: ${error.message}`] } };
    }
  }

  if (candidate.kind === "recipe" && candidate.upstreamVerification === "CI-verified") {
    const link = await checkUrl(candidate.url);
    return {
      ...candidate,
      health: {
        checkedAt,
        status: link.ok ? "working" : "rejected",
        reasons: link.ok ? [] : [`workflow page returned ${link.status || "a network error"}`],
        httpStatus: link.status
      }
    };
  }

  return { ...candidate, health: { checkedAt, status: "rejected", reasons: ["no verifiable repository or upstream CI signal"] } };
});

const working = results
  .filter((item) => item.health.status === "working")
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
const rejected = results
  .filter((item) => item.health.status !== "working")
  .sort((a, b) => a.name.localeCompare(b.name));

await writeJson("catalog/workflows.json", working);
await writeJson("catalog/rejected.json", rejected);
process.stdout.write(`working: ${working.length}; rejected: ${rejected.length}\n`);
