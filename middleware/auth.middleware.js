const jwt = require('jsonwebtoken')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')
const User = require('../models/user.model')

// Verifies the JWT sent in the Authorization header and attaches the
// current user to req.user. Also re-checks status/approval on every
// request, so a deactivated account or a rejected doctor is blocked
// immediately, even if their token hasn't expired yet.
const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('You must be logged in to do this', 401, 'NOT_LOGGED_IN')
  }

  const token = authHeader.split(' ')[1]

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
  } catch (err) {
    throw new AppError('Your session has expired, please log in again', 401, 'INVALID_TOKEN')
  }

  const user = await User.findById(decoded.id).select('-password -refreshToken')

  if (!user) {
    throw new AppError('Account no longer exists', 401, 'USER_NOT_FOUND')
  }

  if (user.status !== 'active') {
    throw new AppError('This account has been deactivated', 403, 'ACCOUNT_DEACTIVATED')
  }

  if (user.role === 'doctor' && user.approvalStatus !== 'approved') {
    throw new AppError('Your doctor account is not yet approved', 403, 'DOCTOR_NOT_APPROVED')
  }

  req.user = user
  next()
})

// Usage: authorizeRoles('admin') or authorizeRoles('doctor', 'admin')
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new AppError('You do not have permission to do this', 403, 'FORBIDDEN')
    }
    next()
  }
}

module.exports = { protect, authorizeRoles }
