# INCO

## Core Context

Terminal flicker fix cherry-picked from main to dev — PR #405 merged (March 2026).
> UX Engineer & Interaction Designer

## Learnings

### Animation Performance Trade-offs (PR #310)
Scroll flicker fix required careful animation frame budget management. Slowdown accepted as trade-off for visual clarity and stable viewport rendering. Version footer suggestion considered for animation frame transparency.

---

📌 **Team update (2026-03-10T14-44-23Z):** PR #310 scroll flicker fix merged. 4 root causes identified by Flight: Ink clearTerminal issue, timer amplification, log-update trailing newline, unstable Static keys. Postinstall patch pattern adopted for Ink internals. Version pin recommended for stability gate.

### Agent Avatar Design System (2026-03-28)
- **Dark background wins over transparent.** GitHub's `#0D1117` dark theme base gives consistent appearance on both light and dark themes. Transparent backgrounds risk invisible shapes on dark mode.
- **One accent color per role, shared background.** Cohesion comes from the consistent background + white accents; differentiation comes from a single role-specific accent color. Two accent colors per icon would reduce small-size legibility.
- **Geometric motifs > literal objects.** A compass rose beats a literal blueprint for "architect." Abstract shapes scale down better and avoid clip-art connotations.
- **40px is the real design target.** GitHub comment avatars are tiny. Every shape decision was validated against "would this be recognizable as a colored blob at 40px?" If not, simplify.
- **Color choices carry semantic weight.** Terminal green for backend, red for security, violet for testing — these aren't arbitrary. They map to existing developer mental models (terminal, alerts, labs).

