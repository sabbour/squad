# Decisions

> Team decisions that all agents must respect. Managed by Scribe.


---

## Foundational Directives (carried from beta, updated for Mission Control)

### Type safety — strict mode non-negotiable
**By:** CONTROL (formerly Edie)
**What:** `strict: true`, `noUncheckedIndexedAccess: true`, no `@ts-ignore` allowed.
**Why:** Types are contracts. If it compiles, it works.

### Hook-based governance over prompt instructions
**By:** RETRO (formerly Baer)
**What:** Security, PII, and file-write guards are implemented via the hooks module, NOT prompt instructions.
**Why:** Prompts can be ignored. Hooks are code — they execute deterministically.

### Node.js >=20, ESM-only, streaming-first
**By:** GNC (formerly Fortier)
**What:** Runtime target is Node.js 20+. ESM-only. Async iterators over buffers.
**Why:** Modern Node.js features enable cleaner async patterns.

### Casting — Apollo 13, mission identity
**By:** Squad Coordinator
**What:** Team names drawn from Apollo 13 / NASA Mission Control. Scribe is always Scribe. Ralph is always Ralph. Previous universe (The Usual Suspects) retired to alumni.
**Why:** The team outgrew its original universe. Apollo 13 captures collaborative pressure, technical precision, and mission-critical coordination — perfect for an AI agent framework.

### Proposal-first workflow
**By:** Flight (formerly Keaton)
**What:** Meaningful changes require a proposal in `docs/proposals/` before execution.
**Why:** Proposals create alignment before code is written.

### Tone ceiling — always enforced
**By:** PAO (formerly McManus)
**What:** No hype, no hand-waving, no claims without citations.
**Why:** Trust is earned through accuracy, not enthusiasm.

### Zero-dependency scaffolding preserved
**By:** Network (formerly Rabin)
**What:** CLI remains thin. Zero runtime dependencies for the CLI scaffolding path.
**Why:** Users should be able to run `npx` without downloading a dependency tree.

### Merge driver for append-only files
**By:** Squad Coordinator
**What:** `.gitattributes` uses `merge=union` for `.squad/decisions.md`, `agents/*/history.md`, `log/**`, `orchestration-log/**`.
**Why:** Enables conflict-free merging of team state across branches.

### Interactive Shell as Primary UX
**By:** Brady
**What:** Squad becomes its own interactive CLI shell. `squad` with no args enters a REPL.
**Why:** Squad needs to own the full interactive experience.

### Root Cause Analysis

Three factors combine to create the VS Code routing failure. Ranked by dominance:

#### 1. 🔴 CLI-Centric Enforcement Language (DOMINANT)

The routing constraint is expressed exclusively in CLI terms. The CRITICAL RULE references 	ask tool only. When the coordinator reads this in VS Code, where the tool is unSubagent, it doesn't reliably make the substitution. It falls through to Platform Detection's Fallback mode: 'work inline.' This enforcement language creates a logical gap.

#### 2. 🟡 Prompt Saturation (AMPLIFYING)

The coordinator prompt is 950 lines / ~80KB. The routing constraint is buried at line 1010 under irrelevant sections (Init Mode, ceremonies, Ralph work monitor, worktree lifecycle). The core dispatch loop accounts for ~200 lines, competing for attention with ~750 lines of governance and reference material.

#### 3. 🟡 Template Duplication (AMPLIFYING)

CLI 1.0.11 discovers all \*.agent.md\ files from cwd to git root. Squad has 5 copies: .squad-templates, templates/, packages/squad-cli/templates, packages/squad-sdk/templates, and .github/agents/. Only .github/agents/ should be discoverable. CLI 1.0.11 merges ALL of them, multiplying the coordinator instructions by 5x and diluting the routing constraint.

### Proposed Fixes

**Fix 1: Platform-Neutral Enforcement Language (P0)**
- Rewrite CRITICAL RULE to be platform-neutral: 'You are a DISPATCHER, not a DOER. Every task that needs domain expertise MUST be dispatched to a specialist agent.'
- List dispatch mechanisms: CLI (\	ask\ tool), VS Code (\unSubagent\ tool), or fallback (work inline)
- Update anti-patterns and constraints sections with same substitution

**Fix 2: Top-and-Bottom Reinforcement (P0)**
- Add reinforcement block at end of prompt (LLMs weight beginning/end more heavily than middle)
- Emphasize: Squad ROUTES, it does not BUILD. Do not produce domain artifacts inline.

