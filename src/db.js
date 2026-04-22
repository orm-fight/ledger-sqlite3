'use strict';

const sqlite3 = require('sqlite3');

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS accounts (
    name TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense'))
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS journal_lines (
    entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
    line_no  INTEGER NOT NULL,
    account  TEXT    NOT NULL REFERENCES accounts(name),
    side     TEXT    NOT NULL CHECK (side IN ('D','C')),
    amount   INTEGER NOT NULL CHECK (amount > 0),
    PRIMARY KEY (entry_id, line_no)
  );
`;

function open(filename = ':memory:') {
  const db = new sqlite3.Database(filename);

  return {
    raw: db,

    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },

    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
      });
    },

    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
      });
    },

    exec(sql) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => (err ? reject(err) : resolve()));
      });
    },

    close() {
      return new Promise((resolve, reject) => {
        db.close((err) => (err ? reject(err) : resolve()));
      });
    },

    async transaction(fn) {
      await this.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn();
        await this.exec('COMMIT');
        return result;
      } catch (e) {
        try { await this.exec('ROLLBACK'); } catch (_) {}
        throw e;
      }
    },
  };
}

async function init(db) {
  await db.exec(SCHEMA);
}

module.exports = { open, init };
