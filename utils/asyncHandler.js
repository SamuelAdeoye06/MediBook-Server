// Wraps an async controller so any thrown/rejected error is passed to
// Express's error handler automatically, instead of needing a
// try/catch in every single controller function.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = asyncHandler
