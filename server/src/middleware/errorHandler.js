import mongoose from 'mongoose';

/**
 * 404 handler for unknown routes.
 */
export function notFound(_req, res, _next) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
}

/**
 * Centralized error handler. Normalizes Mongoose, validation and
 * operational errors into a consistent JSON envelope. Never leaks
 * stack traces outside of development.
 */
export function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong';

  if (err.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = `Invalid id format: ${err.value}`;
  } else if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE_KEY';
    message = 'Duplicate value for a unique field';
  } else if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body contains invalid JSON';
  }

  const payload = { success: false, error: { code, message } };
  if (process.env.NODE_ENV === 'development' && err.stack) {
    payload.error.stack = err.stack;
  }
  res.status(status).json(payload);
}
