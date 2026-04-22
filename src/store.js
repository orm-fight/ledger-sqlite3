'use strict';

const DEBIT_NORMAL = new Set(['asset', 'expense']);

async function createAccount(db, { name, type }) {
  await db.run(
    `INSERT INTO accounts (name, type) VALUES (?, ?)`,
    [name, type]
  );
}

async function postEntry(db, { description, lines }) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error('an entry must have at least 2 lines');
  }

  let totalD = 0;
  let totalC = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      throw new Error(`amount must be a positive integer (got ${line.amount})`);
    }
    if (line.side === 'D') totalD += line.amount;
    else if (line.side === 'C') totalC += line.amount;
    else throw new Error(`side must be 'D' or 'C' (got ${line.side})`);
  }
  if (totalD !== totalC) {
    throw new Error(`entry not balanced: ΣD=${totalD} ΣC=${totalC}`);
  }

  return db.transaction(async () => {
    const { lastID: entryId } = await db.run(
      `INSERT INTO journal_entries (description) VALUES (?)`,
      [description]
    );
    for (let i = 0; i < lines.length; i++) {
      const { account, side, amount } = lines[i];
      await db.run(
        `INSERT INTO journal_lines (entry_id, line_no, account, side, amount)
         VALUES (?, ?, ?, ?, ?)`,
        [entryId, i + 1, account, side, amount]
      );
    }
    return entryId;
  });
}

async function getBalance(db, accountName) {
  const account = await db.get(
    `SELECT type FROM accounts WHERE name = ?`,
    [accountName]
  );
  if (!account) throw new Error(`unknown account: ${accountName}`);

  const row = await db.get(
    `SELECT
       COALESCE(SUM(CASE WHEN side = 'D' THEN amount END), 0) AS debit_total,
       COALESCE(SUM(CASE WHEN side = 'C' THEN amount END), 0) AS credit_total
     FROM journal_lines
     WHERE account = ?`,
    [accountName]
  );

  return DEBIT_NORMAL.has(account.type)
    ? row.debit_total - row.credit_total
    : row.credit_total - row.debit_total;
}

async function trialBalance(db) {
  const rows = await db.all(`
    SELECT a.name, a.type,
           COALESCE(SUM(CASE WHEN l.side = 'D' THEN l.amount END), 0) AS debit_total,
           COALESCE(SUM(CASE WHEN l.side = 'C' THEN l.amount END), 0) AS credit_total
    FROM accounts a
    LEFT JOIN journal_lines l ON l.account = a.name
    GROUP BY a.name, a.type
    ORDER BY a.name
  `);
  return rows.map((r) => ({
    account: r.name,
    type: r.type,
    balance: DEBIT_NORMAL.has(r.type)
      ? r.debit_total - r.credit_total
      : r.credit_total - r.debit_total,
  }));
}

module.exports = { createAccount, postEntry, getBalance, trialBalance };
