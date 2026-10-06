import { body, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { MAX_TITLE_LENGTH, MAX_NOTES_LENGTH } from '../models/Todo.js';

/**
 * Reject malformed ObjectIds with a precise INVALID_ID error before the
 * controllers run. Registered after the static routes (`/stats/summary`,
 * `/completed`) so those paths never reach this check.
 */
export function validateObjectId(req, _res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    const err = new Error(`Invalid id format: ${req.params.id}`);
    err.statusCode = 400;
    err.code = 'INVALID_ID';
    return next(err);
  }
  return next();
}

const titleRule = body('title')
  .exists({ checkNull: true })
  .withMessage('title is required')
  .isString()
  .withMessage('title must be a string')
  .trim()
  .notEmpty()
  .withMessage('title cannot be empty')
  .isLength({ max: MAX_TITLE_LENGTH })
  .withMessage(`title cannot exceed ${MAX_TITLE_LENGTH} characters`);

const notesRule = body('notes')
  .optional({ nullable: true })
  .isString()
  .withMessage('notes must be a string')
  .trim()
  .isLength({ max: MAX_NOTES_LENGTH })
  .withMessage(`notes cannot exceed ${MAX_NOTES_LENGTH} characters`);

const completedRule = body('completed')
  .optional()
  .isBoolean({ strict: true })
  .withMessage('completed must be a boolean');

const priorityRule = body('priority')
  .optional()
  .isIn(['low', 'medium', 'high'])
  .withMessage('priority must be one of: low, medium, high');

const dueDateRule = body('dueDate')
  .optional({ nullable: true })
  .custom((value) => {
    if (value === null) return true;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw new Error('dueDate must be a valid ISO-8601 date');
    return true;
  });

const tagsRule = body('tags')
  .optional({ nullable: true })
  .isArray({ max: 20 })
  .withMessage('tags must be an array of at most 20 items')
  .custom((tags) => {
    if (!tags.every((t) => typeof t === 'string' && t.trim().length > 0 && t.trim().length <= 30)) {
      throw new Error('each tag must be a non-empty string of at most 30 characters');
    }
    return true;
  });

export const validateCreate = [
  titleRule,
  notesRule,
  completedRule,
  priorityRule,
  dueDateRule,
  tagsRule,
  checkValidation,
];

export const validateUpdate = [
  validateObjectId,
  body('title').optional().isString().withMessage('title must be a string').trim().notEmpty().withMessage('title cannot be empty')
    .isLength({ max: MAX_TITLE_LENGTH }).withMessage(`title cannot exceed ${MAX_TITLE_LENGTH} characters`),
  notesRule,
  completedRule,
  priorityRule,
  dueDateRule,
  tagsRule,
  body().custom((value) => {
    const allowed = ['title', 'notes', 'completed', 'priority', 'dueDate', 'tags'];
    const unknown = Object.keys(value || {}).filter((k) => !allowed.includes(k));
    if (unknown.length > 0) throw new Error(`Unknown field(s): ${unknown.join(', ')}`);
    if (Object.keys(value || {}).length === 0) throw new Error('At least one field must be provided');
    return true;
  }),
  checkValidation,
];

export const validateList = [
  query('status').optional().isIn(['all', 'active', 'completed']).withMessage('status must be all, active or completed'),
  query('priority').optional().isIn(['low', 'medium', 'high']).withMessage('priority must be low, medium or high'),
  query('search').optional().isString().withMessage('search must be a string').trim()
    .isLength({ max: 100 }).withMessage('search cannot exceed 100 characters'),
  query('tag').optional().isString().withMessage('tag must be a string').trim()
    .isLength({ max: 30 }).withMessage('tag cannot exceed 30 characters'),
  query('sort').optional().isIn(['createdAt', '-createdAt', 'dueDate', '-dueDate', 'priority', 'title'])
    .withMessage('invalid sort field'),
  query('page').optional().isInt({ min: 1, max: 100000 }).withMessage('page must be an integer >= 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be an integer between 1 and 100').toInt(),
  checkValidation,
];

function checkValidation(req, _res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error(errors.array().map((e) => e.msg).join('; '));
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    return next(err);
  }
  return next();
}
