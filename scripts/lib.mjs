import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

export const root = new URL("../", import.meta.url);

export async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

export async function writeJson(path, value) {
  await writeFile(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`);
}

export function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function cleanDescription(value = "") {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^[\s—–:-]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

export function repoFromText(value = "") {
  const badge = value.match(/img\.shields\.io\/github\/stars\/([^/\s)]+)\/([^/\s)?.]+)/i);
  if (badge) return `${badge[1]}/${badge[2].replace(/\.svg$/, "")}`;
  const github = value.match(/github\.com\/([^/\s)]+)\/([^/\s)#?]+)/i);
  if (!github) return null;
  return `${github[1]}/${github[2].replace(/\.git$/, "")}`;
}

export async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "awesome-workflows-that-work/1.0" },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

export async function checkUrl(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "awesome-workflows-that-work/1.0" },
      signal: AbortSignal.timeout(15000)
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}

export async function githubRepo(repository) {
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    const response = await fetch(`https://api.github.com/repos/${repository}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "user-agent": "awesome-workflows-that-work/1.0",
        "x-github-api-version": "2022-11-28"
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    return response.json();
  }

  const result = spawnSync("gh", ["api", `repos/${repository}`], {
    encoding: "utf8",
    maxBuffer: 2_000_000
  });
  if (result.status !== 0) throw new Error(result.stderr.trim() || "gh api failed");
  return JSON.parse(result.stdout);
}

export async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
