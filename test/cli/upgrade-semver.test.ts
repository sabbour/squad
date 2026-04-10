/**
 * Unit tests for the upgrade module semver helpers and pluggable API.
 *
 * These tests cover the pure functions (parseVersion, compareVersions, isNewer)
 * and the pluggable upgrade workflows (checkForUpdate, performUpgrade, upgradeSDK).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseVersion,
  compareVersions,
  isNewer,
  checkForUpdate,
  performUpgrade,
  upgradeSDK,
  setVersionFetcher,
  setPackageJsonReader,
  setPackageJsonWriter,
} from '@bradygaster/squad-cli/upgrade';

// ============================================================================
// parseVersion
// ============================================================================

describe('parseVersion', () => {
  it('parses a simple semver string', () => {
    const v = parseVersion('1.2.3');
    expect(v.major).toBe(1);
    expect(v.minor).toBe(2);
    expect(v.patch).toBe(3);
    expect(v.prerelease).toBe('');
    expect(v.raw).toBe('1.2.3');
  });

  it('parses a version with prerelease suffix', () => {
    const v = parseVersion('0.9.1-alpha.0');
    expect(v.major).toBe(0);
    expect(v.minor).toBe(9);
    expect(v.patch).toBe(1);
    expect(v.prerelease).toBe('alpha.0');
    expect(v.raw).toBe('0.9.1-alpha.0');
  });

  it('parses zero version', () => {
    const v = parseVersion('0.0.0');
    expect(v.major).toBe(0);
    expect(v.minor).toBe(0);
    expect(v.patch).toBe(0);
  });

  it('throws on invalid version string', () => {
    expect(() => parseVersion('not-a-version')).toThrow('Invalid version');
    expect(() => parseVersion('1.2')).toThrow('Invalid version');
    expect(() => parseVersion('')).toThrow('Invalid version');
  });
});

// ============================================================================
// compareVersions
// ============================================================================

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.9.1', '0.9.1')).toBe(0);
  });

  it('compares major versions', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('compares minor versions', () => {
    expect(compareVersions('1.2.0', '1.1.0')).toBeGreaterThan(0);
    expect(compareVersions('1.1.0', '1.2.0')).toBeLessThan(0);
  });

  it('compares patch versions', () => {
    expect(compareVersions('1.0.2', '1.0.1')).toBeGreaterThan(0);
    expect(compareVersions('1.0.1', '1.0.2')).toBeLessThan(0);
  });

  it('release > prerelease for same base version', () => {
    expect(compareVersions('1.0.0', '1.0.0-alpha')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-alpha', '1.0.0')).toBeLessThan(0);
  });

  it('compares prerelease strings lexicographically', () => {
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
    expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-alpha.0', '1.0.0-alpha.0')).toBe(0);
  });
});

// ============================================================================
// isNewer
// ============================================================================

describe('isNewer', () => {
  it('returns true when candidate is newer', () => {
    expect(isNewer('1.0.0', '1.0.1')).toBe(true);
    expect(isNewer('0.9.0', '1.0.0')).toBe(true);
  });

  it('returns false when candidate is same version', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns false when candidate is older', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(false);
    expect(isNewer('2.0.0', '1.9.9')).toBe(false);
  });

  it('release is newer than prerelease of the same base', () => {
    expect(isNewer('1.0.0-alpha', '1.0.0')).toBe(true);
    expect(isNewer('1.0.0', '1.0.0-alpha')).toBe(false);
  });
});

// ============================================================================
// checkForUpdate (with pluggable version fetcher)
// ============================================================================

describe('checkForUpdate', () => {
  beforeEach(() => {
    setVersionFetcher(async () => '2.0.0');
  });

  it('returns UpdateInfo when a newer version is available', async () => {
    const result = await checkForUpdate('1.0.0');
    expect(result).not.toBeNull();
    expect(result!.newVersion).toBe('2.0.0');
    expect(result!.releaseUrl).toContain('v2.0.0');
    expect(result!.changelog).toContain('1.0.0');
    expect(result!.changelog).toContain('2.0.0');
  });

  it('returns null when already on latest', async () => {
    setVersionFetcher(async () => '1.0.0');
    const result = await checkForUpdate('1.0.0');
    expect(result).toBeNull();
  });

  it('returns null when current is newer than latest', async () => {
    setVersionFetcher(async () => '0.5.0');
    const result = await checkForUpdate('1.0.0');
    expect(result).toBeNull();
  });
});

// ============================================================================
// performUpgrade
// ============================================================================

describe('performUpgrade', () => {
  it('succeeds when there is a newer version', async () => {
    const info = { newVersion: '2.0.0', releaseUrl: 'https://example.com', changelog: 'changes' };
    const result = await performUpgrade(info, '1.0.0');
    expect(result.success).toBe(true);
    expect(result.fromVersion).toBe('1.0.0');
    expect(result.toVersion).toBe('2.0.0');
  });

  it('returns dry-run result when dryRun is true', async () => {
    const info = { newVersion: '2.0.0', releaseUrl: 'https://example.com', changelog: 'changes' };
    const result = await performUpgrade(info, '1.0.0', { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.changes[0]).toContain('[dry-run]');
  });

  it('fails when not forced and already on latest', async () => {
    const info = { newVersion: '1.0.0', releaseUrl: 'https://example.com', changelog: 'changes' };
    const result = await performUpgrade(info, '1.0.0');
    expect(result.success).toBe(false);
    expect(result.changes[0]).toContain('Already on latest');
  });

  it('succeeds when forced even if already on latest', async () => {
    const info = { newVersion: '1.0.0', releaseUrl: 'https://example.com', changelog: 'changes' };
    const result = await performUpgrade(info, '1.0.0', { force: true });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// upgradeSDK (with pluggable reader/writer/fetcher)
// ============================================================================

describe('upgradeSDK', () => {
  let writtenVersion: string | null;

  beforeEach(() => {
    writtenVersion = null;
    setVersionFetcher(async () => '2.0.0');
    setPackageJsonReader(async () => ({
      version: '1.0.0',
      dependencies: { '@bradygaster/squad': '^1.0.0' },
    }));
    setPackageJsonWriter(async (_dir, version) => {
      writtenVersion = version;
    });
  });

  it('upgrades SDK when newer version is available', async () => {
    const result = await upgradeSDK('/fake/project');
    expect(result.success).toBe(true);
    expect(result.fromVersion).toBe('1.0.0');
    expect(result.toVersion).toBe('2.0.0');
    expect(writtenVersion).toBe('2.0.0');
  });

  it('returns already on latest when no upgrade needed', async () => {
    setVersionFetcher(async () => '1.0.0');
    const result = await upgradeSDK('/fake/project');
    expect(result.success).toBe(true);
    expect(result.changes[0]).toContain('already on latest');
  });

  it('reports when SDK package is not found in dependencies', async () => {
    setPackageJsonReader(async () => ({
      version: '1.0.0',
      dependencies: {},
    }));
    const result = await upgradeSDK('/fake/project');
    expect(result.success).toBe(false);
    expect(result.changes[0]).toContain('not found');
  });

  it('handles dry-run mode', async () => {
    const result = await upgradeSDK('/fake/project', { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.changes[0]).toContain('[dry-run]');
    expect(writtenVersion).toBeNull(); // Nothing written
  });

  it('strips ^ prefix from current version before comparison', async () => {
    setPackageJsonReader(async () => ({
      version: '1.0.0',
      dependencies: { '@bradygaster/squad': '^1.9.0' },
    }));
    const result = await upgradeSDK('/fake/project');
    expect(result.success).toBe(true);
    expect(result.fromVersion).toBe('1.9.0');
  });
});
