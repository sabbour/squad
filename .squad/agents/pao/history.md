# PAO

> Public Affairs Officer — Documentation, Communications, Brand Voice

📌 **Archived:** History exceeds 15KB. Full history preserved in `history-archive.md`. Session log: 2026-04-10T18:35:28Z.

## Learnings

- **Implementation docs supersede proposals.** When a feature ships, the proposal doc should be treated as a template to update, not an archive. Key facts: JWT exp 9min (not 10), `create` idempotent, `fix` removed in favor of `update`, spawn integration via GIT IDENTITY block.
- **Graceful fallback is underrated.** Identity is a UX enhancement, not a blocker. Default git auth fallback means identity failures never stop agent work — this resilience is worth mentioning prominently.
- **CLI design teaches toward capability.** The actual commands (`status`, `create`, `update`, `rotate`, `export`) are simpler and more discoverable than the proposal's tier-specific variants. Removing `fix` in favor of idempotent `create` + `update` cut cognitive load in half.
