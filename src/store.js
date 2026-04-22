'use strict';

function balance(totals) {
  return ['asset', 'expense'].includes(totals.type)
    ? totals.debit_total - totals.credit_total
    : totals.credit_total - totals.debit_total;
}

function nowIso() {
  return new Date().toISOString();
}

async function createAccount(db, { name, type }) {
  await db.run(
    `INSERT INTO accounts (name, type) VALUES (?, ?)`,
    [name, type]
  );
}

async function postEntry(db, { description, debit, credit, amount, date }) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`amount must be a positive integer (got ${amount})`);
  }

  const { lastID } = await db.run(
    `INSERT INTO journal_entries (description, account_debit, account_credit, amount, date)
     VALUES (?, ?, ?, ?, ?)`,
    [description, debit, credit, amount, date]
  );
  return lastID;
}

async function getBalance(db, accountName) {
  const account = await db.get(
    `SELECT type FROM accounts WHERE name = ?`,
    [accountName]
  );
  if (!account) throw new Error(`unknown account: ${accountName}`);

  const totals = await db.get(
    `SELECT
       COALESCE(SUM(CASE WHEN account_debit  = ? THEN amount END), 0) AS debit_total,
       COALESCE(SUM(CASE WHEN account_credit = ? THEN amount END), 0) AS credit_total
     FROM journal_entries`,
    [accountName, accountName]
  );

  return balance({ type: account.type, ...totals });
}

async function trialBalance(db) {
  const allTotals = await db.all(`
    SELECT a.name, a.type,
           COALESCE(SUM(CASE WHEN e.account_debit  = a.name THEN e.amount END), 0) AS debit_total,
           COALESCE(SUM(CASE WHEN e.account_credit = a.name THEN e.amount END), 0) AS credit_total
    FROM accounts a
    LEFT JOIN journal_entries e
      ON e.account_debit = a.name OR e.account_credit = a.name
    GROUP BY a.name, a.type
    ORDER BY a.name
  `);
  return allTotals.map((totals) => ({
    account: totals.name,
    type: totals.type,
    balance: balance(totals),
  }));
}

module.exports = { createAccount, postEntry, getBalance, trialBalance, nowIso };
