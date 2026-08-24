# Contributing

Submit one workflow per pull request. The catalog accepts workflow engines, automation/orchestration projects, reusable agent workflow patterns, and reproducible AI workflow recipes.

## Acceptance criteria

A project must have:

- a public HTTPS homepage or source link;
- a public source repository that is not archived or disabled;
- repository activity within the last 365 days;
- clear setup or reproduction instructions;
- an honest description without ranking claims or marketing superlatives.

A recipe without its own repository must have an upstream CI-verification signal and a reachable permanent page. A video, screenshot, social post, or product homepage alone is not reproducible evidence.

## How to contribute

1. Add or update an entry in `catalog/curated.json`.
2. Run `npm run refresh`.
3. Run `npm run generate`.
4. Run `npm run check`.
5. Commit the curated change and generated catalog files together.

Automated refreshes may move an entry to `catalog/rejected.json`. Fix the underlying evidence rather than editing the rejection ledger by hand.

## Self-submissions

Maintainers and vendors may submit their own projects, but must add a plain-language `disclosure` field. Self-submissions pass the same automated rules as every other entry.
