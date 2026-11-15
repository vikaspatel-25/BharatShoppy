/**
 * A small in-memory stand-in for the MongoDB collections API, for tests only.
 * Supports the filters and options the panel controllers use: equality on dotted paths,
 * $in, $nin, $ne, $exists, $gt, $gte, $lt, $lte, $regex, $or, $and; find with projection,
 * sort, skip and limit; countDocuments; findOne; insertOne; updateOne and updateMany with
 * $set, $unset and $inc (updateOne also takes { upsert } with $setOnInsert); findOneAndUpdate;
 * deleteOne; deleteMany; createIndex; and aggregate with a single $group counting by one field.
 */

function getPath(doc, path) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), doc);
}

function setPath(doc, path, value) {
  const keys = path.split(".");
  let target = doc;
  for (const key of keys.slice(0, -1)) {
    if (target[key] == null || typeof target[key] !== "object") target[key] = {};
    target = target[key];
  }
  target[keys[keys.length - 1]] = value;
}

function unsetPath(doc, path) {
  const keys = path.split(".");
  let target = doc;
  for (const key of keys.slice(0, -1)) {
    if (target[key] == null) return;
    target = target[key];
  }
  delete target[keys[keys.length - 1]];
}

function same(a, b) {
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  return a === b || String(a) === String(b);
}

function compare(a, b) {
  const x = a instanceof Date ? a.getTime() : a;
  const y = b instanceof Date ? b.getTime() : b;
  return x < y ? -1 : x > y ? 1 : 0;
}

function matchCondition(value, condition) {
  if (condition instanceof RegExp) return typeof value === "string" && condition.test(value);
  if (condition && typeof condition === "object" && !Array.isArray(condition) && !(condition instanceof Date)) {
    const ops = Object.keys(condition);
    if (ops.length > 0 && ops.every((k) => k.startsWith("$"))) {
      return ops.every((op) => {
        const arg = condition[op];
        switch (op) {
          case "$in":
            return arg.some((x) => (Array.isArray(value) ? value.some((v) => same(v, x)) : same(value, x)));
          case "$nin":
            return !arg.some((x) => same(value, x));
          case "$ne":
            return Array.isArray(value) ? !value.some((v) => same(v, arg)) : !(value === arg || (value !== undefined && arg !== undefined && arg !== null && same(value, arg)));
          case "$exists":
            return arg ? value !== undefined : value === undefined;
          case "$gt":
            return value != null && compare(value, arg) > 0;
          case "$gte":
            return value != null && compare(value, arg) >= 0;
          case "$lt":
            return value != null && compare(value, arg) < 0;
          case "$lte":
            return value != null && compare(value, arg) <= 0;
          case "$regex": {
            const re = arg instanceof RegExp ? arg : new RegExp(arg, condition.$options || "");
            return typeof value === "string" && re.test(value);
          }
          case "$options":
            return true;
          default:
            throw new Error(`memoryDb: unsupported operator ${op}`);
        }
      });
    }
  }
  if (condition === null) return value === null || value === undefined;
  if (Array.isArray(value) && !Array.isArray(condition)) return value.some((v) => same(v, condition));
  return same(value, condition);
}

export function matches(doc, filter = {}) {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === "$or") return condition.some((sub) => matches(doc, sub));
    if (key === "$and") return condition.every((sub) => matches(doc, sub));
    return matchCondition(getPath(doc, key), condition);
  });
}

function project(doc, projection) {
  if (!projection || Object.keys(projection).length === 0) return structuredClone(doc);
  const out = { _id: doc._id };
  for (const [path, on] of Object.entries(projection)) {
    if (!on) continue;
    const value = getPath(doc, path);
    if (value !== undefined) setPath(out, path, structuredClone(value));
  }
  return out;
}

function applyUpdate(doc, update) {
  for (const [path, value] of Object.entries(update.$set || {})) setPath(doc, path, structuredClone(value));
  for (const path of Object.keys(update.$unset || {})) unsetPath(doc, path);
  for (const [path, by] of Object.entries(update.$inc || {})) setPath(doc, path, (Number(getPath(doc, path)) || 0) + by);
}

class Cursor {
  constructor(rows) {
    this.rows = rows;
  }
  sort(spec) {
    const entries = Object.entries(spec || {});
    this.rows.sort((a, b) => {
      for (const [path, dir] of entries) {
        const c = compare(getPath(a, path), getPath(b, path));
        if (c !== 0) return c * (dir < 0 ? -1 : 1);
      }
      return 0;
    });
    return this;
  }
  skip(n) {
    this.rows = this.rows.slice(n);
    return this;
  }
  limit(n) {
    if (n > 0) this.rows = this.rows.slice(0, n);
    return this;
  }
  project(projection) {
    this.rows = this.rows.map((r) => project(r, projection));
    return this;
  }
  async toArray() {
    return this.rows;
  }
}

