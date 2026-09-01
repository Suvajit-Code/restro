const test = require('node:test');
const assert = require('node:assert/strict');

(async () => {
  test('database fallback works without Firebase env config', async () => {
    const { initDb, queryDb, insertDb } = require('../dist/config/db.js');
    await initDb();
    const id = await insertDb('menu', { item_name: 'Fallback Item', price: 99, category: 'Test' });
    const rows = await queryDb('menu', { item_name: 'Fallback Item' });

    assert.ok(id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].price, 99);
  });
})();
