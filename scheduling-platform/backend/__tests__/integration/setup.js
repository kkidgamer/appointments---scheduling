/**
 * Integration test setup.
 * Mocks the database module so routes can be tested with supertest
 * without requiring a running PostgreSQL instance.
 */
const stores = {};

function resetStores() {
  for (const key of Object.keys(stores)) {
    delete stores[key];
  }
}

function createStore(name) {
  if (!stores[name]) stores[name] = [];
  return stores[name];
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function _matchWhere(row, wheres) {
  for (const w of wheres) {
    if (w.op === 'IN') {
      if (!w.vals.includes(row[w.col])) return false;
    } else if (w.op === 'ILIKE') {
      const regex = new RegExp(w.pattern.replace(/%/g, '.*'), 'i');
      if (!regex.test(row[w.col] || '')) return false;
    } else if (w.op === 'OR_ILIKE') {
      // handled at higher level in the filter chain
      continue;
    } else {
      if (row[w.col] !== w.val) return false;
    }
  }
  return true;
}

/**
 * Create a mock Knex query builder that supports chaining.
 * This is a simplified version that handles the most common patterns.
 */
function createQueryBuilder(tableName) {
  const store = createStore(tableName);
  let _where = [];
  let _limit = null;
  let _orderBy = null;
  let _returning = null;
  let _del = false;
  let _increments = {};
  let _isFirst = false;

  const builder = {
    where(col, op, val) {
      if (val === undefined) {
        _where.push({ col, op: '=', val: op });
      } else {
        _where.push({ col, op, val });
      }
      return builder;
    },
    whereIn(col, vals) {
      _where.push({ col, op: 'IN', vals });
      return builder;
    },
    whereILike(col, pattern) {
      _where.push({ col, op: 'ILIKE', pattern });
      return builder;
    },
    orWhereILike(col, pattern) {
      _where.push({ col, op: 'OR_ILIKE', pattern });
      return builder;
    },
    join(table, col1, col2) {
      // Simplified: ignore joins for mock purposes
      return builder;
    },
    leftJoin(table, col1, col2) {
      // Simplified: ignore joins for mock purposes
      return builder;
    },
    select(...cols) {
      return builder;
    },
    orderBy(col, dir) {
      _orderBy = { col, dir: dir || 'asc' };
      return builder;
    },
    limit(n) {
      _limit = n;
      return builder;
    },
    returning(cols) {
      _returning = cols;
      return builder;
    },
    increment(col, amount) {
      _increments[col] = amount;
      return builder;
    },
    del() {
      _del = true;
      return builder;
    },
    first() {
      const results = _execQuery();
      return results[0] || undefined;
    },
    then(resolve) {
      const results = _execQuery();
      resolve(results);
      return { catch: () => {} };
    },

    insert(rows) {
      const inserted = [];
      const rowArray = Array.isArray(rows) ? rows : [rows];
      for (const row of rowArray) {
        const record = { ...row };
        if (!record.id) record.id = uuid();
        if (!record.created_at) record.created_at = new Date().toISOString();
        if (!record.updated_at) record.updated_at = new Date().toISOString();
        store.push(record);
        inserted.push(record);
      }
      const insertResult = {
        returning(cols) {
          if (cols === '*') return inserted;
          if (Array.isArray(cols)) {
            return inserted.map((r) => {
              const obj = {};
              for (const c of cols) obj[c] = r[c];
              return obj;
            });
          }
          return inserted;
        },
        then(resolve) {
          resolve(inserted);
          return { catch: () => {} };
        },
      };
      return insertResult;
    },

    update(updates) {
      const results = [];
      for (const row of store) {
        if (_matchWhere(row, _where)) {
          Object.assign(row, updates);
          results.push(row);
        }
      }
      const updateResult = {
        returning(cols) {
          if (cols === '*') return results;
          if (Array.isArray(cols)) {
            return results.map((r) => {
              const obj = {};
              for (const c of cols) obj[c] = r[c];
              return obj;
            });
          }
          return results;
        },
        then(resolve) {
          resolve(results);
          return { catch: () => {} };
        },
      };
      return updateResult;
    },
  };

  function _execQuery() {
    if (_del) {
      let removed = 0;
      for (let i = store.length - 1; i >= 0; i--) {
        if (_matchWhere(store[i], _where)) {
          store.splice(i, 1);
          removed++;
        }
      }
      return [{ deleted: removed }];
    }

    let results = store.filter((row) => _matchWhere(row, _where));
    if (_orderBy) {
      results.sort((a, b) => {
        const aVal = a[_orderBy.col];
        const bVal = b[_orderBy.col];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return _orderBy.dir === 'desc' ? -cmp : cmp;
      });
    }
    if (_limit) results = results.slice(0, _limit);
    if (_increments) {
      for (const row of results) {
        for (const [col, amount] of Object.entries(_increments)) {
          row[col] = (row[col] || 0) + amount;
        }
      }
    }
    return results;
  }

  return builder;
}

function createMockDb() {
  const fn = (tableName) => createQueryBuilder(tableName);
  fn.raw = async (sql) => {
    if (sql.includes('SELECT 1')) return [[{ '?column?': 1 }]];
    return [];
  };
  fn.transaction = async (cb) => cb(fn);
  fn.schema = {
    createTable: async () => {},
  };
  return fn;
}

module.exports = {
  resetStores,
  createMockDb,
  uuid,
};