export class MemoryCollection {
  constructor(docs = []) {
    this.docs = docs.map((d) => structuredClone(d));
    this.failNext = null;
  }
  _maybeFail() {
    if (this.failNext) {
      const err = this.failNext;
      this.failNext = null;
      throw err;
    }
  }
  find(filter = {}, options = {}) {
    this._maybeFail();
    const rows = this.docs.filter((d) => matches(d, filter)).map((d) => project(d, options.projection));
    const cursor = new Cursor(rows);
    if (options.sort) cursor.sort(options.sort);
    if (options.skip) cursor.skip(options.skip);
    if (options.limit) cursor.limit(options.limit);
    return cursor;
  }
  async findOne(filter = {}, options = {}) {
    this._maybeFail();
    const doc = this.docs.find((d) => matches(d, filter));
    return doc ? project(doc, options.projection) : null;
  }
  async countDocuments(filter = {}) {
    this._maybeFail();
    return this.docs.filter((d) => matches(d, filter)).length;
  }
  async insertOne(doc) {
    this._maybeFail();
    const copy = structuredClone(doc);
    if (copy._id === undefined) copy._id = `mem_${Math.random().toString(36).slice(2, 12)}`;
    this.docs.push(copy);
    return { acknowledged: true, insertedId: copy._id };
  }
  async updateOne(filter, update, options = {}) {
    this._maybeFail();
    const doc = this.docs.find((d) => matches(d, filter));
    if (!doc && options.upsert) {
      const created = {};
      for (const [path, value] of Object.entries(filter)) {
        if (value === null || typeof value !== "object") setPath(created, path, value);
      }
      for (const [path, value] of Object.entries(update.$setOnInsert || {})) setPath(created, path, structuredClone(value));
      applyUpdate(created, update);
      if (created._id === undefined) created._id = `mem_${Math.random().toString(36).slice(2, 12)}`;
      this.docs.push(created);
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1, upsertedId: created._id };
    }
    if (!doc) return { matchedCount: 0, modifiedCount: 0 };
    applyUpdate(doc, update);
    return { matchedCount: 1, modifiedCount: 1 };
  }
  async updateMany(filter, update) {
    this._maybeFail();
    const docs = this.docs.filter((d) => matches(d, filter));
    for (const doc of docs) applyUpdate(doc, update);
    return { matchedCount: docs.length, modifiedCount: docs.length };
  }
  async findOneAndUpdate(filter, update, options = {}) {
    this._maybeFail();
    const doc = this.docs.find((d) => matches(d, filter));
    if (!doc) return null;
    const before = structuredClone(doc);
    applyUpdate(doc, update);
    return options.returnDocument === "after" ? structuredClone(doc) : before;
  }
  async deleteOne(filter) {
    this._maybeFail();
    const i = this.docs.findIndex((d) => matches(d, filter));
    if (i === -1) return { deletedCount: 0 };
    this.docs.splice(i, 1);
    return { deletedCount: 1 };
  }
  async deleteMany(filter = {}) {
    this._maybeFail();
    const before = this.docs.length;
    this.docs = this.docs.filter((d) => !matches(d, filter));
    return { deletedCount: before - this.docs.length };
  }
  async createIndex() {
    return "ok";
  }
  /** Supports [{ $group: { _id: "$field", count: { $sum: 1 } } }] only. */
  aggregate(pipeline = []) {
    this._maybeFail();
    const group = pipeline[0]?.$group;
    const key = String(group?._id || "").replace(/^\$/, "");
    const counts = new Map();
    for (const d of this.docs) {
      const k = getPath(d, key);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return new Cursor([...counts].map(([k, count]) => ({ _id: k ?? null, count })));
  }
}

/** A fake `mongoose.connection.db`. Unknown collections are created empty on first use. */
export function createMemoryDb(seed = {}) {
  const collections = new Map(Object.entries(seed).map(([name, docs]) => [name, new MemoryCollection(docs)]));
  return {
    collections,
    collection(name) {
      if (!collections.has(name)) collections.set(name, new MemoryCollection());
      return collections.get(name);
    },
  };
}

export function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    cookies: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    cookie(name, value) {
      this.cookies[name] = value;
      return this;
    },
    clearCookie(name) {
      delete this.cookies[name];
      return this;
    },
  };
}
