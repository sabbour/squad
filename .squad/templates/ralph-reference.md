# Ralph Reference — Work Monitor Lifecycle

## Ralph's Work-Check Cycle

Ralph runs the same cycle at every wake-up (in-session, watch mode, or heartbeat):

1. **Scan** — Read GitHub: list issues with `squad` label, list all PRs
2. **Categorize** — Assign each item to a board category (untriaged, assigned, inProgress, needsReview, changesRequested, ciFailure, readyToMerge, done)
3. **Dispatch** — For untriaged items, read `.squad/routing.md` and triage using: module path match → routing rule keywords → role keywords → Lead fallback. Assign `squad:{member}` label and spawn agent if not already assigned
4. **Watch** — For in-flight items (assigned, inProgress, needsReview), check for state changes (PR created, review feedback, CI status, approval)
5. **Report** — Log results to the user (items moved, agents spawned, board state)
6. **Board Clear Check** — If all items are done/merged, report status and continue monitoring
7. **Loop** — Go back to step 1 (whether or not work remains)

## Board Format

Ralph tracks work items in these states:

```
Board State → Ralph Action
──────────────────────────
untriaged    → Triage using routing.md, assign agent
assigned     → Wait for agent to start, or spawn if stalled
inProgress   → Check for PR creation, review feedback
needsReview  → Wait for approval or request changes
ciFailure    → Notify agent, wait for fix
readyToMerge → Merge PR, close issue
done         → Remove from board
```

**Issue labels used:**
- `squad` — Issue is in squad backlog
- `squad:{member}` — Assigned to specific agent

**PR API fields used for state tracking (not labels):**
- `reviewDecision` — `CHANGES_REQUESTED` or `APPROVED`
- `statusCheckRollup` — check states like `FAILURE`, `ERROR`, or `PENDING`

## Continuous Monitoring Mode

When the board is clear (all work done/merged), Ralph does NOT stop. Ralph continues monitoring:
- In-session Ralph waits the configured poll interval, then scans again for new work
- Watch mode Ralph continues polling at the configured interval
- Heartbeat Ralph waits for next event trigger (cron permanently disabled)

New work can arrive at any time (humans creating issues, external automation, CI events). Ralph catches it on the next scan cycle.

Ralph only stops when:
- User explicitly says "Ralph, idle" or "stop"
- The Copilot CLI session ends
- The watch process is terminated (Ctrl+C)
- Manual activation via "Ralph, go" or `squad watch` restarts monitoring

## Activation Triggers

**Text-based (in Copilot Chat):**
- `Ralph, go` → Start active loop
- `Ralph, status` → Check board once, report results
- `Ralph, idle` → Stop active loop

**CLI-based:**
- `squad watch --interval 10` → Start persistent polling
- Ctrl+C → Stop watch mode

**Event-based (Heartbeat):**
- Issue closed/labeled → Check GitHub
- PR opened/merged → Check GitHub
- Manual dispatch → Check GitHub

## Work-Check Termination

Ralph stops checking when:
1. User says "Ralph, idle" or "stop"
2. Session ends (in-session layer only)
3. Process killed (watch mode)

**A clear board does NOT stop Ralph.** Ralph continues monitoring for new work.

## Prioritization vs. Stopping

Ralph MAY use milestones, labels, and priorities to decide **processing order** — which issues to work on first. This is encouraged for delivery efficiency.

Ralph MUST NOT use milestones, waves, sprints, phases, or any other grouping as a **stopping boundary**. Specifically:
- **DO** process higher-priority milestone issues before lower-priority ones.
- **DO NOT** stop after completing one milestone's issues. Continue to the next.
- **DO NOT** invent sub-groupings like "wave 1 of milestone X" and stop between them.
- **DO NOT** declare a "session milestone" complete and pause for user input.
- **DO NOT** skip issues because they belong to a different milestone than the one currently being worked on.

Ralph's only stopping conditions are listed in Work-Check Termination above. Everything else — including milestone completion — is NOT a reason to stop.
