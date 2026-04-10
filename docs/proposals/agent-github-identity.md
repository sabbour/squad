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
| **One App per agent** ✅ | Distinct `[bot]` per agent | Free | Isolated per agent | ❌ (workaround below) |
| Machine users | Distinct human-like | Paid seat per agent | Isolated | ✅ native |
| Single app + attribution | One `[bot]` for all | Free | Shared | ❌ |
| Personal account (status quo) | Owner's account | Free | Shared, owner-coupled | ✅ native |

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

## What Doesn't Work (and Workarounds)

### ❌ Issue Assignment

GitHub Apps cannot be assignees. Only user accounts and org members can be assigned.

**Workaround — Virtual Assignment Pattern:**
Keep the existing `squad:flight` label for routing. The agent app comments to claim work:

```
🏗️ Flight is working on this.
```

This is actually *better* than assignment for Squad's model — labels drive routing, comments provide context, and the agent's bot identity makes the claim visually distinct.

### ❌ PR Review Requests

Apps cannot be "requested as reviewers" through the GitHub UI or API.

**Workaround — Proactive Review Pattern:**
Apps *can* submit full PR reviews (approve, request changes, comment) via the API. They just can't be formally requested. Squad already routes reviews through the coordinator — the app posts its review directly:

```
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
```

The review appears with the agent's `[bot]` identity. The only loss is the "requested reviewers" sidebar widget — an acceptable trade-off.

### ❌ CODEOWNERS

Apps can't be listed in CODEOWNERS files (requires users/teams).

**Workaround:** CODEOWNERS isn't part of Squad's current workflow. If needed later, use a GitHub Team as a proxy that triggers the relevant agent app via webhook.

### ❌ Team Membership

Apps can't join GitHub Teams.

**Impact:** Minimal. Squad uses labels and its own routing, not GitHub Teams.

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
{agent}-{squad-name}-squad
```

Examples: `flight-kickstart-squad`, `eecom-kickstart-squad`, `leela-kickstart-squad`.

If the name is taken, the CLI appends a short hash: `flight-kickstart-squad-a1b2`.

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
// Comment appears as flight-kickstart-squad[bot]
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

## Alternative Approaches Considered

### Machine Users (Rejected)

One GitHub account per agent. Full identity, full API compatibility (assignment, reviews).

**Why not:** Each account consumes a paid seat. For a team of 10+ agents, that's $40+/month on GitHub Team or $210+/month on Enterprise. GitHub's own docs recommend Apps over machine users. The assignment/review limitations have acceptable workarounds.

### Single App with Sub-Identity (Deferred)

One GitHub App for the entire Squad, with agent identity encoded in the comment body (like today, but with a bot badge).

**Why not now:** Doesn't solve the core problem — attribution. All comments still come from one identity. However, GitHub has emerging community demand for "sub-identity" support in Apps. If GitHub ships this feature, it would be the ideal solution: one app to manage, multiple display identities. Worth tracking on the GitHub public roadmap.

**If sub-identities ship:** Migrate from N apps to 1 app with N sub-identities. The `SquadGitHubClient` abstraction makes this a backend swap — agent code doesn't change.

### Hybrid: Apps for Identity + User Account for Assignment (Recommended for MVP)

Use Apps for all comment/commit/PR operations (identity matters). Use the owner's account (via `gh` CLI) for assignment and review requests (where Apps are limited).

This gives 90% of the identity benefit with zero workarounds for the 10% that Apps can't do.

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
- [ ] Hybrid routing: Apps for identity-visible ops, `gh` for assignment/review-request
- [ ] `squad identity create --all` batch creation
- [ ] `squad identity rotate <agent>` key rotation

**Ships:** Following minor release.

### Phase 3: CI/CD & Multi-Repo

**Goal:** Agent identities work in CI and across repositories.

- [ ] Environment variable credential override
- [ ] GitHub Actions integration (agent secrets in repo settings)
- [ ] Multi-repo installation support (one app installed on multiple repos)
- [ ] `squad identity export` for CI secret setup
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

1. **Naming collisions.** App names are globally unique on GitHub. What happens when two users both want `flight-squad`? The hash suffix (`flight-squad-a1b2`) works but isn't pretty. Should we use the GitHub username as a namespace (`sabbour-flight-squad`)?

2. **Org vs. user apps.** For org-owned repos, should apps be registered under the org or the user? Org registration means any org admin can manage them (good for teams). User registration means only the creator manages them (simpler for solo use).

3. **Avatar strategy.** Each GitHub App can have a custom avatar. Should Squad provide default avatars for agents? Should the avatar match the agent's role (e.g., a space-themed avatar for an Apollo 13 team)?

4. **Key storage for teams.** In a multi-developer Squad setup, how do team members share access to agent identities? Options: shared secret manager, each dev registers their own app set, or a "Squad identity server" that issues tokens.

5. **Webhook events.** GitHub Apps can receive webhooks. Should agent apps listen for events (new issues, PR comments) to enable proactive agent behavior? This is a significant architecture expansion — out of scope for MVP but worth designing the extension point.

6. **Existing `gh-auth-isolation` skill.** Squad already has a skill for managing multiple GitHub identities via `gh auth`. Should the identity system build on this, or is the App-based approach a clean replacement? Recommendation: they serve different purposes — `gh-auth-isolation` handles human multi-account; `squad identity` handles agent identity. Both coexist.

7. **Sub-identity timeline.** GitHub community is requesting sub-identity support for Apps. If it ships within 6 months, should we wait? **Recommendation: No.** Build the per-app model now. The `SquadGitHubClient` abstraction means migrating to sub-identities later is a backend swap, not a rewrite.

---

## Decision

**Build the per-agent GitHub App model, phased starting with MVP (comments + commits).** The abstraction layer (`SquadGitHubClient.asAgent()`) insulates agent code from the identity backend, so future changes (sub-identities, different providers) don't cascade.

The hybrid approach (Apps for visible operations, `gh` CLI fallback for assignment/review) gives immediate value without waiting for GitHub to close capability gaps.

This is a compounding decision: once agents have their own identity, every future feature (proactive triage, automated reviews, multi-repo coordination) gets built on a clean attribution foundation.

---

*Flight out.*
