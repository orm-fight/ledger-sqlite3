'use strict';

// Tests mirror the Wikipedia "Transaction Example" from
// https://en.wikipedia.org/wiki/Double-entry_bookkeeping#Transaction_Example
// Amounts are integer dollars (10000 = $10,000) to keep the narrative readable.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { open, init } = require('../src/db');
const { createAccount, postEntry, getBalance, trialBalance } = require('../src/store');

async function seedAccounts(db) {
  await createAccount(db, { name: 'Cash',        type: 'asset'     });
  await createAccount(db, { name: 'Inventory',   type: 'asset'     });
  await createAccount(db, { name: 'Liabilities', type: 'liability' });
  await createAccount(db, { name: 'Equity',      type: 'equity'    });
}

describe('ledger', () => {
  let db;

  beforeEach(async () => {
    db = open(':memory:');
    await init(db);
    await seedAccounts(db);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('the rules every entry must follow', () => {
    it('accepts a balanced two-line entry', async () => {
      const id = await postEntry(db, {
        description: 'Buy inventory on credit',
        lines: [
          { account: 'Inventory',   side: 'D', amount: 10000 },
          { account: 'Liabilities', side: 'C', amount: 10000 },
        ],
      });
      assert.equal(typeof id, 'number');
    });

    it('rejects an unbalanced entry (ΣD ≠ ΣC)', async () => {
      await assert.rejects(
        postEntry(db, {
          description: 'off by one thousand',
          lines: [
            { account: 'Inventory',   side: 'D', amount: 10000 },
            { account: 'Liabilities', side: 'C', amount: 9000 },
          ],
        }),
        /not balanced/
      );
    });

    it('rejects an entry with fewer than two lines', async () => {
      await assert.rejects(
        postEntry(db, {
          description: 'one-sided',
          lines: [{ account: 'Cash', side: 'D', amount: 100 }],
        }),
        /at least 2 lines/
      );
    });

    it('rejects a zero or negative amount', async () => {
      await assert.rejects(
        postEntry(db, {
          description: 'nothing',
          lines: [
            { account: 'Cash',   side: 'D', amount: 0 },
            { account: 'Equity', side: 'C', amount: 0 },
          ],
        }),
        /positive integer/
      );
    });

    it('rejects a reference to an unknown account', async () => {
      await assert.rejects(
        postEntry(db, {
          description: 'ghost account',
          lines: [
            { account: 'Cash',           side: 'D', amount: 100 },
            { account: 'DoesNotExist',   side: 'C', amount: 100 },
          ],
        })
      );
    });
  });

  describe("Wikipedia's Transaction Example, step by step", () => {
    // The scenario:
    //   A business buys $10,000 of inventory on credit,
    //   sells it for $15,000 cash,
    //   recognizes the relief of that inventory,
    //   and finally pays the vendor.
    //
    // Expected end-state: Cash = 5,000, Equity = 5,000, everything else 0.

    it('Transaction 1 — buys $10,000 of inventory on credit', async () => {
      await postEntry(db, {
        description: 'Buy inventory on credit',
        lines: [
          { account: 'Inventory',   side: 'D', amount: 10000 },
          { account: 'Liabilities', side: 'C', amount: 10000 },
        ],
      });

      assert.equal(await getBalance(db, 'Inventory'),   10000);
      assert.equal(await getBalance(db, 'Liabilities'), 10000);
    });

    it('Transaction 2a — sells the inventory for $15,000 cash', async () => {
      await postEntry(db, {
        description: 'Buy inventory on credit',
        lines: [
          { account: 'Inventory',   side: 'D', amount: 10000 },
          { account: 'Liabilities', side: 'C', amount: 10000 },
        ],
      });
      await postEntry(db, {
        description: 'Sell inventory for cash',
        lines: [
          { account: 'Cash',   side: 'D', amount: 15000 },
          { account: 'Equity', side: 'C', amount: 15000 },
        ],
      });

      assert.equal(await getBalance(db, 'Cash'),   15000);
      assert.equal(await getBalance(db, 'Equity'), 15000);
    });

    it('Transaction 2b — recognizes relief of inventory (cost of the sale)', async () => {
      await postEntry(db, {
        description: 'Buy inventory on credit',
        lines: [
          { account: 'Inventory',   side: 'D', amount: 10000 },
          { account: 'Liabilities', side: 'C', amount: 10000 },
        ],
      });
      await postEntry(db, {
        description: 'Sell inventory for cash',
        lines: [
          { account: 'Cash',   side: 'D', amount: 15000 },
          { account: 'Equity', side: 'C', amount: 15000 },
        ],
      });
      await postEntry(db, {
        description: 'Recognize relief of inventory',
        lines: [
          { account: 'Equity',    side: 'D', amount: 10000 },
          { account: 'Inventory', side: 'C', amount: 10000 },
        ],
      });

      // Inventory is now empty; Equity shows the gross margin so far.
      assert.equal(await getBalance(db, 'Inventory'), 0);
      assert.equal(await getBalance(db, 'Equity'),    5000);
    });

    it('Transaction 3 — pays the vendor with $10,000 cash', async () => {
      await postEntry(db, {
        description: 'Buy inventory on credit',
        lines: [
          { account: 'Inventory',   side: 'D', amount: 10000 },
          { account: 'Liabilities', side: 'C', amount: 10000 },
        ],
      });
      await postEntry(db, {
        description: 'Sell inventory for cash',
        lines: [
          { account: 'Cash',   side: 'D', amount: 15000 },
          { account: 'Equity', side: 'C', amount: 15000 },
        ],
      });
      await postEntry(db, {
        description: 'Recognize relief of inventory',
        lines: [
          { account: 'Equity',    side: 'D', amount: 10000 },
          { account: 'Inventory', side: 'C', amount: 10000 },
        ],
      });
      await postEntry(db, {
        description: 'Pay vendor',
        lines: [
          { account: 'Liabilities', side: 'D', amount: 10000 },
          { account: 'Cash',        side: 'C', amount: 10000 },
        ],
      });

      // End state matches Wikipedia exactly:
      //   "increase in cash of $5,000 and an increase in equity of $5,000"
      assert.equal(await getBalance(db, 'Cash'),        5000);
      assert.equal(await getBalance(db, 'Equity'),      5000);
      assert.equal(await getBalance(db, 'Inventory'),   0);
      assert.equal(await getBalance(db, 'Liabilities'), 0);
    });
  });

  describe('the trial balance always balances', () => {
    it('ΣD equals ΣC across the whole ledger, after every step', async () => {
      const steps = [
        {
          description: 'Buy inventory on credit',
          lines: [
            { account: 'Inventory',   side: 'D', amount: 10000 },
            { account: 'Liabilities', side: 'C', amount: 10000 },
          ],
        },
        {
          description: 'Sell inventory for cash',
          lines: [
            { account: 'Cash',   side: 'D', amount: 15000 },
            { account: 'Equity', side: 'C', amount: 15000 },
          ],
        },
        {
          description: 'Recognize relief of inventory',
          lines: [
            { account: 'Equity',    side: 'D', amount: 10000 },
            { account: 'Inventory', side: 'C', amount: 10000 },
          ],
        },
        {
          description: 'Pay vendor',
          lines: [
            { account: 'Liabilities', side: 'D', amount: 10000 },
            { account: 'Cash',        side: 'C', amount: 10000 },
          ],
        },
      ];

      for (const step of steps) {
        await postEntry(db, step);
        const [{ d }] = await db.all(
          `SELECT COALESCE(SUM(amount), 0) AS d FROM journal_lines WHERE side = 'D'`
        );
        const [{ c }] = await db.all(
          `SELECT COALESCE(SUM(amount), 0) AS c FROM journal_lines WHERE side = 'C'`
        );
        assert.equal(d, c, `ledger unbalanced after: ${step.description}`);
      }
    });

    it('final trial balance matches Wikipedia (Cash=+5000, Equity=+5000, others 0)', async () => {
      for (const entry of [
        { description: '1',  lines: [{ account: 'Inventory',   side: 'D', amount: 10000 }, { account: 'Liabilities', side: 'C', amount: 10000 }] },
        { description: '2a', lines: [{ account: 'Cash',        side: 'D', amount: 15000 }, { account: 'Equity',      side: 'C', amount: 15000 }] },
        { description: '2b', lines: [{ account: 'Equity',      side: 'D', amount: 10000 }, { account: 'Inventory',   side: 'C', amount: 10000 }] },
        { description: '3',  lines: [{ account: 'Liabilities', side: 'D', amount: 10000 }, { account: 'Cash',        side: 'C', amount: 10000 }] },
      ]) {
        await postEntry(db, entry);
      }

      const tb = await trialBalance(db);
      const byAccount = Object.fromEntries(tb.map((r) => [r.account, r.balance]));
      assert.deepEqual(byAccount, {
        Cash:        5000,
        Equity:      5000,
        Inventory:   0,
        Liabilities: 0,
      });
    });
  });
});
