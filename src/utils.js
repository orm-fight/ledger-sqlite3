'use strict';

function balance({ type, debit_total, credit_total }) {
  return ['asset', 'expense'].includes(type)
    ? debit_total - credit_total
    : credit_total - debit_total;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = { balance, nowIso };
