# dsh-skill-pack

[![Version](https://img.shields.io/npm/v/dsh-skill-pack?color=blue)](https://www.npmjs.com/package/dsh-skill-pack)
[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](https://opensource.org/licenses/MIT)

**94 original, field-tested skills for DeepSeek Harness agents — one command installs them all into your agent's skill folder.**

Built from months of real agent operations: these skills encode the disciplines that actually caught our agent's mistakes — thinking frameworks that fire on the right triggers, verification workflows that refuse fake completion, memory discipline that survives context compaction.

## Install

```bash
npm install -g dsh-skill-pack
dsh-skill-pack install          # → ~/.dsh/skills (skips existing unless --force)
dsh-skill-pack install --force  # overwrite same-name skills
```

Restart DSH after install (skills are scanned at startup).

## What's inside

| Group | Count | Examples |
|---|---|---|
| Thinking frameworks | 28 | `thinking-bounded-rationality`, `thinking-red-team`, `thinking-cynefin` — trigger-conditioned reasoning skills |
| Security assessment (`dsh-sec-*`) | 42 | `dsh-sec-code-audit`, `dsh-sec-reverse-engineering`, `dsh-sec-llm-security`, ... — **authorized testing only**; every skill carries a "for authorized..." scope line |
| Verification & agent hygiene | ~23 | `dsh-verification`, `dsh-tdd`, `dsh-debugging`, `dsh-memory`, `dsh-self-evolution`, `dsh-grilling`, ... |

Full inventory: `skills/` — every directory is one skill (`SKILL.md` + assets).

## Scope note

This pack contains **original, self-authored skills only**. Third-party skills (Anthropic official, obra/superpowers ecosystem, document-generation skills) are intentionally **not** included — install those from their own sources with their own licenses.

**Security skills** (`dsh-sec-*`) are defensive/offensive security-education content for **authorized engagements only** (pen-testing, CTF, malware analysis, reverse engineering). Each skill's description states its authorized-use scope. You are responsible for using them lawfully.

## For maintainers

```bash
npm run build    # re-copy from ~/.dsh/skills (exclusion list in scripts/build-release.mjs) + frontmatter gate
node scripts/check-frontmatter.mjs
```

Provenance scan: `node scripts/scan-provenance.mjs` flags third-party markers (kept in the dsh-claim-gate repo test suite).

## Changelog

### v1.0.0 (2026-09-02)

- First release: 94 skills (65 `dsh-*` + 28 `thinking-*` + `autotelic-evolution`)
- Installer: additive-only copy (never deletes target skills), `--force` for overwrite
- Provenance vetted: 30 third-party-origin skills excluded by marker scan (28) + manual review (2)
