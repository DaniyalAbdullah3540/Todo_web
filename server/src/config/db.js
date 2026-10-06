import mongoose from 'mongoose';

/**
 * Connect to MongoDB with sensible production defaults.
 * Retries are left to the process supervisor; a failed initial
 * connection is fatal so misconfiguration surfaces loudly.
 */
export async function connectDB(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  mongoose.set('strictQuery', true);
  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  return conn;
}
