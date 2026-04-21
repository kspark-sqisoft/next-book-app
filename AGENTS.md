<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# Everything Claude Code (ECC) — Agent Instructions

This is a **production-ready AI coding plugin** providing 48 specialized agents, 183 skills, 79 commands, and automated hook workflows for software development.

**Version:** 1.10.0

## Core Principles

1. **Agent-First** — Delegate to specialized agents for domain tasks
2. **Test-Driven** — Write tests before implementation, 80%+ coverage required
3. **Security-First** — Never compromise on security; validate all inputs
4. **Immutability** — Always create new objects, never mutate existing ones
5. **Plan Before Execute** — Plan complex features before writing code

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Implementation planning | Complex features, refactoring |
| architect | System design and scalability | Architectural decisions |
| tdd-guide | Test-driven development | New features, bug fixes |
| code-reviewer | Code quality and maintainability | After writing/modifying code |
| security-reviewer | Vulnerability detection | Before commits, sensitive code |
| build-error-resolver | Fix build/type errors | When build fails |
| e2e-runner | End-to-end Playwright testing | Critical user flows |
| refactor-cleaner | Dead code cleanup | Code maintenance |
| doc-updater | Documentation and codemaps | Updating docs |
| typescript-reviewer | TypeScript/JavaScript code review | TypeScript/JavaScript projects |

## Agent Orchestration

Use agents proactively without user prompt:

- Complex feature requests → **planner**
- Code just written/modified → **code-reviewer**
- Bug fix or new feature → **tdd-guide**
- Architectural decision → **architect**
- Security-sensitive code → **security-reviewer**

## Security Guidelines

**Before ANY commit:** No hardcoded secrets; validate inputs; parameterized queries; XSS/CSRF/auth/rate limits; errors must not leak sensitive data.

**Secret management:** Use environment variables or a secret manager. Rotate exposed secrets immediately.

## Coding Style

**Immutability (CRITICAL):** Create new objects; avoid mutating existing state.

**File organization:** Prefer smaller, focused files (roughly 200–400 lines typical, 800 max). Organize by feature/domain.

## Testing Requirements

**Target:** strong automated coverage (ECC recommends 80%+). This repo uses Vitest and Playwright — extend tests when changing behavior.

**TDD workflow:** RED → GREEN → refactor; fix implementation rather than weakening tests unless the test is wrong.

## Development Workflow

1. Plan complex work (dependencies, risks, phases).
2. Prefer tests before or alongside implementation for non-trivial changes.
3. Review security and correctness before merge.
4. Put durable project knowledge in existing docs; avoid duplicating the same facts in many places.

## Workflow Surface Policy

Cursor workflow skills for this install live under `.cursor/skills/` (and `.cursor/.agents/skills/` where present).

## ECC layout in this project

| Path | Role |
|------|------|
| `.cursor/rules/` | Cursor rules (`.mdc`) |
| `.cursor/hooks/` + `.cursor/hooks.json` | Cursor hooks |
| `.cursor/scripts/` | Hook script implementations used by the adapter |
| `.cursor/skills/` | SKILL.md workflows |
| `.cursor/agents/` | Agent definitions |
| `.cursor/commands/` | Command shims |

Optional tuning: `ECC_HOOK_PROFILE` (`minimal` \| `standard` \| `strict`), `ECC_DISABLED_HOOKS` (comma-separated hook ids).
