# Flight — Project History

> Knowledge accumulated through leading Squad development.

📌 **Archived:** History exceeds 15KB. Full history preserved in `history-archive.md`. Session log: 2026-04-10T18:35:28Z.

📌 **Team update (2026-04-10T18:35:28Z):** GitHub Apps identity architecture decision merged to `decisions.md`. Draft PR #1 opened. User directive simplified scope: apps only need to act (comment, commit, open PRs) under their own identity. Assignment and review routing stay internal to Squad's label-based system. Phased rollout ready for implementation planning.

📌 **Proposal revision (2026-07-22):** Incorporated multiple rounds of feedback on `docs/proposals/agent-github-identity.md`. Key changes: (1) Reframed GitHub API gaps as non-issues — Squad's label-based routing is the *intended* assignment/review mechanism, not a workaround. (2) Adopted `{agent}-{user}-squad` naming convention with three-dimensional scoping: agent × user via registration (100 per account cap), repo via installation (unlimited). (3) Added scaling analysis showing the model comfortably supports realistic team sizes. (4) Added Developer Onboarding section covering three paths to agent identity (shared keys, self-registration, CI-only). (5) Rejected the per-agent-per-repo registration model and retired the hybrid approach. Pushed to `squad/agent-github-identity` branch.

📌 **Team update (2026-04-10T19:15:32Z):** Architecture proposal final version captured: three-tier identity model with per-role as default. User directives documented for cross-repo collisions, registration-as-installation model, and role-based app model. Avatar design system by INCO integrated. Proposal ready for final review and implementation. Commit af1671e4.
