/**
 * squad identity — manage agent GitHub App identity.
 *
 * Usage:
 *   squad identity status                — show identity configuration and app registration status
 *   squad identity create --role lead    — create a GitHub App for a single role
 *   squad identity create --all          — create GitHub Apps for all 8 roles
 *   squad identity create --simple       — create a single shared GitHub App
 *
 * The create flow uses the GitHub App Manifest flow:
 *   1. Generate a manifest JSON describing the app
 *   2. Start a local HTTP server to catch the redirect callback
 *   3. Open the browser to GitHub's app creation page
 *   4. Wait for the redirect with the `code` parameter
 *   5. Exchange the code for app credentials
 *   6. Save credentials to `.squad/identity/`
 *
 * @module cli/commands/identity
 */

import { join } from 'node:path';
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { exec, execSync } from 'node:child_process';
import { platform } from 'node:os';
import {
  loadIdentityConfig,
  saveIdentityConfig,
  loadAppRegistration,
  saveAppRegistration,
  hasPrivateKey,
} from '@bradygaster/squad-sdk';
import type { IdentityConfig, IdentityTier, RoleSlug } from '@bradygaster/squad-sdk';
import { BOLD, RESET, GREEN, DIM, RED, YELLOW } from '../core/output.js';

/** All canonical role slugs. */
const ALL_ROLES: readonly RoleSlug[] = [
  'lead', 'frontend', 'backend', 'tester', 'devops', 'docs', 'security', 'data',
];

/** Default permissions for squad GitHub Apps. */
const DEFAULT_PERMISSIONS = {
  issues: 'write',
  pull_requests: 'write',
  contents: 'write',
  metadata: 'read',
  statuses: 'write',
} as const;

/** Human-readable descriptions per role for the GitHub App profile. */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  lead: 'Squad AI team lead — architecture decisions, code review, and project coordination.',
  frontend: 'Squad AI frontend developer — UI components, styling, and client-side logic.',
  backend: 'Squad AI backend developer — APIs, services, data access, and server-side logic.',
  tester: 'Squad AI tester — test strategy, test cases, quality assurance, and edge cases.',
  devops: 'Squad AI DevOps engineer — CI/CD, infrastructure, deployment, and automation.',
  docs: 'Squad AI documentation writer — technical docs, API references, and guides.',
  security: 'Squad AI security engineer — threat modeling, audits, and secure coding.',
  data: 'Squad AI data engineer — databases, analytics, data pipelines, and modeling.',
  shared: 'Squad AI team — shared identity for all AI team member interactions.',
};

// ============================================================================
// Helpers
// ============================================================================

