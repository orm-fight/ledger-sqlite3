# Working context for Claude

See [README.md](README.md) for the scenario, the rules, how to run, and the sibling-repo plan. The notes below are what README deliberately doesn't cover: intent, conventions, and workflow.

## Intent

This repo is **intentionally minimal**. Core double-entry only — no GoB compliance, no audit log, no period locking, no reversal, no immutability triggers, no gap-free sequence, no VAT, no multi-currency.

A GoB-compliant superset of the same domain lives at `~/Git/ts-orm-research/sqlite3/`. The two repos share no code and serve different audiences:

| | `~/Git/ledger-sqlite3/` (here) | `~/Git/ts-orm-research/sqlite3/` |
|---|---|---|
| Audience | Colleagues new to accounting | Colleagues evaluating GoB-compliant designs |
| Scope | Wikipedia Transaction Example | German GoB / GoBD requirements |
| Features | `postEntry`, `getBalance`, `trialBalance` | + audit log, periods, reversal, immutability, SKR03 |

If the user asks for audit logs, period rules, reversal, or SKR03 *in this repo*, confirm first — those belong in `ts-orm-research`, not here.

## Conventions

- **Account identifiers are English names** (`Cash`, `Inventory`, `Liabilities`, `Equity`) — never SKR03 numeric codes. The teaching goal is that the test file reads as narrative; numeric codes defeat that. SKR03 belongs in the compliance repo.
- **Amounts are integer dollars** (`10000` = $10,000), not minor units. A production ledger should use minor units (cents); this repo trades realism for readability. Don't change this without asking.
- **Repo series** follows the `ledger-<library>` convention: this is `ledger-sqlite3`; planned siblings are `ledger-better-sqlite3` and `ledger-node-sqlite` (hyphen, not colon).

## Workflow

- Host: company GitLab at `gitlab.maibornwolff.de`, group `guild-wtb`. Clone URL is wired as `origin`.
- The user will transfer ownership to their superior via *Settings → Members* once initial state is pushed. Don't treat the user as the long-term sole owner.
- Migration to GitHub is planned for "when the project is ready for a broader audience" — not yet. Don't prematurely add GitHub-specific files (issue templates, `.github/workflows/`).
- Never push on the user's behalf unless they ask. Creating local commits is fine.
