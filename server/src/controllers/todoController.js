import { Todo } from '../models/Todo.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function buildFilter({ status, priority, search, tag, overdue }) {
  const filter = {};
  if (status === 'active') filter.completed = false;
  if (status === 'completed') filter.completed = true;
  if (priority) filter.priority = priority;
  if (tag) filter.tags = tag;
  if (overdue === 'true') {
    // "Overdue" is only meaningful for incomplete tasks.
    filter.completed = false;
    filter.dueDate = { $lt: new Date() };
  }
  if (search) {
    // Escape regex metacharacters so user input is treated literally.
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.title = { $regex: escaped, $options: 'i' };
  }
  return filter;
}

function buildSort(sort) {
  switch (sort) {
    case 'createdAt':
      return { createdAt: 1 };
    case '-createdAt':
      return { createdAt: -1 };
    case 'dueDate':
    case '-dueDate':
      // Handled via aggregation below so tasks without a due date sort last.
      return null;
    case 'title':
      return { title: 1 };
    case 'priority':
      // Custom rank sort handled in JS after fetch (small result sets).
      return null;
    default:
      return { createdAt: -1 };
  }
}

/**
 * Shape an aggregation doc like the schema's toJSON output
 * (_id -> id, drop __v and helper fields).
 */
function shapeDoc(doc) {
  const { _id, __v, __nullDue, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

/** GET /api/todos — list with filtering, search, sorting, pagination. */
export const listTodos = asyncHandler(async (req, res) => {
  const { status = 'all', priority, search, tag, sort, overdue } = req.query;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

  const filter = buildFilter({ status, priority, search, tag, overdue });
  const sortSpec = buildSort(sort);

  const total = await Todo.countDocuments(filter);

  let items;
  if (sort === 'dueDate' || sort === '-dueDate') {
    // MongoDB sorts null due dates first on ascending order; a to-do app
    // should surface dated tasks first, so nulls are pushed last explicitly.
    const dir = sort === 'dueDate' ? 1 : -1;
    const docs = await Todo.aggregate([
      { $match: filter },
      { $addFields: { __nullDue: { $cond: [{ $eq: ['$dueDate', null] }, 1, 0] } } },
      { $sort: { __nullDue: 1, dueDate: dir, createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]);
    items = docs.map(shapeDoc);
  } else {
    let query = Todo.find(filter);
    if (sortSpec) query = query.sort(sortSpec);
    items = await query.skip((page - 1) * limit).limit(limit);
  }

  if (sort === 'priority') {
    items = [...items].sort(
      (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt - a.createdAt
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  res.json({
    success: true,
    data: items,
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  });
});

/** GET /api/todos/:id — fetch a single todo. */
export const getTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findById(req.params.id);
  if (!todo) {
    const err = new Error('Todo not found');
    err.statusCode = 404;
    err.code = 'TODO_NOT_FOUND';
    throw err;
  }
  res.json({ success: true, data: todo });
});

/** POST /api/todos — create a todo. */
export const createTodo = asyncHandler(async (req, res) => {
  const { title, notes = '', completed = false, priority = 'medium', dueDate = null, tags = [] } = req.body;
  const todo = await Todo.create({
    title,
    notes,
    completed,
    priority,
    dueDate: dueDate === null ? null : new Date(dueDate),
    tags: Array.isArray(tags) ? [...new Set(tags.map((t) => t.trim()))] : [],
  });
  res.status(201).json({ success: true, data: todo });
});

/** PATCH /api/todos/:id — partial update. */
export const updateTodo = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  if (updates.dueDate !== undefined) {
    updates.dueDate = updates.dueDate === null ? null : new Date(updates.dueDate);
  }
  if (Array.isArray(updates.tags)) {
    updates.tags = [...new Set(updates.tags.map((t) => t.trim()))];
  }
  const todo = await Todo.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!todo) {
    const err = new Error('Todo not found');
    err.statusCode = 404;
    err.code = 'TODO_NOT_FOUND';
    throw err;
  }
  res.json({ success: true, data: todo });
});

/** PATCH /api/todos/:id/toggle — flip completed flag atomically. */
export const toggleTodo = asyncHandler(async (req, res) => {
  // A single atomic update: read-modify-write here would lose concurrent
  // toggles (last-writer-wins), so the flip happens inside MongoDB.
  const todo = await Todo.findOneAndUpdate(
    { _id: req.params.id },
    [{ $set: { completed: { $not: '$completed' } } }],
    { new: true }
  );
  if (!todo) {
    const err = new Error('Todo not found');
    err.statusCode = 404;
    err.code = 'TODO_NOT_FOUND';
    throw err;
  }
  res.json({ success: true, data: todo });
});

/** DELETE /api/todos/:id — delete a todo. */
export const deleteTodo = asyncHandler(async (req, res) => {
  const todo = await Todo.findByIdAndDelete(req.params.id);
  if (!todo) {
    const err = new Error('Todo not found');
    err.statusCode = 404;
    err.code = 'TODO_NOT_FOUND';
    throw err;
  }
  res.json({ success: true, data: { id: todo.id } });
});

/** DELETE /api/todos/completed — bulk-delete completed todos. */
export const deleteCompleted = asyncHandler(async (_req, res) => {
  const result = await Todo.deleteMany({ completed: true });
  res.json({ success: true, data: { deletedCount: result.deletedCount } });
});

/** GET /api/todos/stats/summary — counts for dashboard widgets. */
export const getStats = asyncHandler(async (_req, res) => {
  const [total, completed, overdue] = await Promise.all([
    Todo.countDocuments({}),
    Todo.countDocuments({ completed: true }),
    Todo.countDocuments({ completed: false, dueDate: { $lt: new Date(), $ne: null } }),
  ]);
  res.json({ success: true, data: { total, completed, active: total - completed, overdue } });
});
