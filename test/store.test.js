'use strict';

// Tests mirror the Wikipedia "Transaction Example" from
// https://en.wikipedia.org/wiki/Double-entry_bookkeeping#Transaction_Example
// Amounts are integer dollars (10000 = $10,000) to keep the narrative readable.

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { createFixture } = require('./fixtures');
const { createAccount, postEntry, getBalance, trialBalance } = require('../src/store');
const { nowIso } = require('../src/utils');

async function seedAccounts(db) {
  await createAccount(db, { name: 'Cash',        type: 'asset'     });
  await createAccount(db, { name: 'Inventory',   type: 'asset'     });
  await createAccount(db, { name: 'Liabilities', type: 'liability' });
  await createAccount(db, { name: 'Equity',      type: 'equity'    });
}

describe('ledger', () => {
  let db, cleanup;

  beforeEach(async () => {
    ({ db, cleanup } = await createFixture());
    await seedAccounts(db);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('the rules every entry must follow', () => {
    it('records an entry', async () => {
      const id = await postEntry(db, {
        description: 'Buy inventory on credit',
        debit:  'Inventory',
        credit: 'Liabilities',
        amount: 10000,
        date:   nowIso(),
      });
      assert.equal(typeof id, 'number');
    });

    it('rejects a zero or negative amount', async () => {
      await assert.rejects(
        postEntry(db, {
          description: 'nothing',
          debit:  'Cash',
          credit: 'Equity',
          amount: 0,
          date:   nowIso(),
        }),
        /positive integer/
      );
    });

    it('rejects a reference to an unknown account', async () => {
      await assert.rejects(
        postEntry(db, {
          description: 'ghost account',
          debit:  'Cash',
          credit: 'DoesNotExist',
          amount: 100,
          date:   nowIso(),
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
        debit: 'Inventory', credit: 'Liabilities', amount: 10000, date: nowIso(),
      });

      assert.equal(await getBalance(db, 'Inventory'),   10000);
      assert.equal(await getBalance(db, 'Liabilities'), 10000);
    });

    it('Transaction 2a — sells the inventory for $15,000 cash', async () => {
      await postEntry(db, {
        description: 'Buy inventory on credit',
        debit: 'Inventory', credit: 'Liabilities', amount: 10000, date: nowIso(),
      });
      await postEntry(db, {
        description: 'Sell inventory for cash',
        debit: 'Cash', credit: 'Equity', amount: 15000, date: nowIso(),
      });

      assert.equal(await getBalance(db, 'Cash'),   15000);
      assert.equal(await getBalance(db, 'Equity'), 15000);
    });

    it('Transaction 2b — recognizes relief of inventory (cost of the sale)', async () => {
      await postEntry(db, {
        description: 'Buy inventory on credit',
        debit: 'Inventory', credit: 'Liabilities', amount: 10000, date: nowIso(),
      });
      await postEntry(db, {
        description: 'Sell inventory for cash',
        debit: 'Cash', credit: 'Equity', amount: 15000, date: nowIso(),
      });
      await postEntry(db, {
        description: 'Recognize relief of inventory',
        debit: 'Equity', credit: 'Inventory', amount: 10000, date: nowIso(),
      });

      // Inventory is now empty; Equity shows the gross margin so far.
      assert.equal(await getBalance(db, 'Inventory'), 0);
      assert.equal(await getBalance(db, 'Equity'),    5000);
    });

    it('Transaction 3 — pays the vendor with $10,000 cash', async () => {
      await postEntry(db, {
        description: 'Buy inventory on credit',
        debit: 'Inventory', credit: 'Liabilities', amount: 10000, date: nowIso(),
      });
      await postEntry(db, {
        description: 'Sell inventory for cash',
        debit: 'Cash', credit: 'Equity', amount: 15000, date: nowIso(),
      });
      await postEntry(db, {
        description: 'Recognize relief of inventory',
        debit: 'Equity', credit: 'Inventory', amount: 10000, date: nowIso(),
      });
      await postEntry(db, {
        description: 'Pay vendor',
        debit: 'Liabilities', credit: 'Cash', amount: 10000, date: nowIso(),
      });

      // End state matches Wikipedia exactly:
      //   "increase in cash of $5,000 and an increase in equity of $5,000"
      assert.equal(await getBalance(db, 'Cash'),        5000);
      assert.equal(await getBalance(db, 'Equity'),      5000);
      assert.equal(await getBalance(db, 'Inventory'),   0);
      assert.equal(await getBalance(db, 'Liabilities'), 0);
    });
  });

  describe('the trial balance', () => {
    it('final trial balance matches Wikipedia (Cash=+5000, Equity=+5000, others 0)', async () => {
      for (const entry of [
        { description: '1',  debit: 'Inventory',   credit: 'Liabilities', amount: 10000, date: nowIso() },
        { description: '2a', debit: 'Cash',        credit: 'Equity',      amount: 15000, date: nowIso() },
        { description: '2b', debit: 'Equity',      credit: 'Inventory',   amount: 10000, date: nowIso() },
        { description: '3',  debit: 'Liabilities', credit: 'Cash',        amount: 10000, date: nowIso() },
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
