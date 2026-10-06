// Vercel serverless entry point: runs the Express API as a serverless function.
// The MongoDB connection is established lazily on cold start and reused
// across warm invocations via Mongoose's cached connection.
import { createApp } from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      await connectDB(process.env.MONGODB_URI);
      return createApp();
    })();
    // If the connection fails, allow a retry on the next invocation
    // instead of caching a rejected promise forever.
    appPromise.catch(() => {
      appPromise = null;
    });
  }
  return appPromise;
}

export default async function handler(req, res) {
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('API startup failed:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'STARTUP_ERROR', message: 'API failed to start (check MONGODB_URI)' },
    });
  }
}
