# EECOM

> Environmental, Electrical, and Consumables Manager

📌 **Archived:** History exceeds 15KB. Full history preserved in `history-archive.md`. Session log: 2026-04-10T18:35:28Z.

## Learnings

### Identity module — API design (2025-07-25)
- Storage functions (`loadIdentityConfig`, `saveAppRegistration`, etc.) are **sync** — identity is read at startup before async work. Uses `node:fs` sync APIs, not `node:fs/promises`.
- Storage functions take the **project root** (parent of `.squad/`), not the `.squad/` dir itself. They internally prepend `.squad/identity/`.
- `formatComment` takes a single `{ agentName, role, body }` object — emoji is derived internally from the role via `resolveRoleSlug`.
- `formatCommitMessage` takes `{ agentName, message }` object.
- SDK subpath exports (e.g., `@bradygaster/squad-sdk/identity`) require an entry in `packages/squad-sdk/package.json` `"exports"` map.

