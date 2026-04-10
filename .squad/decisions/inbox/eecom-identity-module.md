# Decision: Identity storage functions are sync

**By:** EECOM
**Date:** 2025-07-25
**Context:** Identity module Phase 1 MVP

## Decision
Identity storage functions (`loadIdentityConfig`, `saveIdentityConfig`, `loadAppRegistration`, `saveAppRegistration`, `hasPrivateKey`) are synchronous using `node:fs` sync APIs.

## Rationale
Identity config is read during CLI startup to resolve which GitHub App credentials to use. This happens before any async work begins. Sync reads keep the startup path simple and avoid unnecessary async ceremony for small JSON files.

## Implications
- Storage functions take the **project root** path (parent of `.squad/`), not the `.squad/` dir
- If identity resolution ever needs to go async (e.g., remote key vaults), these will need an async wrapper — but that's a Phase 2 concern
