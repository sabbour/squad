# Proposal: Agent GitHub Identity via GitHub Apps

**Author:** Flight (Lead)  
**Date:** 2026-03-27  
**Revised:** 2026-03-28  
**Status:** Proposal (Revised — Shared App Model)  

---

## Problem Statement

Every Squad agent today acts through the repo owner's personal GitHub account. When Leela triages an issue, Fry ships a fix, or Bender reviews a PR — GitHub shows it as the owner talking to themselves. The only attribution is a bold-text prefix in the comment body: `**Triage (Leela):** ...`.

This creates three concrete problems:

1. **Audit opacity.** You can't filter GitHub notifications by which agent acted. Everything is "you commented on your own issue." At scale, this makes the notification stream useless.

2. **Trust erosion.** External contributors see one account having full conversations with itself. It looks like a person manually posting formatted messages, not a team of specialized agents making independent decisions.

3. **Identity coupling.** The owner's personal API token is the single credential for all agent operations. Rate limits are shared. Revocation is all-or-nothing. There's no way to scope permissions per agent role.

The current model was fine for prototyping. It doesn't scale past a handful of agents or a public-facing repo.

---

## Proposed Solution: One Shared GitHub App Per User

Each Squad user registers a single [GitHub App](https://docs.github.com/en/apps/overview) named `{user}-squad` (e.g., `sabbour-squad`). All agent operations route through this one app. Agent attribution is carried in structured comment bodies and commit messages — not in the GitHub App identity itself.

When any agent comments, it appears as `sabbour-squad[bot]` — clearly a bot, clearly whose. The comment body identifies which agent authored it:

```markdown
🏗️ **Flight** (Lead)

Architecture review complete. The proposed auth module follows our established patterns. Approved.
```

### Why a Shared App (not per-agent apps, not machine users)

The original version of this proposal recommended one GitHub App per agent. Iterative design review revealed cascading problems with that model:

1. **34-character GitHub App name limit.** GitHub App names are capped at 34 characters and must be globally unique. The per-agent pattern `{agent}-{user}-squad` works for short names but breaks with longer agent or user names. The repo-qualified fallback `{agent}-{user}-{repo}-squad` exceeds the limit almost immediately.

2. **Cross-repo collisions.** When you clone someone else's repo, their "Flight" ≠ your "Flight" — but both map to `flight-sabbour-squad`. The original proposal required two-tier naming logic, collision detection, and repo-qualified disambiguation to handle this. All of which goes away with a shared app.

3. **Registration scaling.** GitHub's hard cap of 100 App registrations per account gets tight when you multiply agents × repos. With a shared app: always 1 registration, regardless of agent count or repo count.

4. **Credential explosion.** N agents = N private keys to manage, rotate, and secure. One app = one key.

5. **Bootstrap friction.** `squad identity create --all` with per-agent apps requires N sequential browser confirmations. With a shared app: one click, done.

6. **Naming logic complexity.** Two-tier naming, collision detection, short-hash fallbacks, repo-qualified suffixes — all this machinery exists solely to work around per-agent naming constraints. A shared app eliminates the entire category.

### Approach Comparison

| Approach | Identity | Cost | Credential scope | Assignment/Review |
|----------|----------|------|-------------------|-------------------|
| **Shared app per user** ✅ | One `[bot]` for all agents | Free | One credential set | Via Squad routing (labels) |
| One app per agent | Distinct `[bot]` per agent | Free | Isolated per agent | Via Squad routing (labels) |
| Machine users | Distinct human-like | Paid seat per agent | Isolated | ✅ native GitHub UI |
| Personal account (status quo) | Owner's account | Free | Shared, owner-coupled | ✅ native GitHub UI |

### Trade-off Matrix: Shared App vs. Per-Agent App

| Goal | Per-agent app | Shared app |
|------|--------------|------------|
| Not talking to yourself | ✅ | ✅ |
| Bot badge on GitHub | ✅ | ✅ |
| Per-agent GitHub filtering | ✅ | ❌ (all from one bot) |
| Per-agent avatar | ✅ | ❌ (one avatar) |
| Per-agent git blame | ✅ | ❌ (one committer, agent in message) |
| 34-char name limit | ⚠️ Tight | ✅ Trivial |
| Cross-repo reuse | ⚠️ Complex | ✅ One install per repo |
| Foreign repo cloning | ⚠️ Collisions | ✅ No collisions |
| Scaling (100 app cap) | ⚠️ Agent count dependent | ✅ Always 1 |
| Bootstrap UX | ⚠️ N browser confirmations | ✅ One click |
| Credential management | ⚠️ N keys | ✅ One key |
| Operational complexity | 🔴 High | 🟢 Low |

The shared app trades per-agent GitHub-native filtering and per-agent avatars for dramatically lower operational complexity. Since agent identity is carried in comment and commit bodies — which is what people actually read — the loss of per-agent GitHub filtering is cosmetic, not functional.

---

## What Works Cleanly

These GitHub App capabilities map directly to Squad agent operations under the shared app model:

| Capability | How it works |
|------------|-------------|
| **Issue/PR comments** | App posts as `{user}-squad[bot]`. Agent identity in structured comment body. |
| **Commits** | Author: `{user}-squad[bot] <12345+{user}-squad[bot]@users.noreply.github.com>`. Agent name in commit message prefix. |
| **Branch operations** | Create, delete, push — all under the shared app's identity. |
| **Open/merge PRs** | App opens PRs as itself. Appears as a bot contributor. |
| **Labels** | Add/remove labels (preserves `squad:agent` routing pattern). |
| **Reactions** | Agents can react to comments (useful for acknowledgment patterns). |
| **Status checks** | Post commit statuses and check runs. |
| **Audit log** | Every action attributed to the shared app in org audit logs. |

---

## GitHub API Gaps (Non-Issues for Squad)

GitHub Apps have a few API limitations compared to user accounts. None of these are problems for Squad, because Squad's own routing model is the intended mechanism for assignment and review — not GitHub's native UI primitives.

### Issue Assignment — Squad Uses Labels

GitHub Apps cannot be assignees. Squad doesn't use GitHub assignment for routing work — it uses `squad:{agent}` labels. The label-based routing IS the assignment mechanism. The agent comments to signal it's working:

```markdown
🏗️ **Flight** (Lead)

Working on this.
```

Labels drive routing, comments provide context, and the `[bot]` identity makes the claim visually distinct from the repo owner.

### PR Review Requests — Squad Routes Reviews

Apps cannot be "requested as reviewers" through the GitHub UI. Squad routes reviews through its own coordinator. Apps *can* submit full PR reviews (approve, request changes, comment) via the API — they just can't appear in the "requested reviewers" sidebar widget.

```
POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
```

The review appears with the app's `[bot]` identity and the agent name in the review body. The sidebar widget is cosmetic; the actual review and its enforcement (required approvals, etc.) work identically.

### CODEOWNERS — Not Needed

Apps can't be listed in CODEOWNERS files (requires users/teams). CODEOWNERS isn't part of Squad's workflow. If needed later, a GitHub Team proxy can trigger the relevant agent via webhook.

### Team Membership — Not Needed

Apps can't join GitHub Teams. Squad uses labels and its own routing, not GitHub Teams.

---

## Comment Attribution Format

Since all comments come from one bot identity (`{user}-squad[bot]`), the comment body carries the agent identity. Squad formats every agent comment with a structured header:

### Standard Format

```markdown
🏗️ **Flight** (Lead)

Architecture review complete. The proposed auth module follows our established patterns. Approved.
```

The emoji + bold agent name + role in parentheses gives immediate visual identification. The actual content follows after a blank line.

### Commit Message Format

Commits use the shared app as the Git author, with the agent name as a commit message prefix:

```
[Flight] refactor: extract auth module
```

Git author: `sabbour-squad[bot] <12345+sabbour-squad[bot]@users.noreply.github.com>`

This preserves machine-parseable agent attribution in git history while keeping one committer identity.

### Why This Works

People read comment bodies, not commenter hover cards. The agent name at the top of every comment is more visible than a GitHub username — it's bold, emoji-prefixed, and includes the role. For git blame, `[AgentName]` prefixes are greppable and filter-friendly.

---

## Bootstrap Flow

### App Creation via Manifest Flow

GitHub Apps cannot be created fully headlessly. The [manifest flow](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest) is semi-automated:

1. Squad CLI generates a JSON manifest with the app name (`{user}-squad`), required permissions, and events.
2. CLI opens the user's browser to `https://github.com/settings/apps/new?manifest=<encoded>`.
3. User confirms the app name on GitHub (one click).
4. GitHub redirects back with a temporary code.
5. CLI exchanges the code for credentials (app ID, private key, webhook secret).
6. Credentials are stored locally (see Credential Management below).

One registration. One browser confirmation. Done.

### CLI Interface

```bash
# Create the shared Squad identity
squad identity create

# Check identity status
squad identity status

# Rotate credentials
squad identity rotate

# Install on additional repos
squad identity install <owner/repo>
```

No `--all` flag needed. No per-agent loop. One command creates one app.

### Naming Convention

The shared app uses a simple, predictable name:

```
{user}-squad
```

Examples: `sabbour-squad`, `octocat-squad`, `jdoe-squad`.

The resulting `[bot]` identity: `sabbour-squad[bot]`.

#### GitHub App Name Constraints

GitHub App names have the following restrictions (verified empirically):

- **Maximum length:** 34 characters
- **Must be globally unique** across all of GitHub
- **Allowed characters:** alphanumeric, hyphens, spaces (rendered as hyphens in slugs)
- **Reserved prefixes:** `github`, `octocat` (and others) cannot be used

With the `{user}-squad` pattern, the name is always `len(username) + 6` characters. GitHub usernames max out at 39 characters, but in practice the `{user}-squad` pattern stays well under 34 for any real username. If a username exceeds 28 characters, the CLI can truncate with a suffix: `{user-truncated}-squad`.

This is a non-issue in practice — the 34-char limit only becomes a problem with per-agent naming where `{agent}-{user}-{repo}-squad` compounds three variable-length segments.

### Required Permissions

Minimal permission set for Squad operations:

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

One permission set covers all agents. No need to scope per-agent — Squad's own routing handles which agent does what.

---

## Credential Management

### Storage

```
.squad/
  identity/
    apps/
      squad.json        # { appId, installationId, appSlug }
    keys/               # ⚠️ GITIGNORED
      squad.pem         # Private key
```

- **`apps/squad.json`** — Committed. Contains non-secret metadata (app ID, installation ID, slug). Other team members need this to know the app exists.
- **`keys/squad.pem`** — Gitignored. Private key never enters version control. Period.
- **`.gitignore`** entry: `.squad/identity/keys/`

One JSON file. One PEM file. No per-agent proliferation.

### Token Lifecycle

GitHub App authentication is a two-step process:

1. **JWT generation:** Sign a JWT using the app's private key. Valid for 10 minutes.
2. **Installation token exchange:** Exchange the JWT for an installation access token. Valid for 1 hour.

Squad caches installation tokens and refreshes them proactively (at 50 minutes, not at expiry). Token refresh is transparent — agents never deal with auth directly.

### Environment Variable Override

For CI/CD or environments where PEM files aren't practical:

```bash
SQUAD_APP_ID=12345
SQUAD_PRIVATE_KEY=base64-encoded-pem
SQUAD_INSTALLATION_ID=67890
```

Three environment variables total — not three per agent. This enables GitHub Actions workflows where the squad identity is stored as repository secrets.

---

## API Architecture

### Identity-Aware GitHub Client

The core change is a GitHub API client that routes all agent operations through the shared app identity:

```typescript
interface SquadIdentity {
  appId: number;
  installationId: number;
  privateKey: string;
}

class SquadGitHubClient {
  // Get an authenticated Octokit instance for Squad operations
  async getClient(): Promise<Octokit> {
    const identity = await this.loadIdentity();
    const token = await this.getInstallationToken(identity);
    return new Octokit({ auth: token });
  }

  // Post a comment with agent attribution in the body
  async commentAs(agentName: string, agentRole: string, opts: CommentOpts): Promise<void> {
    const octokit = await this.getClient();
    const body = this.formatAgentComment(agentName, agentRole, opts.body);
    await octokit.issues.createComment({
      owner: opts.owner,
      repo: opts.repo,
      issue_number: opts.issueNumber,
      body
    });
  }

  private formatAgentComment(name: string, role: string, content: string): string {
    const emoji = this.agentEmoji(name);
    return `${emoji} **${name}** (${role})\n\n${content}`;
  }
}

// Usage in agent code
const gh = squad.github();
await gh.commentAs('Flight', 'Lead', {
  owner, repo, issueNumber,
  body: 'Architecture review complete. Approved.'
});
// Comment appears as sabbour-squad[bot] with Flight attribution in body
```

The `commentAs()` method abstracts agent attribution — agent code just provides the content. The client handles formatting, identity, and authentication transparently.

### Fallback Behavior

If the shared app identity isn't configured, fall back to the user's `gh` CLI auth (today's behavior). This ensures:

- Existing Squad setups keep working without any identity configuration.
- Identity adoption is opt-in and incremental.
- The `squad identity status` command shows whether the shared identity is active or using fallback.

### `gh` CLI vs. Octokit

Today Squad uses the `gh` CLI for GitHub operations. The identity system would introduce Octokit (via `@octokit/app`) for identity-aware API calls. The `gh` CLI doesn't support GitHub App authentication natively.

**Migration path:** Wrap `gh` CLI calls in an abstraction layer first. Then, for operations where identity matters (comments, reviews, commits), route through the Octokit client. Keep `gh` CLI for user-facing operations (like `squad identity create` which uses `gh`'s browser auth flow).

---

## Developer Onboarding

The shared app model makes onboarding dramatically simpler.

### Clone → Run → Done

1. Clone any repo with Squad configured.
2. Squad works immediately — falls back to `gh` CLI auth.
3. No keys, no identity files, no setup required.

### Want Bot Identity? One Command.

```bash
$ squad identity create
  ✅ Created GitHub App: sabbour-squad
  ✅ App installed on bradygaster/squad
  ✅ Credentials stored in .squad/identity/
  
  All agents will now post as sabbour-squad[bot].
```

One browser confirmation. One app. Done.

### Installing on Additional Repos

Your `sabbour-squad` app can be installed on any repo:

```bash
$ squad identity install someone-else/cool-project
  ✅ sabbour-squad installed on someone-else/cool-project
```

No naming collisions. No repo-qualified fallbacks. No two-tier naming logic. Your `sabbour-squad` is always yours, regardless of which repo you're working on.

### Behavior Without Identity

Without a configured identity, agents **fall back to `gh` CLI auth** — today's behavior. Everything works. The developer can run Squad normally; agents just won't have the `[bot]` badge on GitHub.

The `squad identity status` command makes this visible:

```
$ squad identity status
  Identity:  sabbour-squad[bot]
  Status:    ✅ Active
  Installed: bradygaster/squad, someone-else/cool-project
  Agents:    All agents route through this identity
```

Or, without identity:

```
$ squad identity status
  Identity:  Not configured
  Status:    ⚠️ Using gh CLI fallback (all actions appear as your personal account)
  Run:       squad identity create
```

### Getting the Identity on a New Machine

Two paths:

1. **Transfer the key.** Copy `squad.pem` from a secure vault (1Password, Azure Key Vault, etc.) to `.squad/identity/keys/`. The `apps/squad.json` is already committed — only the key needs sharing.

2. **CI-only model.** Only CI/CD has the key (stored as one repo secret). Developers use `gh` CLI fallback locally. Bot identity only appears on CI-generated comments and commits. Simplest to manage — the recommended starting point for most teams.

---

## Scaling & Limits

### Why Scaling Is a Non-Issue

With the shared app model, every user has exactly **1 app registration** regardless of how many agents or repos they have. GitHub's 100-app-per-account limit is irrelevant.

| Scenario | Registrations | Status |
|----------|--------------|--------|
| 1 user, 5 agents, 1 repo | 1 | ✅ |
| 1 user, 50 agents, 100 repos | 1 | ✅ |
| 1 user, 200 agents, 500 repos | 1 | ✅ |
| 10 users, any agents, any repos | 1 per user | ✅ |

The registration-vs-installation distinction still applies — a registered app can be installed on unlimited repositories — but you never need to think about it because you'll never approach the limit.

### GitHub App Limits Reference

For context, GitHub imposes these limits on App registrations:

- **100 App registrations per user account** — hard cap, no exceptions
- **No limit on installations** — a registered app can be installed on unlimited repos
- **34-character App name limit** — must be globally unique

With the shared model, only the 34-char name limit is even theoretically relevant, and `{user}-squad` stays well under it.

---

## Advanced Mode: Per-Agent Apps

For users who specifically want per-agent GitHub filtering or per-agent avatars, the per-agent app model is available as an advanced configuration.

### When Per-Agent Apps Make Sense

- You want to filter GitHub notifications by specific agent
- You want distinct avatars for each agent
- You want per-agent git blame attribution
- You're comfortable managing N credentials and N app registrations

### How It Works

Each agent gets its own app: `{agent}-{user}-squad` (e.g., `flight-sabbour-squad`).

```bash
# Advanced: create per-agent identity
squad identity create --per-agent flight

# Advanced: create per-agent identities for all agents
squad identity create --per-agent --all
```

### Complexity Warnings

Per-agent apps inherit all the complexity the shared model avoids:

- **34-character name limit.** `{agent}-{user}-squad` works for short names but may exceed the limit. Repo-qualified names (`{agent}-{user}-{repo}-squad`) will almost certainly exceed it.
- **Cross-repo collisions.** If you clone a foreign repo whose agent names overlap yours, the CLI must fall back to repo-qualified naming with collision detection.
- **Credential management.** N agents = N private keys to manage, rotate, and share.
- **Bootstrap friction.** Each app requires a separate browser confirmation.
- **Registration scaling.** 15 agents = 15 of your 100 app quota. With cloned repos, this grows further.

**Recommendation:** Start with the shared model. Only switch to per-agent if you have a specific need for GitHub-native per-agent filtering and understand the trade-offs.

### Naming Scheme (Per-Agent Mode)

Per-agent mode uses a two-tier naming scheme:

**Tier 1 — Default:** `{agent}-{user}-squad` (e.g., `flight-sabbour-squad`)

**Tier 2 — Repo-qualified:** `{agent}-{user}-{repo}-squad` (used when Tier 1 name is already registered for a different project)

The CLI automatically detects collisions and falls back to Tier 2 with a warning:

```
⚠️ `flight-sabbour-squad` already exists for a different project.
   Registering as `flight-sabbour-coolproject-squad` instead.
```

---

## Phased Rollout

### Phase 1: Foundation (MVP)

**Goal:** All agents comment and commit under the shared bot identity.

- [ ] `squad identity create` CLI command (manifest flow, one app)
- [ ] Credential storage (`.squad/identity/apps/squad.json`, `.squad/identity/keys/squad.pem`)
- [ ] `SquadGitHubClient` with `commentAs()` method
- [ ] Comment attribution formatting (emoji + agent name + role)
- [ ] Commit message prefixing (`[AgentName] conventional commit message`)
- [ ] Commit authoring as `{user}-squad[bot]`
- [ ] `squad identity status` command
- [ ] Fallback to `gh` CLI when identity not configured
- [ ] `squad identity install <owner/repo>` for multi-repo

**Ships:** Next minor release. Estimated effort: 1-2 sprints (simpler than per-agent model).

### Phase 2: Full Operations

**Goal:** All GitHub operations route through the shared identity.

- [ ] PR creation/merge under shared identity
- [ ] Label management under shared identity
- [ ] Branch operations under shared identity
- [ ] `squad identity rotate` key rotation
- [ ] PR review submission with agent attribution in review body

**Ships:** Following minor release.

### Phase 3: CI/CD & Team Onboarding

**Goal:** Shared identity works in CI and across development teams.

- [ ] Environment variable credential override (`SQUAD_APP_ID`, `SQUAD_PRIVATE_KEY`, `SQUAD_INSTALLATION_ID`)
- [ ] GitHub Actions integration (one set of secrets per repo)
- [ ] `squad identity export` for CI secret setup
- [ ] Documentation for onboarding paths (key sharing, CI-only)
- [ ] Rate limit monitoring

**Ships:** After Phase 2 stabilizes.

### Phase 4: Advanced Identity

**Goal:** Per-agent apps for users who need them, plus rich identity features.

- [ ] `squad identity create --per-agent` command
- [ ] Per-agent credential storage and management
- [ ] Two-tier naming with collision detection
- [ ] Custom app avatar configuration
- [ ] Sub-identity migration path (if GitHub ships the feature)
- [ ] Identity analytics (which agent is most active, rate limit usage)

**Ships:** When there's user demand.

---

## Open Questions

1. **Avatar strategy.** The shared app gets one avatar. Should it be user-customizable, or should Squad provide a default? Since per-agent avatars require advanced mode, the shared avatar should represent "your squad" as a whole.

2. **Webhook events.** GitHub Apps can receive webhooks. Should the shared app listen for events (new issues, PR comments) to enable proactive agent behavior? This is a significant architecture expansion — out of scope for MVP but worth designing the extension point.

3. **Existing `gh-auth-isolation` skill.** Squad already has a skill for managing multiple GitHub identities via `gh auth`. The App-based approach serves a different purpose — `gh-auth-isolation` handles human multi-account; `squad identity` handles bot identity for agents. Both coexist.

4. ~~**Sub-identity timeline.**~~ **Resolved.** The shared app model IS effectively the "single app with attribution" approach. If GitHub later ships sub-identity support for Apps, it would enhance the shared model by giving per-agent display names within the single app — a natural upgrade, not a migration.

5. ~~**Repo-owner model as canonical recommendation?**~~ **Resolved.** With the shared app model, there is no per-agent naming collision problem. Each user has one app. The repo-owner model simplifies further: owner registers `{owner}-squad`, contributors use `gh` CLI fallback locally or bring their own `{contributor}-squad` app.

6. ~~**34-char name limit concerns?**~~ **Resolved.** `{user}-squad` is always short enough. The 34-char limit only affects per-agent advanced mode, where it's documented as a known trade-off.

---

## Alternative Approaches Considered

### Per-Agent Apps (Original Proposal — Demoted to Advanced Mode)

One GitHub App per agent: `{agent}-{user}-squad`. Gives distinct `[bot]` identity, avatar, and GitHub-native filtering per agent.

**Why it's not the default:** The 34-character name limit, cross-repo collision logic, N-credential management, N-browser-confirmation bootstrap, and 100-app scaling concerns create cascading complexity that outweighs the per-agent filtering benefit. Still available as advanced mode for users who want it.

### Machine Users (Rejected)

One GitHub account per agent. Full identity, full native GitHub API compatibility (assignment, review requests).

**Why not:** Each account consumes a paid seat. For a team of 10+ agents, that's $40+/month on GitHub Team or $210+/month on Enterprise. GitHub's own docs recommend Apps over machine users. And Squad doesn't need native assignment or review requests — its own label-based routing handles both.

### One App Per Agent Per Repo (Rejected)

Register a separate app for each agent × repo combination.

**Why not:** This model burns registrations on repos instead of using installations. With 15 agents and 7 repos, that's 105 registrations — already over the 100-app limit. The worst approach from a scaling perspective.

### Hybrid: Apps for Identity + User Account for Assignment (Not Needed)

Originally considered using the owner's account (via `gh` CLI) for assignment and review requests while Apps handle identity-visible operations.

**Updated assessment:** Squad's label-based routing already handles assignment and review dispatch. There's no need to mix in the owner's account for these operations.

---

## Decision

**Build the shared GitHub App model (`{user}-squad`), phased starting with MVP (comments + commits).** One app per user. Agent attribution in comment bodies and commit messages. Per-agent apps available as advanced mode for users who need GitHub-native per-agent filtering.

The abstraction layer (`SquadGitHubClient.commentAs()`) insulates agent code from the identity backend, so future changes (sub-identities, per-agent advanced mode, different providers) don't cascade. Agent code never constructs comments directly — it provides content and the client handles identity formatting.

Squad's label-based routing handles assignment and review dispatch. The shared app provides identity for visible operations. One registration, one key, one install per repo — the simplest model that achieves the core goal: **stop looking like you're talking to yourself on GitHub**.

---

*Flight out.*
