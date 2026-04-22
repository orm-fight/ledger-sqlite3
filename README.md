# ledger-sqlite3

A minimal double-entry bookkeeping ledger, persisted in SQLite via the `sqlite3` npm package — no ORM.

The whole repo exists to make one thing legible: the *Transaction Example* from the Wikipedia article on [Double-entry bookkeeping](https://en.wikipedia.org/wiki/Double-entry_bookkeeping#Transaction_Example). If you can read the test file and follow what the ledger does, the repo has done its job.

## The scenario

Four accounts, four journal entries, one final state.

| # | Narrative | Debit | Credit | Amount |
|---|---|---|---|---|
| 1 | Buy inventory on credit | Inventory | Liabilities | 10 000 |
| 2a | Sell inventory for cash | Cash | Equity | 15 000 |
| 2b | Recognize relief of inventory | Equity | Inventory | 10 000 |
| 3 | Pay the vendor | Liabilities | Cash | 10 000 |

Final balances: **Cash = 5 000**, **Equity = 5 000**, Inventory = 0, Liabilities = 0.

(Wikipedia's example books the sale directly to `Equity` instead of going through temporary `Revenue` / `Cost of Goods Sold` accounts that close to equity at year-end. This repo follows Wikipedia's simplification exactly.)

## Core rules

Every journal entry names **exactly one debit account and one credit account** with the same amount — the schema enforces this (one row per entry, two FK columns). That makes `Σ debits == Σ credits` structurally true across the whole ledger; it can't drift.

The two remaining checks are:

1. `amount > 0`.
2. Every referenced account exists.

That's it. No periods, no audit trail, no VAT, no multi-currency, no reversal, no split entries. See the sibling repo `ts-orm-research` for a GoB-compliant superset.

## Running

```
npm install
npm test
```

Tests run on an in-memory SQLite database — nothing is written to disk.

## Units

Amounts are stored as **integer dollars** to keep the tests readable (`10000` means $10,000). A production ledger would use minor units (cents) to avoid any ambiguity; that is deliberately skipped here for the sake of a readable narrative.

## Siblings

This is the first of a planned series of repos demonstrating the same scenario over different SQLite bindings:

- `ledger-sqlite3` (this repo) — `sqlite3` (async, callback-based, promisified)
- `ledger-better-sqlite3` — `better-sqlite3` (synchronous)
- `ledger-node-sqlite` — Node 22+ built-in `node:sqlite`
