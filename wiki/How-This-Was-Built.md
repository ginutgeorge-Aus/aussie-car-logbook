# How This Was Built

**Ginoo's Log Book is a 100% AI-coded project.**

Every part of it — the app code, the tax engine, the tests, the deployment
setup, and this wiki — was written by **[Claude](https://claude.com/claude-code)**
(Anthropic's Claude Code). A human acted only as **product owner**: deciding
what to build, reviewing the work, and approving it. No human hand-wrote the
implementation.

## The "vibecoded" way

It was built with a simple, repeatable loop:

1. **Brainstorm** — talk through what the feature should do.
2. **Plan** — Claude writes an implementation plan.
3. **Test-first** — write the tests, then the code to pass them (the tax
   engine is fully unit-tested).
4. **Review** — every change goes through a pull request with automated checks
   (build, tests, security scans).
5. **Deploy** — merge, and it ships.

The tax math (`src/lib/tax/`) is pure, tested functions — the part that most
needs to be *correct* — so the numbers can be checked, not just trusted.

## ⚠️ What this means for you

This is exciting **and** a reason for care:

- It's **early and experimental**. Not everything is polished or edge-case
  proof.
- **Always double-check the figures** before you lodge anything with the ATO.
- Treat the reports as a **starting point**, and confirm with a **registered
  tax agent**. This is **not tax advice**.
- Found a bug or a wrong number? Please report it — scrutiny makes it better:
  [open an issue](https://github.com/ginutgeorge-Aus/aussie-car-logbook/issues).

## Why do it this way?

To see how far a careful, test-driven, human-reviewed AI workflow can go on a
real, useful tool — built in the open so anyone can inspect exactly how it
works. The whole history is on
[GitHub](https://github.com/ginutgeorge-Aus/aussie-car-logbook).
