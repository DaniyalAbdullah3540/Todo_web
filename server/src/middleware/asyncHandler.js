/**
 * Wrap async route handlers so rejected promises reach the
 * centralized error handler instead of crashing the process.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