function resolveSquadDir(cwd: string): string | null {
  let dir = cwd;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, '.squad');
    if (existsSync(candidate)) {
      return dir;
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function listAgents(projectRoot: string): string[] {
  const agentsDir = join(projectRoot, '.squad', 'agents');
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

/**
 * Get the GitHub username via `gh api user`.
 * Falls back to 'squad-user' if gh CLI is not available.
 */
async function getGitHubUsername(): Promise<string> {
  return new Promise((resolve) => {
    exec('gh api user --jq .login', { timeout: 10_000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve('squad-user');
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Open a URL in the default browser (cross-platform).
 * Falls back to printing the URL if opening fails.
 */
function openBrowser(url: string): void {
  const os = platform();
  let cmd: string;
  if (os === 'darwin') {
    cmd = `open "${url}"`;
  } else if (os === 'win32') {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, (err) => {
    if (err) {
      console.log(`\n  ${YELLOW}⚠️${RESET}  Could not open browser automatically.`);
      console.log(`  Open this URL manually:\n  ${DIM}${url}${RESET}\n`);
    }
  });
}

/**
 * Build the GitHub App manifest JSON for the manifest flow.
 */
function buildManifest(
  appName: string,
  username: string,
  callbackUrl: string,
  roleSlug?: string,
): object {
  const description = ROLE_DESCRIPTIONS[roleSlug ?? 'shared']
    ?? ROLE_DESCRIPTIONS.shared;

  return {
    name: appName,
    url: `https://github.com/${username}`,
    description,
    hook_attributes: { url: `https://example.com/no-op`, active: false },
    redirect_url: callbackUrl,
    public: false,
    default_permissions: DEFAULT_PERMISSIONS,
    default_events: [],
  };
}

/**
 * Start a local HTTP server, serve the manifest form page, and wait for
 * the GitHub redirect with the `code` parameter.
 *
 * Returns the code from the callback.
 */
async function waitForManifestCode(
  manifestTemplate: object,
): Promise<{ code: string; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost`);

      // Serve the auto-submitting form page at /
      if (url.pathname === '/' && !url.searchParams.has('code')) {
        // Now we know the port — patch the manifest with the real callback URL
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        const realCallbackUrl = `http://localhost:${port}`;
        const manifest = { ...manifestTemplate, redirect_url: realCallbackUrl };
        const manifestJson = JSON.stringify(manifest);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html><head><title>Squad — GitHub App Setup</title></head>
<body>
  <h2>Creating GitHub App...</h2>
  <p>If the form doesn't submit automatically, click the button below.</p>
  <form id="manifest-form" action="https://github.com/settings/apps/new" method="post">
    <input type="hidden" name="manifest" value='${manifestJson.replace(/'/g, '&#39;')}'>
    <button type="submit">Create GitHub App</button>
  </form>
  <script>document.getElementById('manifest-form').submit();</script>
</body></html>`);
        return;
      }

      // Handle the callback with the code
      const code = url.searchParams.get('code');
      if (code) {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html><head><title>Squad — Success</title></head>
<body>
  <h2>✅ GitHub App created!</h2>
  <p>You can close this tab and return to the terminal.</p>
</body></html>`);
        server.close();
        resolve({ code, port });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to start local server'));
        return;
      }
      const port = addr.port;
      const localUrl = `http://localhost:${port}`;
      console.log(`\n  ${DIM}Local callback server listening on ${localUrl}${RESET}`);
      openBrowser(localUrl);
      console.log(`  Waiting for GitHub App creation...\n`);
    });

    server.on('error', reject);

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for GitHub App creation (5 min)'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Exchange the manifest code for app credentials via GitHub API.
 * Uses `gh api` CLI (reliable in WSL) with fetch as fallback.
 */
async function exchangeManifestCode(code: string): Promise<{
  id: number;
  slug: string;
  pem: string;
  webhook_secret: string;
  client_id: string;
  client_secret: string;
}> {
  // Try gh CLI first — it handles auth, proxies, and DNS reliably
  try {
    const result = execSync(
      `gh api -X POST "app-manifests/${code}/conversions"`,
      { encoding: 'utf-8', timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const data = JSON.parse(result);
    return data;
  } catch {
    // gh CLI failed — fall back to fetch
  }

  const url = `https://api.github.com/app-manifests/${code}/conversions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    id: number;
    slug: string;
    pem: string;
    webhook_secret: string;
    client_id: string;
    client_secret: string;
  };

  return data;
}

/**
 * Get the installation ID for a newly created app.
 * Uses fetch with JWT auth, falling back to curl for WSL compatibility.
 */
async function getAppInstallationId(jwt: string): Promise<number | null> {
  // Try fetch first
  try {
    const response = await fetch('https://api.github.com/app/installations', {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) return null;

    const installations = (await response.json()) as Array<{ id: number }>;
    return installations[0]?.id ?? null;
  } catch {
    // fetch failed (WSL DNS issue) — fall back to curl
  }

  try {
    const result = execSync(
      `curl -sf -H "Authorization: Bearer ${jwt}" -H "Accept: application/vnd.github+json" https://api.github.com/app/installations`,
      { encoding: 'utf-8', timeout: 15_000, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const installations = JSON.parse(result) as Array<{ id: number }>;
    return installations[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Simple delay helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll for an app installation ID, retrying every `intervalMs` for up to
 * `timeoutMs`. Returns the installation ID if found, or null on timeout.
 */
async function pollForInstallation(
  jwt: string,
  intervalMs: number,
  timeoutMs: number,
): Promise<number | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const id = await getAppInstallationId(jwt);
    if (id) return id;
    await sleep(intervalMs);
  }
  return null;
}

/**
 * Save credentials from the manifest flow to the identity directory.
 */
function saveCredentials(
  projectRoot: string,
  key: string,
  appData: { id: number; slug: string; pem: string },
  installationId: number,
  tier: IdentityTier,
  roleSlug?: RoleSlug,
): void {
  // Save PEM key
  const keysDir = join(projectRoot, '.squad', 'identity', 'keys');
  mkdirSync(keysDir, { recursive: true });
  writeFileSync(join(keysDir, `${key}.pem`), appData.pem, 'utf-8');

  // Save app registration
  saveAppRegistration(projectRoot, key, {
    appId: appData.id,
    appSlug: appData.slug,
    installationId,
    roleSlug,
    tier,
  });

  // Update config
  const config = loadIdentityConfig(projectRoot) ?? { tier, apps: {} };
  config.tier = tier;
  if (!config.apps) config.apps = {};
  config.apps[key] = {
    appId: appData.id,
    appSlug: appData.slug,
    installationId,
    roleSlug,
    tier,
  };
  saveIdentityConfig(projectRoot, config);
}

// ============================================================================
// Subcommands
// ============================================================================

function runStatus(projectRoot: string): void {
  const config = loadIdentityConfig(projectRoot);

  if (!config) {
    console.log(`\n${YELLOW}⚠️${RESET}  No identity configuration found.`);
    console.log(`   Run ${BOLD}squad identity create${RESET} for setup instructions.\n`);
    return;
  }

  console.log(`\n${BOLD}Identity configuration:${RESET}`);
  console.log(`  Tier: ${BOLD}${config.tier}${RESET}`);

  const appKeys = Object.keys(config.apps ?? {});
  if (appKeys.length === 0) {
    console.log(`\n  ${DIM}No app registrations configured.${RESET}\n`);
    return;
  }

  console.log(`\n  App registrations:`);

  for (const key of appKeys) {
    const reg = loadAppRegistration(projectRoot, key);
    const keyExists = hasPrivateKey(projectRoot, key);

    if (reg) {
      const keyStatus = keyExists
        ? `${GREEN}✓ key${RESET}`
        : `${RED}✗ no key${RESET}`;
      console.log(
        `    ${BOLD}${key}${RESET}  ${DIM}→${RESET}  ${reg.appSlug} (app ${reg.appId})  ${keyStatus}`,
      );
    } else {
      console.log(
        `    ${BOLD}${key}${RESET}  ${DIM}→${RESET}  ${RED}missing registration file${RESET}`,
      );
    }
  }

  // Show agent mapping summary
  const agents = listAgents(projectRoot);
  if (agents.length > 0 && config.tier !== 'shared') {
    console.log(`\n  ${DIM}Agents: ${agents.join(', ')}${RESET}`);
  }

  console.log();
}

/**
 * Create a GitHub App for a single role (or 'shared') using the manifest flow.
 */
async function createAppForRole(
  projectRoot: string,
  key: string,
  username: string,
  tier: IdentityTier,
  roleSlug?: RoleSlug,
): Promise<boolean> {
  const appName = tier === 'shared'
    ? `${username}-squad`
    : `${username}-squad-${key}`;

  console.log(`\n${BOLD}Creating GitHub App: ${appName}${RESET}`);

  // Build manifest — port is determined when server starts, so use placeholder
  // that gets replaced once we know the port
  const callbackPlaceholder = 'http://localhost:0';
  const manifest = buildManifest(appName, username, callbackPlaceholder, roleSlug ?? (tier === 'shared' ? 'shared' : undefined));

  try {
    // Wait for the code from the manifest flow
    const { code } = await waitForManifestCode(manifest);

    console.log(`  ${DIM}Received code, exchanging for credentials...${RESET}`);

    // Exchange code for app credentials
    const appData = await exchangeManifestCode(code);

    // Generate a JWT to fetch installations
    const { generateAppJWT } = await import('@bradygaster/squad-sdk');
    const jwt = await generateAppJWT(appData.id, appData.pem);

    // Get installation ID (user needs to install the app first)
    let installationId = await getAppInstallationId(jwt);

    if (!installationId) {
      // Auto-open browser to the app installation page
      const installUrl = `https://github.com/apps/${appData.slug}/installations/select_target`;
      console.log(`\n  ${BOLD}Installing app on your repository...${RESET} (confirm in browser)`);
      openBrowser(installUrl);

      // Poll for the installation to appear (every 2s, up to 60s)
      installationId = await pollForInstallation(jwt, 2_000, 60_000);

      if (!installationId) {
        console.log(`\n  ${YELLOW}⚠️${RESET}  No installation detected after 60 seconds.`);
        console.log(`  You can install the app manually at:`);
        console.log(`  ${DIM}${installUrl}${RESET}`);
        console.log(`  Then run ${BOLD}squad identity status${RESET} to verify.\n`);
        // Save with installationId 0 — user will need to update after installing
        installationId = 0;
      } else {
        console.log(`  ${GREEN}✓${RESET} App installed — installation ID ${installationId}`);
      }
    }

    // Save credentials
    saveCredentials(projectRoot, key, appData, installationId, tier, roleSlug);

    console.log(`${GREEN}✅${RESET} Created ${BOLD}${appName}${RESET} — app ID ${appData.id}`);

    // Avatar upload instructions (GitHub API doesn't support programmatic logo upload)
    const avatarSlug = roleSlug ?? 'lead';
    const avatarFile = `docs/proposals/avatars/${avatarSlug}.png`;
    const appSettingsUrl = `https://github.com/settings/apps/${appData.slug}`;
    console.log(`\n  ${DIM}📷 To set the avatar, go to:${RESET}`);
    console.log(`  ${DIM}${appSettingsUrl}${RESET}`);
    console.log(`  ${DIM}Upload ${BOLD}${avatarFile}${RESET}${DIM} under "Display information → Logo"${RESET}\n`);

    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`${RED}✗${RESET} Failed to create ${appName}: ${msg}`);
    return false;
  }
}

async function runCreate(projectRoot: string, args: string[]): Promise<void> {
  // Parse flags
  const isAll = args.includes('--all');
  const isSimple = args.includes('--simple');
  const roleIndex = args.indexOf('--role');
  const roleArg = roleIndex >= 0 ? args[roleIndex + 1] : undefined;

  // Validate mutually exclusive flags
  const flagCount = [isAll, isSimple, !!roleArg].filter(Boolean).length;
  if (flagCount > 1) {
    console.error(`${RED}✗${RESET} Use only one of: --role <role>, --all, --simple`);
    process.exit(1);
  }

  if (flagCount === 0) {
    console.log(`\n${BOLD}squad identity create${RESET} — create GitHub App identities\n`);
    console.log(`  ${BOLD}--role <role>${RESET}  Create app for a single role (${ALL_ROLES.join(', ')})`);
    console.log(`  ${BOLD}--all${RESET}          Create apps for all ${ALL_ROLES.length} roles`);
    console.log(`  ${BOLD}--simple${RESET}       Create a single shared app\n`);
    console.log(`  Example: ${DIM}squad identity create --role lead${RESET}\n`);
    return;
  }

  const username = await getGitHubUsername();
  console.log(`  GitHub user: ${BOLD}${username}${RESET}`);

  if (isSimple) {
    // Single shared app
    await createAppForRole(projectRoot, 'shared', username, 'shared');
    return;
  }

  if (roleArg) {
    // Validate role
    if (!ALL_ROLES.includes(roleArg as RoleSlug)) {
      console.error(`${RED}✗${RESET} Unknown role: ${roleArg}`);
      console.error(`  Valid roles: ${ALL_ROLES.join(', ')}`);
      process.exit(1);
    }
    await createAppForRole(projectRoot, roleArg, username, 'per-role', roleArg as RoleSlug);
    return;
  }

  if (isAll) {
    // Create apps for all roles sequentially
    console.log(`\n  Creating apps for all ${ALL_ROLES.length} roles...`);
    let successCount = 0;
    for (const role of ALL_ROLES) {
      const ok = await createAppForRole(projectRoot, role, username, 'per-role', role);
      if (ok) successCount++;
    }
    console.log(`\n${GREEN}✅${RESET} Created ${successCount}/${ALL_ROLES.length} apps.\n`);
  }
}

// ============================================================================
// Entry point
// ============================================================================

export async function runIdentity(cwd: string, subArgs: string[]): Promise<void> {
  const sub = subArgs[0]?.toLowerCase();

  if (sub === 'status') {
    const projectRoot = resolveSquadDir(cwd);
    if (!projectRoot) {
      console.error(`${RED}✗${RESET} No squad found. Run "squad init" first.`);
      process.exit(1);
    }
    runStatus(projectRoot);
    return;
  }

  if (sub === 'create') {
    const projectRoot = resolveSquadDir(cwd);
    if (!projectRoot) {
      console.error(`${RED}✗${RESET} No squad found. Run "squad init" first.`);
      process.exit(1);
    }
    await runCreate(projectRoot, subArgs.slice(1));
    return;
  }

  // No subcommand — show usage
  console.log(`\n${BOLD}squad identity${RESET} — manage agent GitHub App identity\n`);
  console.log(`  ${BOLD}squad identity status${RESET}             — show identity configuration`);
  console.log(`  ${BOLD}squad identity create --role lead${RESET} — create app for a role`);
  console.log(`  ${BOLD}squad identity create --all${RESET}       — create apps for all roles`);
  console.log(`  ${BOLD}squad identity create --simple${RESET}    — create single shared app\n`);
}