**Fix 3: Prompt Slimming — Move to Lazy-Loaded References (P1)**
- Extract ~350 lines (~37%) to lazy-loaded templates: worktree-reference.md, ralph-reference.md, casting-reference.md, mcp-reference.md
- Reduce from 950→600 lines, making routing constraint a larger percentage of total prompt

**Fix 4: Template File Renaming (P1)**
- Rename template copies to .template extension to prevent CLI 1.0.11 discovery
- Update sync-templates.mjs and squad-cli/squad-sdk init code to reference new filenames

**Fix 5: VS Code-Specific Hardening Block (P1)**
- Move VS Code adaptations section higher (from line 458 to immediately after CRITICAL RULE)
- Restructure as active enforcement block with platform detection table
- Make clear: if \unSubagent\ is available, it MUST be used for domain work

### Priority Ordering

| Priority | Fix | Impact | Effort | Ships In |
|---|---|---|---|---|
| **P0** | Fix 1: Platform-neutral enforcement | 🔴 Directly closes logical gap | Low | Next patch |
| **P0** | Fix 2: Top-and-bottom reinforcement | 🔴 Exploits LLM attention patterns | Trivial | Next patch |
| **P1** | Fix 4: Template file renaming | 🟡 Eliminates 4x duplication | Medium | Next minor |
| **P1** | Fix 3: Prompt slimming | 🟡 Reduces 950→600 lines | Medium | Next minor |
| **P1** | Fix 5: VS Code hardening block | 🟡 Makes VS Code dispatch prominent | Low | Next minor |

**Ship order:** Fix 1 + Fix 2 together (one PR, immediate). Fix 4 next (requires code changes). Fix 3 + Fix 5 together (prompt restructure PR).

### Validation

After implementing, test with Andreas's reproduction case:
1. Open VS Code with squadified project
2. Ask coordinator to do domain work that matches routing rule
3. Verify: coordinator dispatches via \unSubagent\ instead of working inline
4. Verify: coordinator cites the routing rule when dispatching

FIDO should own the test scenario. GUIDO should validate the VS Code runtime behavior.

### Open Questions

1. Does CLI 1.0.11 support exclusion patterns (.copilotignore)? If yes, Fix 4 becomes simpler.
2. Should we version-gate the VS Code adaptations (detect CLI version)?
3. Is \unSubagent\ still the correct tool name, or has it changed?
---

# Decision: PR Review Batch — Overlap Resolution

**Date:** 2026-03-25  
**Reviewer:** FIDO (Quality Owner)  
**Context:** 10 open PRs reviewed, 3 duplicate/overlap pairs identified

## Problem

tamirdresher opened 6 PRs addressing related concerns (retro enforcement, challenger agent, tiered memory). Three pairs have significant overlap:

1. **#607 vs #605** — Both add weekly retro ceremony with Ralph enforcement
2. **#604 vs #603** — Both add Challenger agent template (complete duplicates)
3. **#606 vs #602** — Both add tiered memory/history skills (superset/subset)

## Decision

**Merge these:**
- **#607** (retro enforcement) — comprehensive, standalone ceremony file
- **#603** (Challenger + fact-checking) — correct file locations, follows project conventions
- **#606** (tiered memory) — superset of #602, 3-tier model vs 2-tier

**Close as duplicate:**
- **#605** — same scope as #607, less comprehensive
- **#604** — duplicate of #603, different file locations
- **#602** — subset of #606, narrower scope

## Rationale

- **#607 vs #605:** #607 provides standalone ceremony file (`ceremonies/retrospective.md`) + enforcement guide + skill, while #605 inlines into existing templates. Standalone file is more discoverable and modular.
- **#604 vs #603:** Functionally identical. #603 uses `.squad/` paths matching project conventions; #604 uses `templates/` (non-standard for agents).
- **#606 vs #602:** #606 is a superset — 3-tier model (hot/cold/wiki) vs 2-tier (hot/cold). Both cite same production data. Broader scope is more useful.

## Impact

