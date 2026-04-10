# Decision: Agent GitHub Identity via Per-Agent GitHub Apps

**By:** Flight  
**Date:** 2026-03-27

## Context

Squad agents currently act through the repo owner's personal GitHub account. All comments, commits, and PR operations show as the owner. Attribution is text-only (`**Triage (Leela):**`). This limits audit clarity, external trust, and credential isolation.

## Decision

Adopt a **one GitHub App per agent** model for Squad member identity on GitHub.

### Key architectural choices:

1. **Per-agent Apps over single shared App** — the identity benefit requires distinct bot accounts. A single app with text attribution is marginally better than today.

2. **Per-agent Apps over machine users** — machine users cost paid seats. GitHub recommends Apps.

3. **Hybrid fallback** — Apps for visible operations (comments, commits, PRs). Owner's `gh` CLI for operations Apps can't do (issue assignment, review requests). Fallback to `gh` CLI when no identity is configured.

4. **`SquadGitHubClient.asAgent()` abstraction** — agent code never touches auth directly. Backend can be swapped (per-app → sub-identities) without cascading changes.

5. **Credential storage** — App metadata committed (`.squad/identity/apps/*.json`), private keys gitignored (`.squad/identity/keys/*.pem`), env var overrides for CI.

6. **Phased rollout** — Phase 1 (comments + commits), Phase 2 (full operations), Phase 3 (CI/CD), Phase 4 (advanced identity).

## Impact

- All agents must respect identity configuration when making GitHub API calls
- New CLI commands: `squad identity create`, `squad identity status`, `squad identity rotate`
- `.squad/identity/` directory structure added
- `.gitignore` must include `.squad/identity/keys/`
- Existing setups continue working via fallback (no breaking change)

## Proposal

Full proposal at `docs/proposals/agent-github-identity.md`.
