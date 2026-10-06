import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Todo } from '../src/models/Todo.js';

let mongo;
let app;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = createApp();
}, 300000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Todo.deleteMany({});
});

const create = (body) => request(app).post('/api/todos').send(body);

describe('Health & unknown routes', () => {
  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  test('unknown route returns 404 envelope', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('wrong method on existing path returns 404 envelope', async () => {
    const res = await request(app).put('/api/todos');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/todos — creation', () => {
  test('creates a todo with 201 and defaults', async () => {
    const res = await create({ title: 'Buy milk' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const t = res.body.data;
    expect(t.title).toBe('Buy milk');
    expect(t.completed).toBe(false);
    expect(t.priority).toBe('medium');
    expect(t.notes).toBe('');
    expect(t.tags).toEqual([]);
    expect(t.dueDate).toBeNull();
    expect(t.id).toMatch(/^[0-9a-f]{24}$/);
    expect(t._id).toBeUndefined();
    expect(t.__v).toBeUndefined();
    expect(t.createdAt).toBeDefined();
    expect(t.updatedAt).toBeDefined();
  });

  test('trims whitespace from title and notes', async () => {
    const res = await create({ title: '  spaced  ', notes: '  n  ' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('spaced');
    expect(res.body.data.notes).toBe('n');
  });

  test('rejects missing title', async () => {
    const res = await create({ notes: 'no title' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects empty and whitespace-only titles', async () => {
    for (const title of ['', '   ', '\t\n ']) {
      const res = await create({ title });
      expect(res.status).toBe(400);
    }
  });

  test('rejects non-string title', async () => {
    for (const title of [123, true, ['x'], { t: 'x' }]) {
      const res = await create({ title });
      expect(res.status).toBe(400);
    }
  });

  test('accepts title of exactly 200 chars, rejects 201', async () => {
    const ok = await create({ title: 'a'.repeat(200) });
    expect(ok.status).toBe(201);
    const bad = await create({ title: 'a'.repeat(201) });
    expect(bad.status).toBe(400);
  });

  test('rejects invalid priority / completed / dueDate / notes / tags', async () => {
    const cases = [
      { priority: 'urgent' },
      { priority: 'HIGH' },
      { completed: 'yes' },
      { completed: 1 },
      { dueDate: 'not-a-date' },
      { dueDate: '2026-13-45' },
      { notes: 42 },
      { notes: 'x'.repeat(2001) },
      { tags: 'not-an-array' },
      { tags: ['ok', ''] },
      { tags: ['   '] },
      { tags: ['x'.repeat(31)] },
      { tags: [123] },
      { tags: Array.from({ length: 21 }, (_, i) => `tag${i}`) },
    ];
    for (const body of cases) {
      const res = await create({ title: 't', ...body });
      expect(res.status).toBe(400);
    }
  });

  test('accepts null dueDate and null notes/tags', async () => {
    const res = await create({ title: 't', dueDate: null, notes: null, tags: null });
    expect(res.status).toBe(201);
    expect(res.body.data.dueDate).toBeNull();
  });

  test('dedupes and trims tags', async () => {
    const res = await create({ title: 't', tags: [' home ', 'home', 'work'] });
    expect(res.status).toBe(201);
    expect(res.body.data.tags).toEqual(['home', 'work']);
  });

  test('accepts valid dueDate, priority and completed', async () => {
    const res = await create({
      title: 't',
      dueDate: '2026-12-31T23:59:59.000Z',
      priority: 'high',
      completed: true,
    });
    expect(res.status).toBe(201);
    expect(new Date(res.body.data.dueDate).getFullYear()).toBe(2026);
    expect(res.body.data.priority).toBe('high');
    expect(res.body.data.completed).toBe(true);
  });

  test('rejects malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/todos')
      .set('Content-Type', 'application/json')
      .send('{"title": broken');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  test('rejects oversized body', async () => {
    const res = await create({ title: 't', notes: 'x'.repeat(200 * 1024) });
    expect(res.status).toBe(413);
  });

  test('allows duplicate titles', async () => {
    await create({ title: 'same' });
    const res = await create({ title: 'same' });
    expect(res.status).toBe(201);
  });

  test('handles unicode and emoji titles', async () => {
    const res = await create({ title: '完成 🎉 café naïve' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('完成 🎉 café naïve');
  });
});

describe('GET /api/todos — listing', () => {
  test('returns empty list with correct pagination envelope', async () => {
    const res = await request(app).get('/api/todos');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 0, totalPages: 1 });
    expect(res.body.pagination.hasNext).toBe(false);
    expect(res.body.pagination.hasPrev).toBe(false);
  });

  test('paginates correctly', async () => {
    for (let i = 0; i < 25; i++) await create({ title: `task ${i}` });
    const p1 = await request(app).get('/api/todos?page=1&limit=10');
    expect(p1.body.data).toHaveLength(10);
    expect(p1.body.pagination).toMatchObject({ page: 1, total: 25, totalPages: 3, hasNext: true, hasPrev: false });
    const p3 = await request(app).get('/api/todos?page=3&limit=10');
    expect(p3.body.data).toHaveLength(5);
    expect(p3.body.pagination).toMatchObject({ hasNext: false, hasPrev: true });
    const p9 = await request(app).get('/api/todos?page=9&limit=10');
    expect(p9.body.data).toEqual([]);
  });

  test('clamps limit to 100 and rejects invalid page/limit', async () => {
    const big = await request(app).get('/api/todos?limit=500');
    expect(big.status).toBe(400);
    for (const q of ['page=0', 'page=-1', 'page=abc', 'limit=0', 'limit=-5', 'limit=abc']) {
      const res = await request(app).get(`/api/todos?${q}`);
      expect(res.status).toBe(400);
    }
  });

  test('filters by status', async () => {
    await create({ title: 'a', completed: true });
    await create({ title: 'b' });
    const active = await request(app).get('/api/todos?status=active');
    expect(active.body.data.map((t) => t.title)).toEqual(['b']);
    const done = await request(app).get('/api/todos?status=completed');
    expect(done.body.data.map((t) => t.title)).toEqual(['a']);
    const bad = await request(app).get('/api/todos?status=bogus');
    expect(bad.status).toBe(400);
  });

  test('filters by priority and tag', async () => {
    await create({ title: 'a', priority: 'high', tags: ['home'] });
    await create({ title: 'b', priority: 'low', tags: ['work'] });
    const p = await request(app).get('/api/todos?priority=high');
    expect(p.body.data.map((t) => t.title)).toEqual(['a']);
    const t = await request(app).get('/api/todos?tag=work');
    expect(t.body.data.map((t2) => t2.title)).toEqual(['b']);
    const bad = await request(app).get('/api/todos?priority=bogus');
    expect(bad.status).toBe(400);
  });

  test('search is case-insensitive and treats regex chars literally', async () => {
    await create({ title: 'Buy MILK today' });
    await create({ title: 'Buy (milk) [special].*' });
    await create({ title: 'unrelated' });
    const s1 = await request(app).get('/api/todos?search=milk');
    expect(s1.body.data).toHaveLength(2);
    const s2 = await request(app).get('/api/todos?search=(milk) [special].*');
    expect(s2.body.data).toHaveLength(1);
    expect(s2.body.data[0].title).toBe('Buy (milk) [special].*');
    // Escaped "today.*" matches only a literal "today.*", which no title has.
    const s3 = await request(app).get('/api/todos?search=today.*');
    expect(s3.body.data).toHaveLength(0);
  });

  test('sorts by dueDate, title and priority', async () => {
    await create({ title: 'b', dueDate: '2026-06-01T00:00:00.000Z', priority: 'low' });
    await create({ title: 'a', dueDate: '2026-01-01T00:00:00.000Z', priority: 'high' });
    await create({ title: 'c', priority: 'medium' });
    const byDate = await request(app).get('/api/todos?sort=dueDate');
    expect(byDate.body.data.map((t) => t.title)).toEqual(['a', 'b', 'c']);
    const byDateDesc = await request(app).get('/api/todos?sort=-dueDate');
    expect(byDateDesc.body.data.map((t) => t.title)).toEqual(['b', 'a', 'c']);
    const byTitle = await request(app).get('/api/todos?sort=title');
    expect(byTitle.body.data.map((t) => t.title)).toEqual(['a', 'b', 'c']);
    const byPri = await request(app).get('/api/todos?sort=priority');
    expect(byPri.body.data.map((t) => t.title)).toEqual(['a', 'c', 'b']);
    const bad = await request(app).get('/api/todos?sort=bogus');
    expect(bad.status).toBe(400);
  });

  test('overdue filter only counts incomplete past-due todos', async () => {
    const past = '2020-01-01T00:00:00.000Z';
    const future = '2030-01-01T00:00:00.000Z';
    await create({ title: 'overdue', dueDate: past });
    await create({ title: 'done-past', dueDate: past, completed: true });
    await create({ title: 'future', dueDate: future });
    await create({ title: 'no-date' });
    const res = await request(app).get('/api/todos?overdue=true');
    expect(res.body.data.map((t) => t.title)).toEqual(['overdue']);
  });
});

describe('GET /api/todos/:id', () => {
  test('returns the todo', async () => {
    const c = await create({ title: 'find me' });
    const res = await request(app).get(`/api/todos/${c.body.data.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('find me');
  });

  test('rejects malformed id with 400', async () => {
    for (const id of ['abc', '123', 'zzzzzzzzzzzzzzzzzzzzzzzz']) {
      const res = await request(app).get(`/api/todos/${id}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ID');
    }
  });

  test('returns 404 for valid but nonexistent id', async () => {
    const res = await request(app).get(`/api/todos/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TODO_NOT_FOUND');
  });
});

describe('PATCH /api/todos/:id', () => {
  test('partially updates fields', async () => {
    const c = await create({ title: 'orig', priority: 'low' });
    const res = await request(app).patch(`/api/todos/${c.body.data.id}`).send({ title: 'new', completed: true });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('new');
    expect(res.body.data.completed).toBe(true);
    expect(res.body.data.priority).toBe('low'); // untouched
  });

  test('rejects empty body and unknown fields', async () => {
    const c = await create({ title: 't' });
    const empty = await request(app).patch(`/api/todos/${c.body.data.id}`).send({});
    expect(empty.status).toBe(400);
    const unknown = await request(app).patch(`/api/todos/${c.body.data.id}`).send({ hacker: 1 });
    expect(unknown.status).toBe(400);
  });

  test('rejects invalid values on update', async () => {
    const c = await create({ title: 't' });
    const id = c.body.data.id;
    expect((await request(app).patch(`/api/todos/${id}`).send({ title: '' })).status).toBe(400);
    expect((await request(app).patch(`/api/todos/${id}`).send({ title: 'x'.repeat(201) })).status).toBe(400);
    expect((await request(app).patch(`/api/todos/${id}`).send({ priority: 'nope' })).status).toBe(400);
    expect((await request(app).patch(`/api/todos/${id}`).send({ dueDate: 'bad' })).status).toBe(400);
    expect((await request(app).patch(`/api/todos/${id}`).send({ completed: 'yes' })).status).toBe(400);
  });

  test('can clear dueDate back to null', async () => {
    const c = await create({ title: 't', dueDate: '2026-01-01T00:00:00.000Z' });
    const res = await request(app).patch(`/api/todos/${c.body.data.id}`).send({ dueDate: null });
    expect(res.status).toBe(200);
    expect(res.body.data.dueDate).toBeNull();
  });

  test('404 for nonexistent id, 400 for malformed id', async () => {
    const nf = await request(app).patch(`/api/todos/${new mongoose.Types.ObjectId()}`).send({ title: 'x' });
    expect(nf.status).toBe(404);
    const bad = await request(app).patch('/api/todos/nope').send({ title: 'x' });
    expect(bad.status).toBe(400);
  });
});

describe('PATCH /api/todos/:id/toggle', () => {
  test('flips completed back and forth', async () => {
    const c = await create({ title: 't' });
    const id = c.body.data.id;
    const t1 = await request(app).patch(`/api/todos/${id}/toggle`);
    expect(t1.body.data.completed).toBe(true);
    const t2 = await request(app).patch(`/api/todos/${id}/toggle`);
    expect(t2.body.data.completed).toBe(false);
  });

  test('404 for nonexistent, 400 for malformed', async () => {
    expect((await request(app).patch(`/api/todos/${new mongoose.Types.ObjectId()}/toggle`)).status).toBe(404);
    expect((await request(app).patch('/api/todos/bad/toggle')).status).toBe(400);
  });
});

describe('DELETE /api/todos/:id', () => {
  test('deletes and is then gone', async () => {
    const c = await create({ title: 'bye' });
    const id = c.body.data.id;
    const del = await request(app).delete(`/api/todos/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.data.id).toBe(id);
    expect((await request(app).get(`/api/todos/${id}`)).status).toBe(404);
  });

  test('second delete returns 404', async () => {
    const c = await create({ title: 'bye' });
    await request(app).delete(`/api/todos/${c.body.data.id}`);
    const again = await request(app).delete(`/api/todos/${c.body.data.id}`);
    expect(again.status).toBe(404);
  });

  test('400 for malformed id', async () => {
    const res = await request(app).delete('/api/todos/not-an-id');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/todos/completed & stats', () => {
  test('bulk delete removes only completed todos', async () => {
    await create({ title: 'a', completed: true });
    await create({ title: 'b', completed: true });
    await create({ title: 'c' });
    const res = await request(app).delete('/api/todos/completed');
    expect(res.status).toBe(200);
    expect(res.body.data.deletedCount).toBe(2);
    const list = await request(app).get('/api/todos');
    expect(list.body.data.map((t) => t.title)).toEqual(['c']);
  });

  test('bulk delete on empty completed set returns 0', async () => {
    await create({ title: 'a' });
    const res = await request(app).delete('/api/todos/completed');
    expect(res.body.data.deletedCount).toBe(0);
  });

  test('stats summary is accurate', async () => {
    await create({ title: 'overdue', dueDate: '2020-01-01T00:00:00.000Z' });
    await create({ title: 'done', completed: true });
    await create({ title: 'active' });
    const res = await request(app).get('/api/todos/stats/summary');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 3, completed: 1, active: 2, overdue: 1 });
  });

  test('special routes are not captured by :id', async () => {
    // "completed" and "stats" are valid 24-hex-char-safe strings? No — but
    // the route order test: these paths must resolve to their handlers,
    // not 400 INVALID_ID.
    const s = await request(app).get('/api/todos/stats/summary');
    expect(s.status).toBe(200);
    const d = await request(app).delete('/api/todos/completed');
    expect(d.status).toBe(200);
  });
});

describe('Concurrency & robustness', () => {
  test('handles 50 parallel creates', async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => create({ title: `parallel ${i}` }))
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(await Todo.countDocuments()).toBe(50);
  });

  test('concurrent toggles settle to a deterministic count', async () => {
    const c = await create({ title: 'race' });
    const id = c.body.data.id;
    // 10 toggles from false -> even flips -> false
    await Promise.all(Array.from({ length: 10 }, () => request(app).patch(`/api/todos/${id}/toggle`)));
    const final = await Todo.findById(id);
    expect(final.completed).toBe(false);
  });
});
