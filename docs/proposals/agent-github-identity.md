# Proposal: Agent GitHub Identity via GitHub Apps

**Author:** Flight (Lead)  
**Date:** 2026-03-27  
**Status:** Proposal  

---

## Problem Statement

Every Squad agent today acts through the repo owner's personal GitHub account. When Leela triages an issue, Fry ships a fix, or Bender reviews a PR — GitHub shows it as the owner talking to themselves. The only attribution is a bold-text prefix in the comment body: `**Triage (Leela):** ...`.

This creates three concrete problems:

1. **Audit opacity.** You can't filter GitHub notifications by which agent acted. Everything is "you commented on your own issue." At scale, this makes the notification stream useless.

2. **Trust erosion.** External contributors see one account having full conversations with itself. It looks like a person manually posting formatted messages, not a team of specialized agents making independent decisions.

3. **Identity coupling.** The owner's personal API token is the single credential for all agent operations. Rate limits are shared. Revocation is all-or-nothing. There's no way to scope permissions per agent role.

The current model was fine for prototyping. It doesn't scale past a handful of agents or a public-facing repo.

---

## Proposed Solution: One GitHub App Per Agent

Each Squad agent gets its own [GitHub App](https://docs.github.com/en/apps/overview), giving it a distinct `[bot]` identity on GitHub. When Flight comments, it shows as `flight-squad[bot]`. When EECOM pushes a commit, the author is `eecom-squad[bot]`.

### Why GitHub Apps (not machine users, not a single app)

| Approach | Identity | Cost | Credential scope | Assignment/Review |
|----------|----------|------|-------------------|-------------------|
| **One App per agent** ✅ | Distinct `[bot]` per agent | Free | Isolated per agent | Via Squad routing (labels) |
| Machine users | Distinct human-like | Paid seat per agent | Isolated | ✅ native GitHub UI |
| Single app + attribution | One `[bot]` for all | Free | Shared | Via Squad routing (labels) |
| Personal account (status quo) | Owner's account | Free | Shared, owner-coupled | ✅ native GitHub UI |

**Recommendation: One App per agent.** The per-agent identity is the entire point. Machine users cost money and GitHub explicitly recommends Apps over them. A single shared app would be marginally better than today (at least it's a bot badge) but loses per-agent attribution — defeating the purpose.

---

## What Works Cleanly

These GitHub App capabilities map directly to Squad agent operations:

| Capability | How it works |
|------------|-------------|
| **Issue/PR comments** | App posts as `agentname[bot]` with its own avatar. Native filtering. |
| **Commits** | Author: `agentname[bot] <12345+agentname[bot]@users.noreply.github.com>`. Full git blame attribution. |
| **Branch operations** | Create, delete, push — all under the app's identity. |
| **Open/merge PRs** | App opens PRs as itself. Appears as a distinct contributor. |
| **Labels** | Add/remove labels (preserves `squad:agent` routing pattern). |
| **Reactions** | Agents can react to comments (useful for acknowledgment patterns). |
| **Status checks** | Post commit statuses and check runs. |
| **Audit log** | Every action attributed to the specific app in org audit logs. |

---

## GitHub API Gaps (Non-Issues for Squad)

GitHub Apps have a few API limitations compared to user accounts. None of these are problems for Squad, because Squad's own routing model is the intended mechanism for assignment and review — not GitHub's native UI primitives.

### Issue Assignment — Not Needed

GitHub Apps cannot be assignees. But Squad doesn't use GitHub assignment for routing work — it uses `squad:{agent}` labels. The label-based routing IS the assignment mechanism. The agent app comments to signal it's working:

```
🏗️ Flight is working on this.
```

This is *better* than GitHub assignment for Squad's model: labels drive routing, comments provide context, and the agent's `[bot]` identity makes the claim visually distinct.

### PR Review Requests — Not Needed

Apps cannot be "requested as reviewers" through the GitHub UI. But Squad routes reviews through its own coordinator, not GitHub's review-request system. Apps *can* submit full PR reviews (approve, request changes, comment) via the API — they just can't appear in the "requested reviewers" sidebar widget.

```
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
```

The review appears with the agent's `[bot]` identity. The sidebar widget is cosmetic; the actual review and its enforcement (required approvals, etc.) work identically.

### CODEOWNERS — Not Needed

Apps can't be listed in CODEOWNERS files (requires users/teams). CODEOWNERS isn't part of Squad's workflow. If needed later, a GitHub Team proxy can trigger the relevant agent app via webhook.

### Team Membership — Not Needed

Apps can't join GitHub Teams. Squad uses labels and its own routing, not GitHub Teams.

---

## Bootstrap Flow

### App Creation via Manifest Flow

GitHub Apps cannot be created fully headlessly. The [manifest flow](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest) is semi-automated:

1. Squad CLI generates a JSON manifest with the agent's name, required permissions, and events.
2. CLI opens the user's browser to `https://github.com/settings/apps/new?manifest=<encoded>`.
3. User confirms the app name on GitHub (one click).
4. GitHub redirects back with a temporary code.
5. CLI exchanges the code for credentials (app ID, private key, webhook secret).
6. Credentials are stored locally (see Credential Management below).

### CLI Interface

```bash
# Create identity for a single agent
squad identity create flight

# Create identities for all agents in the roster
squad identity create --all

# Check identity status
squad identity status

# Rotate credentials
squad identity rotate flight
```

`squad identity create --all` would loop through the team roster in `.squad/team.md`, creating one app per agent. Each creation requires a browser confirmation — the CLI guides the user through each one sequentially.

### Naming Convention

App names must be globally unique on GitHub. Convention:

```
{agent}-{user}-squad
```

This scopes each registration to the agent × user pair. The GitHub username provides a natural namespace that avoids collisions between different Squad users.

Examples: `flight-sabbour-squad`, `eecom-sabbour-squad`, `leela-sabbour-squad`.

The resulting `[bot]` identities are: `flight-sabbour-squad[bot]`, `eecom-sabbour-squad[bot]`, etc.

If the name is still taken, the CLI appends a short hash: `flight-sabbour-squad-a1b2`.

### Required Permissions

Minimal permission set for Squad agent operations:

```json
{
  "permissions": {
    "issues": "write",
    "pull_requests": "write",
    "contents": "write",
    "metadata": "read",
    "statuses": "write"
  }
}
```

Agents that only triage (like a dedicated triage agent) could use a reduced set (`issues: write`, `contents: read`). But for MVP, a uniform permission set keeps things simple.

---

## Credential Management

### Storage

```
.squad/
  identity/
    apps/
      flight.json      # { appId, installationId, appSlug }
      eecom.json
    keys/               # ⚠️ GITIGNORED
      flight.pem        # Private key
      eecom.pem
```

- **`apps/*.json`** — Committed. Contains non-secret metadata (app ID, installation ID, slug). Other team members need this to know which apps exist.
- **`keys/*.pem`** — Gitignored. Private keys never enter version control. Period.
- **`.gitignore`** entry: `.squad/identity/keys/`

### Token Lifecycle

GitHub App authentication is a two-step process:

1. **JWT generation:** Sign a JWT using the app's private key. Valid for 10 minutes.
2. **Installation token exchange:** Exchange the JWT for an installation access token. Valid for 1 hour.

Squad caches installation tokens and refreshes them proactively (at 50 minutes, not at expiry). Token refresh is transparent — agents never deal with auth directly.

### Environment Variable Override

For CI/CD or environments where PEM files aren't practical:

```bash
SQUAD_FLIGHT_APP_ID=12345
SQUAD_FLIGHT_PRIVATE_KEY=base64-encoded-pem
SQUAD_FLIGHT_INSTALLATION_ID=67890
```

Environment variables take precedence over local files. This enables GitHub Actions workflows where agent identities are stored as repository secrets.

---

## API Architecture

### Identity-Aware GitHub Client

The core change is a GitHub API client that switches identity based on which agent is acting:

```typescript
interface AgentIdentity {
  agentName: string;
  appId: number;
  installationId: number;
  privateKey: string;
}

class SquadGitHubClient {
  // Get an authenticated Octokit instance for a specific agent
  async asAgent(agentName: string): Promise<Octokit> {
    const identity = await this.loadIdentity(agentName);
    const token = await this.getInstallationToken(identity);
    return new Octokit({ auth: token });
  }
}

// Usage in agent code
const gh = squad.github();
const octokit = await gh.asAgent('flight');
await octokit.issues.createComment({
  owner, repo, issue_number,
  body: 'Architecture review complete. Approved.'
});
// Comment appears as flight-sabbour-squad[bot]
```

### Fallback Behavior

If an agent doesn't have an identity configured, fall back to the user's `gh` CLI auth (today's behavior). This ensures:

- Existing Squad setups keep working without any identity configuration.
- Identity adoption is opt-in and incremental.
- The `squad identity status` command shows which agents have identities and which are using fallback.

### `gh` CLI vs. Octokit

Today Squad uses the `gh` CLI for GitHub operations. The identity system would introduce Octokit (via `@octokit/app`) for identity-aware API calls. The `gh` CLI doesn't support GitHub App authentication natively.

**Migration path:** Wrap `gh` CLI calls in an abstraction layer first. Then, for operations where identity matters (comments, reviews, commits), route through the Octokit client. Keep `gh` CLI for user-facing operations (like `squad identity create` which uses `gh`'s browser auth flow).

---

## Scaling & Limits

### Registration vs. Installation Model

GitHub imposes a **hard cap of 100 App registrations per account** — no exceptions.  However, there is **no limit on installations** — a registered app can be installed on unlimited repositories.

This maps cleanly to a three-dimensional scoping model:

| Dimension | Mechanism | Limit |
|-----------|-----------|-------|
| **Agent** | Part of app name (`flight-...`) | Per team roster |
| **User** | Part of app name (`...-sabbour-...`) | Per GitHub user |
| **Repo** | Installation of the app | Unlimited |

The correct model:
- **Registration** (counts toward 100): `{agent}-{user}-squad` — scoped to agent × user
- **Installation** (unlimited): one per repo the agent works on

This means 15 agents = 15 registrations per user. Each can be installed on any number of repos. The `[bot]` identity stays consistent across repos: `flight-sabbour-squad[bot]` looks the same whether it comments on repo A or repo B.

### Concrete Scaling Numbers

| Scenario | Registrations | Status |
|----------|--------------|--------|
| 1 user, 15 agents, 1 repo | 15 | ✅ Fine |
| 1 user, 15 agents, 10 repos | 15 | ✅ Fine (repos = installations, not registrations) |
| 1 user, 20 agents, 50 repos | 20 | ✅ Fine |
| 7 users, 15 agents each | 15 per user (105 total) | ✅ Each user has 15 — limit is per-account |
| 1 user, 100+ agents | 100+ | ❌ Need overflow org |

The per-user scoping means the 100-app limit is effectively per-user, not per-org. Each Squad user registers their own apps under their own GitHub account.

### Overflow Strategy

If a user somehow needs more than 100 agent registrations, they can create "app-hosting organizations" (e.g., `sabbour-squad-apps-1`, `sabbour-squad-apps-2`) and register apps there. Each org gets its own 100-app quota. This is a documented GitHub pattern — unlikely to be needed for Squad but available as an escape hatch.

---

## Developer Onboarding

### The Cloning Story

When a new developer clones a repo with Squad agent identities configured, here's what they get:

**Committed (available immediately):**
```
.squad/identity/apps/flight.json    # { appId, installationId, appSlug }
.squad/identity/apps/eecom.json
```

**Gitignored (NOT available):**
```
.squad/identity/keys/flight.pem     # Private key — never in version control
.squad/identity/keys/eecom.pem
```

### Behavior Without Keys

Without private keys, agents **fall back to `gh` CLI auth** — today's behavior. Everything works. The developer can run Squad normally; agents just won't have distinct `[bot]` identities on GitHub.

The `squad identity status` command makes this visible:

```
$ squad identity status
  flight    ⚠️ App registered, key missing — using gh CLI fallback
  eecom     ⚠️ App registered, key missing — using gh CLI fallback
  leela     ✅ Identity active (flight-sabbour-squad[bot])
```

### Getting Agent Identities

Developers who want agent identities have three paths:

1. **Shared keys (team secret manager).** The team stores PEM files in a vault (1Password, Azure Key Vault, etc.) and shares access. Developer downloads keys to `.squad/identity/keys/`. Fastest path for existing teams.

2. **Register your own apps.** Run `squad identity create --all` to register a fresh set of apps under your own GitHub account. Each agent gets a new `{agent}-{yourusername}-squad` identity. Independent of the original registrations — each developer "owns" their agents.

3. **CI-only model.** Only CI/CD has the keys (stored as repo secrets). Developers use `gh` CLI fallback locally. Agent identities only appear on CI-generated comments and commits. Simplest to manage — the recommended starting point for most teams.

---

## Alternative Approaches Considered

### Machine Users (Rejected)

One GitHub account per agent. Full identity, full native GitHub API compatibility (assignment, review requests).

**Why not:** Each account consumes a paid seat. For a team of 10+ agents, that's $40+/month on GitHub Team or $210+/month on Enterprise. GitHub's own docs recommend Apps over machine users. And Squad doesn't need native assignment or review requests — its own label-based routing handles both.

### Single App with Sub-Identity (Deferred)

One GitHub App for the entire Squad, with agent identity encoded in the comment body (like today, but with a bot badge).

**Why not now:** Doesn't solve the core problem — attribution. All comments still come from one identity. However, GitHub has emerging community demand for "sub-identity" support in Apps. If GitHub ships this feature, it would be the ideal solution: one app to manage, multiple display identities. Worth tracking on the GitHub public roadmap.

**If sub-identities ship:** Migrate from N apps to 1 app with N sub-identities. The `SquadGitHubClient` abstraction makes this a backend swap — agent code doesn't change.

### One App Per Agent Per Repo (Rejected)

Register a separate app for each agent × repo combination.

**Why not:** This model burns registrations on repos instead of using installations. With 15 agents and 7 repos, that's 105 registrations — already over the 100-app limit. Installations are the correct mechanism for the repo dimension: register once per agent × user, install on as many repos as needed.

### Hybrid: Apps for Identity + User Account for Assignment (No Longer Needed)

Originally considered using the owner's account (via `gh` CLI) for assignment and review requests while Apps handle identity-visible operations.

**Updated assessment:** Squad's label-based routing already handles assignment and review dispatch. There's no need to mix in the owner's account for these operations. The pure App model is cleaner — use Apps for identity-visible operations, and Squad's own routing for everything else.

---

## Phased Rollout

### Phase 1: Foundation (MVP)

**Goal:** Agents can comment and commit under their own identity.

- [ ] `squad identity create <agent>` CLI command (manifest flow)
- [ ] Credential storage (`.squad/identity/apps/`, `.squad/identity/keys/`)
- [ ] `SquadGitHubClient` with `asAgent()` method
- [ ] Comment operations through identity-aware client
- [ ] Commit signing with agent identity
- [ ] `squad identity status` command
- [ ] Fallback to `gh` CLI when identity not configured

**Ships:** Next minor release. Estimated effort: 2-3 sprints.

### Phase 2: Full Operations

**Goal:** All GitHub operations route through agent identity where possible.

- [ ] PR creation/merge under agent identity
- [ ] Label management under agent identity
- [ ] Branch operations under agent identity
- [ ] `squad identity create --all` batch creation
- [ ] `squad identity rotate <agent>` key rotation
- [ ] Multi-repo installation support (one app installed on multiple repos via `squad identity install`)

**Ships:** Following minor release.

### Phase 3: CI/CD & Team Onboarding

**Goal:** Agent identities work in CI and across development teams.

- [ ] Environment variable credential override
- [ ] GitHub Actions integration (agent secrets in repo settings)
- [ ] `squad identity export` for CI secret setup
- [ ] `squad identity status` showing fallback vs. active per agent
- [ ] Documentation for the three onboarding paths (shared keys, self-registration, CI-only)
- [ ] Rate limit monitoring per agent

**Ships:** After Phase 2 stabilizes.

### Phase 4: Advanced Identity

**Goal:** Rich identity features.

- [ ] Custom avatars per agent (configurable via App settings)
- [ ] Agent-specific permission scoping (triage agents get read-heavy perms)
- [ ] Sub-identity migration path (if GitHub ships the feature)
- [ ] Identity analytics (which agent is most active, rate limit usage)

**Ships:** When there's user demand.

---

## Open Questions

1. **Avatar strategy.** Each GitHub App can have a custom avatar. Should Squad provide default avatars for agents? Should the avatar match the agent's role (e.g., a space-themed avatar for an Apollo 13 team)?

2. **Webhook events.** GitHub Apps can receive webhooks. Should agent apps listen for events (new issues, PR comments) to enable proactive agent behavior? This is a significant architecture expansion — out of scope for MVP but worth designing the extension point.

3. **Existing `gh-auth-isolation` skill.** Squad already has a skill for managing multiple GitHub identities via `gh auth`. Should the identity system build on this, or is the App-based approach a clean replacement? Recommendation: they serve different purposes — `gh-auth-isolation` handles human multi-account; `squad identity` handles agent identity. Both coexist.

4. **Sub-identity timeline.** GitHub community is requesting sub-identity support for Apps. If it ships within 6 months, should we wait? **Recommendation: No.** Build the per-app model now. The `SquadGitHubClient` abstraction means migrating to sub-identities later is a backend swap, not a rewrite.

---

## Decision

**Build the per-agent GitHub App model, phased starting with MVP (comments + commits).** The abstraction layer (`SquadGitHubClient.asAgent()`) insulates agent code from the identity backend, so future changes (sub-identities, different providers) don't cascade.

Squad's label-based routing handles assignment and review dispatch — there's no need for a hybrid approach mixing Apps with the owner's account. Apps provide identity for visible operations; Squad's own routing handles everything else. The registration-per-agent, installation-per-repo model keeps well within GitHub's 100-app limit for any realistic team size.

This is a compounding decision: once agents have their own identity, every future feature (proactive triage, automated reviews, multi-repo coordination) gets built on a clean attribution foundation.

---

*Flight out.*
