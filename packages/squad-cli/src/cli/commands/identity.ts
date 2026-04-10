/**
 * squad identity — manage agent GitHub App identity.
 *
 * Usage:
 *   squad identity status   — show identity configuration and app registration status
 *   squad identity create   — (stub) instructions for creating GitHub App identities
 *
 * @module cli/commands/identity
 */

import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import {
  loadIdentityConfig,
  loadAppRegistration,
  hasPrivateKey,
} from '@bradygaster/squad-sdk';
import { BOLD, RESET, GREEN, DIM, RED, YELLOW } from '../core/output.js';

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

function runCreate(): void {
  console.log(`\n${BOLD}squad identity create${RESET} — GitHub App identity setup\n`);
  console.log(`  This feature is under development. To set up identity manually:\n`);
  console.log(`  1. Create a GitHub App at ${DIM}https://github.com/settings/apps/new${RESET}`);
  console.log(`  2. Install the app on your repository`);
  console.log(`  3. Save the app credentials to ${BOLD}.squad/identity/${RESET}:`);
  console.log(`     ${DIM}config.json${RESET}     — identity tier and app mapping`);
  console.log(`     ${DIM}apps/{key}.json${RESET} — app registration (appId, installationId)`);
  console.log(`     ${DIM}keys/{key}.pem${RESET}  — private key file`);
  console.log(`\n  ${YELLOW}⚠️${RESET}  Add ${BOLD}.squad/identity/keys/${RESET} to .gitignore — never commit private keys.\n`);
}

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
    runCreate();
    return;
  }

  // No subcommand — show usage
  console.log(`\n${BOLD}squad identity${RESET} — manage agent GitHub App identity\n`);
  console.log(`  ${BOLD}squad identity status${RESET}   — show identity configuration`);
  console.log(`  ${BOLD}squad identity create${RESET}   — setup instructions\n`);
}
