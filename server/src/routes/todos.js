import { Router } from 'express';
import {
  listTodos,
  getTodo,
  createTodo,
  updateTodo,
  toggleTodo,
  deleteTodo,
  deleteCompleted,
  getStats,
} from '../controllers/todoController.js';
import { validateCreate, validateUpdate, validateObjectId, validateList } from '../middleware/validators.js';

const router = Router();

// Static/special paths MUST come before `/:id` so they are not
// swallowed by the id parameter route.
router.get('/stats/summary', getStats);
router.delete('/completed', deleteCompleted);

router.route('/').get(validateList, listTodos).post(validateCreate, createTodo);

router.route('/:id').get(validateObjectId, getTodo).patch(validateUpdate, updateTodo).delete(validateObjectId, deleteTodo);

router.patch('/:id/toggle', validateObjectId, toggleTodo);

export default router;
