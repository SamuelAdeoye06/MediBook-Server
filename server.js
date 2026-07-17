const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const hpp = require('hpp')
const connectDB = require('./config/db')

dotenv.config()
connectDB().catch(() => {
  // Errors are already logged inside connectDB. This catch just
  // prevents an "unhandled promise rejection" warning — on Vercel,
  // the real failure will surface per-request when a route tries to
  // use the database and finds no connection.
})

const app = express()

// Trust first proxy hop (needed once deployed behind Railway/Render/etc,
// harmless locally). Without this, rate limiting can't correctly identify
// unique clients behind a reverse proxy.
app.set('trust proxy', 1)

// ── CORS ──
// Covers both ways the frontend dev might be running things locally:
// - VS Code Live Server -> http://127.0.0.1:5500 (and nearby ports if 5500 is busy)
// - npm run dev (Vite, etc.) -> http://localhost:5173
// Also covers our own local testing.
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
  'http://127.0.0.1:5502',
  'http://localhost:5500',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // requests with no origin (like Thunder Client, Postman, curl) are allowed
    if (!origin) return callback(null, true)
    const isAllowed = allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')
    if (isAllowed) {
      callback(null, true)
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`))
    }
  },
  credentials: true
}))

// Security headers
app.use(helmet())

// Prevent HTTP parameter pollution
app.use(hpp())

// ── RATE LIMITING ──
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'You are sending requests too quickly. Please wait a few minutes and try again.',
    code: 'RATE_LIMITED'
  }
})
app.use('/api', limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please wait 15 minutes before trying again.',
    code: 'AUTH_RATE_LIMITED'
  }
})
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)

app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())

// Manual NoSQL injection + XSS protection
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key]
        } else if (typeof obj[key] === 'string') {
          obj[key] = obj[key]
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
        } else {
          sanitize(obj[key])
        }
      })
    }
  }
  if (req.body) sanitize(req.body)
  next()
})

// ── ROUTES ──
const authRoutes = require('./routes/auth.route')
app.use('/api/auth', authRoutes)

const adminRoutes = require('./routes/admin.route')
app.use('/api/admin', adminRoutes)

// (uncomment as each module gets built)
// const patientRoutes = require('./routes/patient.route')
// app.use('/api/patients', patientRoutes)

app.get('/', (req, res) => {
  res.json({ success: true, message: 'MediBook+ API is running', data: null })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', code: 'NOT_FOUND' })
})

// Global error handler (catches anything thrown/passed to next(err))
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Something went wrong on our end',
    code: err.code || 'SERVER_ERROR'
  })
})

const PORT = process.env.PORT || 5000

// Vercel runs this file as a serverless function and calls the
// exported app directly — it does NOT need (or want) app.listen().
// Locally and on Railway, VERCEL is undefined, so this runs like a
// normal persistent server, same as before.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

module.exports = app
