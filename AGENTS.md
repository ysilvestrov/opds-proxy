# Project instructions

## Specification first

- Read root `spec.md` before designing, implementing, testing or reviewing changes.
- `spec.md` is the single normative source of truth. Plans, audit reports and chat
  history provide context/evidence, not competing specifications.
- Check every project decision against relevant requirement IDs and scenarios.
- Update `spec.md` whenever architecture, behavior, API, config defaults,
  deployment or project invariants change; align code, tests and plans in the
  same PR/change set. Do not silently redefine requirements from observed code.
- Identify requirement IDs in PR descriptions/reviews; explain satisfaction
  when the specification itself does not need changing.
- Preserve requirement IDs. New evidence may revise scenarios and decisions;
  record the reason and distinguish evidence from an assumption.
- Keep OpenSpec requirement/scenario Markdown in root `spec.md`; do not create
  a second normative spec copy. CLI installation is not required for authoring.

## Current scope and workflow

- Implement private Searchfloor OPDS beside the existing bot on the current
  Hetzner host. Moving both to a new VPS belongs to a separate project.
- Never use/change bot DB, secrets, release tree, locks, state or unit for OPDS.
- Read the reviewed implementation plan under `docs/superpowers/plans/` and
  source/reader evidence before the corresponding task.
- No application code before the written specification and implementation
  plan review required by the agreed Superpowers process.
- Prepare concrete bootstrap files before operator installation; no claim
  that prepared code means installed infrastructure.
- Tests use fixtures/local mocks. Live probes are bounded; no mass crawl,
  challenge bypass or downloaded books/secrets committed to the repository.
- Report actual validation results and remaining source/reader/operator steps.
