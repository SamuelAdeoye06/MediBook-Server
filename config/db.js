const mongoose = require('mongoose')

// On Vercel, this file can be re-invoked across many short-lived
// serverless function calls. Without caching, each request could try
// to open a brand new MongoDB connection, quickly exhausting Atlas's
// connection limit. Caching the connection on `global` means warm
// invocations of the same function instance reuse the existing
// connection instead of creating a new one.
let cached = global._mongooseConn
if (!cached) {
  cached = global._mongooseConn = { conn: null, promise: null }
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI).then((mongooseInstance) => {
      console.log(`MongoDB connected: ${mongooseInstance.connection.host}`)
      return mongooseInstance
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (error) {
    cached.promise = null // allow retry on next call instead of staying broken
    console.error(`MongoDB connection failed: ${error.message}`)
    // Locally/Railway: fail loudly and immediately, like before.
    // On Vercel: never process.exit inside a serverless function —
    // just let the error bubble up so that one request fails cleanly
    // instead of taking down the whole function runtime.
    if (!process.env.VERCEL) {
      process.exit(1)
    }
    throw error
  }

  return cached.conn
}

module.exports = connectDB