- Reduces PR count from 10 to 7 (close 3 duplicates)
- Eliminates conflicting file changes (e.g., both #607 and #605 modify `templates/ceremonies.md`)
- Preserves all unique value (no functionality lost)

## Affected PRs

| PR  | Action | Reason |
|-----|--------|--------|
| 607 | Merge  | Comprehensive retro enforcement |
| 605 | Close  | Duplicate of #607 (less comprehensive) |
| 604 | Close  | Duplicate of #603 (wrong file paths) |
| 603 | Merge  | Challenger template (correct paths) |
| 606 | Merge  | Tiered memory (superset) |
| 602 | Close  | Subset of #606 (narrower scope) |

## Next Steps

1. Comment on #605, #604, #602 explaining they are duplicates/subsets and will be closed
2. Merge #607, #603, #606 after author confirms deduplication is acceptable
3. All other PRs (#611, #608, #592, #567) can proceed independently

---

# Decision: Triage + Work Session Plan

**By:** Flight  
**Date:** 2026-03-25

## Context

Triaged 14 untriaged issues (3 docs, 6 community features, 3 bugs, 2 questions). Multiple overlap with existing P1 work. 10 open PRs (5 from tamirdresher, 2 from diberry, 1 from joniba, 1 from eric-vanartsdalen, 1 draft).

## Triage Decisions

### High-Value Quick Wins (P1)
- **#610** (docs broken link) → squad:pao, P1 — 5-minute fix blocking diberry's PR #611 CI
- **#590** (getPersonalSquadRoot bug) → squad:eecom, P0 — personal squad init broken for all users since v0.9.1
- **#591** (hiring wiring docs) → squad:procedures, P1 — matches PR #592 (joniba), docs-only, high clarity

### Community Feature Contributions (Defer to Review)
- **#601, #600, #598, #596, #595** (tamirdresher proposals) — all have matching PRs (#607, #606, #604, #602). Priority: review PRs first, triage issues after PR decisions.

### Maintenance Items (P2)
- **#597** (upgrade CLI docs) → squad:pao + squad:network, P2 — user confusion, docs fix + UX improvement
- **#588** (model list update) → squad:procedures, P2 — hardcoded model list in squad.agent.md + templates
- **#554** (broken external links) → squad:pao, P2 — automated link checker output, investigate failures

### Questions (No Squad Assignment)
- **#589** (skills placement) → community reply — clarify `.copilot/skills` vs `.github/skills` vs `.claude/skills`
- **#494** (model vs squad model) → community reply — clarify Copilot CLI `/models` vs squad.agent.md model preference

### Long-Horizon Feature Work (P2-P3)
- **#581** (ADO Support PRD) → squad:flight, P2 — comprehensive PRD, but blocked until SDK-first parity (#341) ships

## Work Session Priority (Top 5)

1. **#610** → PAO — fix broken link (5 min), unblocks #611
2. **#590** → EECOM — fix getPersonalSquadRoot(), critical user-facing bug
3. **PR #592** → Flight review — matches #591, validate joniba's wiring guide
4. **PR #611** → Flight review — diberry TypeDoc API reference (blocked on #610 fix)
5. **#588** → Procedures — update model lists in templates

## PR Review Strategy

**Merge-ready (after minimal validation):**
- #611 (diberry) — blocked on #610, then merge
- #592 (joniba) — high-quality wiring guide

**Tamir PRs (defer until proposal-first validated):**
- #607, #606, #605, #604, #603, #602 — all substantive feature proposals without prior proposals in `docs/proposals/`. Apply proposal-first policy: request `docs/proposals/{slug}.md` before reviewing implementation.

**Draft (not ready):**
- #567 (diberry) — explicitly marked DRAFT

## Patterns Noted

- **Tamir contributions:** High technical quality, but needs proposal-first discipline (6 PRs without proposals).
- **Joniba contributions:** Consistently high-quality, matches team standards (wiring guide is excellent).
- **Diberry contributions:** MSFT-level quality, merge-ready on delivery.

## Deferred

- #357, #336, #335, #334, #333, #332, #316 (A2A) — stays shelved per existing decision
- #581 (ADO PRD) — P2, blocked until #341 (SDK-first parity) ships

---

# 2026-03-26: CI deletion guard and source tree canary

**By:** Booster (CI/CD)

## What

Added two safety checks to squad-ci.yml:
1. **Source tree canary** — verifies critical files exist at PR time
2. **Large deletion guard** — fails PRs that delete >50 files without `large-deletion-approved` label

Branch protection on dev requested (may need manual setup).

## Why

Incident #631 — @copilot deleted 361 files on dev with no CI gate catching it.

---

# 2026-03-26: Copilot git safety rules

**By:** RETRO (Security)

## What

Added mandatory Git Safety section to copilot-instructions.md:
- Prohibits `git add .` and `git commit -a`
- Requires feature branches and PRs for all commits
- Adds pre-push checklist (verify file count, check for unintended deletions, build succeeds)
- Defines red-flag stop conditions (>20 files, unintended deletions, out-of-scope changes)

## Why

Incident #631 — @copilot used destructive staging on an incomplete working tree, deleting 361 files.

---

# 2026-04-10: User directive — GitHub Apps identity scope

**By:** Ahmed Sabbour (via Copilot)

## What

GitHub Apps for agent identity do **NOT** need to handle issue assignment or PR review requests via GitHub APIs. Squad's own orchestration handles routing — apps only need to act (comment, commit, open PRs) under their own identity.

## Why

User request — simplifies the GitHub Apps integration scope. Assignment and review routing stay internal to Squad's label-based system.

---

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

---

# Decision: Versioning Policy — No Prerelease Versions on dev/main

**By:** Flight (Lead)  
**Date:** 2026-03-29  
**Requested by:** Dina  
**Status:** DECIDED  
**Confidence:** Medium (confirmed by PR #640 incident, PR #116 prerelease leak, CI gate implementation)

## Decision

1. **All packages use strict semver** (`MAJOR.MINOR.PATCH`). No prerelease suffixes on `dev` or `main`.
2. **Prerelease versions are ephemeral.** `bump-build.mjs` creates `-build.N` for local testing only — never committed.
3. **SDK and CLI versions must stay in sync.** Divergence silently breaks npm workspace resolution.
4. **Surgeon owns version bumps.** Other agents must not modify `version` fields in `package.json` unless fixing a prerelease leak.
5. **CI enforcement via `prerelease-version-guard`** blocks PRs with prerelease versions. `skip-version-check` label is Surgeon-only.

## Why

The repo had no documented versioning policy. This caused two incidents:

- **PR #640:** Prerelease version `0.9.1-build.4` silently broke workspace resolution. The semver range `>=0.9.0` does not match prerelease versions, causing npm to install a stale registry package instead of the local workspace link. Four PRs (#637–#640) patched symptoms before the root cause was found.
- **PR #116:** Surgeon set versions to `0.9.1-build.1` instead of `0.9.1` on a release branch because there was no guidance on what constitutes a clean release version.

## Skill Reference

Full policy documented in `.squad/skills/versioning-policy/SKILL.md`.

## Impact

- All agents must follow the versioning policy when touching `package.json`
- Surgeon charter should reference this skill for release procedures
- CI pipeline enforces the policy via automated gate

---

### 2026-04-10: User directive — GitHub App naming and identity scope
**By:** Ahmed Sabbour (via Copilot)

**What:** GitHub App naming/scoping must be specific to three dimensions: (1) the team member, (2) the user it's executing on behalf of, and (3) the repository. This means the app identity encodes who the agent is, whose Squad it belongs to, and which repo it operates on.

**Why:** User request — prevents naming collisions across users and repos. Two different users both running a "Flight" agent on different repos get distinct apps. Captured for team memory.

---

### 2026-04-10: User directive — registration-as-installation cross-repo reuse
**By:** Ahmed Sabbour (via Copilot)

**What:** The registration-as-installation model assumes agent names are consistent across repos owned by the same user. A "Flight" app registered once by a user can be installed on multiple repos because the same user runs the same Squad roster. If different repos have different team compositions or naming universes, the model still works — you just register the union of all agent names, and install each app only on the repos where that agent is active.

**Why:** User request — clarifies the cross-repo identity reuse assumption. Captured for team memory.

---

### 2026-04-10: User directive — cross-repo naming collision edge case
**By:** Ahmed Sabbour (via Copilot)

**What:** The cross-repo reuse model breaks when cloning someone else's repo. If I clone a repo I don't control, it may have a Squad with agent names that collide with my own registrations (e.g., both repos have a "Flight" but with different charters/roles). The `{agent}-{user}-squad` naming doesn't distinguish between MY Flight and THEIR Flight. This needs a clear design answer.

**Why:** User request — critical edge case for the identity architecture. Captured for team memory.

---

### 2026-04-10: User directive — role-based app model
**By:** Ahmed Sabbour (via Copilot)

**What:** Consider a role-based app model instead of per-name or per-user. One app per role per user — e.g., `sabbour-squad-lead`, `sabbour-squad-backend`. If Flight (repo A) and Leela (repo B) are both Leads, they share the `sabbour-squad-lead` app. This gives per-role identity on GitHub while keeping app count bounded by role count (typically 5-8), not agent count or repo count.

**Why:** User request — elegant middle ground between shared (1 app, no per-agent identity) and per-agent (N apps, scaling problems). Role count is small and stable. Captured for team memory.

---

### 2026-04-10: User directive — agent avatar generation
**By:** Ahmed Sabbour (via Copilot)

**What:** Squad should bundle pre-created avatars for each possible persona/role. Generate image generation prompts for each role so the user can pass them to an image generator. Avatars would be used as the GitHub App profile picture for the per-role app model.

**Why:** User request — gives each role-based bot a visually distinct identity on GitHub. Captured for team memory.

---

### 2026-03-28: Agent Avatar Design System
**By:** INCO  
**Scope:** Visual identity for Squad agent GitHub App profiles

**What:** All Squad agent avatars follow a unified design system:
- **Background:** Solid `#0D1117` (GitHub dark theme base) — not transparent
- **Style:** Flat geometric icons, single accent color per role + white accents
- **Motifs:** Abstract/symbolic shapes mapped to role function (not literal objects)
- **Target size:** Designed for legibility at 40×40px GitHub avatar size

**Why:** Transparent backgrounds break on GitHub dark mode. Photorealistic or illustrated styles lose detail at avatar sizes. A constrained system (one accent color, shared background, geometric shapes) ensures the set reads as a cohesive team while each role remains instantly distinguishable.

**Impact:** Image generation prompts live at `docs/proposals/agent-avatar-prompts.md`. Any new Squad roles should follow the same design system (dark bg, single accent, geometric motif). Color assignments are documented in the prompt file's color system table.



---

### 2026-04-10T19:52:00Z: User directive — fork-based workflow for GitHub App identity
**By:** Ahmed Sabbour (via Copilot)

**What:** You wouldn't install Squad identity apps on someone else's repo directly — you'd install them on your fork of that repo. This is the natural GitHub workflow: fork → install your Squad apps → work. The proposal's "cloning foreign repos" section should reflect this: the identity model works on forks, not upstream repos you don't own.

**Why:** User request — aligns the identity model with standard GitHub fork-based contribution workflows. Captured for team memory.

---

### 2026-04-10T19:53:00Z: User directive — Copilot CLI integration with identity module
**By:** Ahmed Sabbour (via Copilot)

**What:** The identity system must work seamlessly with GitHub Copilot CLI as the preferred mode of interaction. When agents spawn via `task` tool calls and make GitHub API calls (commenting, committing, opening PRs), the identity module should transparently switch auth context so those operations go through the role's GitHub App token instead of the user's `gh` CLI auth. Consider: Copilot CLI agents don't have direct access to the identity module — Squad's runtime wraps `gh` calls. The `SquadGitHubClient` needs to intercept or wrap the `gh` CLI calls that agents make, substituting the App token for the user's token when identity is configured.

**Why:** User request — the identity system is useless if it doesn't integrate with how agents actually work (via Copilot CLI spawning). Captured for team memory.

---

### 2026-04-10: Decision — Identity storage functions are synchronous
**By:** EECOM (Core Dev)
**Phase:** Identity Module MVP

**Context:** Identity module Phase 1 MVP is complete.

**Decision:** Identity storage functions (`loadIdentityConfig`, `saveIdentityConfig`, `loadAppRegistration`, `saveAppRegistration`, `hasPrivateKey`) are synchronous using `node:fs` sync APIs.

**Rationale:** Identity config is read during CLI startup to resolve which GitHub App credentials to use. This happens before any async work begins. Sync reads keep the startup path simple and avoid unnecessary async ceremony for small JSON files.

**Implications:**
- Storage functions take the **project root** path (parent of `.squad/`), not the `.squad/` dir
- If identity resolution ever needs to go async (e.g., remote key vaults), these will need an async wrapper — but that's a Phase 2 concern


---

### 2025-07-25: Token Lifecycle — No External Dependencies

**By:** EECOM

**Context**

Implemented GitHub App JWT generation and installation token exchange for the identity module. Had a choice between using the `jsonwebtoken` npm package or `node:crypto` built-in.

**Decision**

Use `node:crypto` `createSign('RSA-SHA256')` for JWT signing. Use `globalThis.fetch` for GitHub API calls. Zero new npm dependencies.

**Rationale**

- Aligns with "Zero-dependency scaffolding preserved" team decision
- RS256 JWT generation is ~15 lines with `node:crypto` — a full npm package is unnecessary
- `fetch` is built-in since Node 18, which is our minimum target
- Token cache uses a module-level `Map` with 10-minute refresh margin, keeping it simple

**Impact**

- Any agent can call `resolveToken(projectRoot, roleKey)` to get a ready-to-use GitHub token
- `clearTokenCache()` is exported for test isolation
- `squad identity create` uses the GitHub App Manifest flow — no PAT needed for setup