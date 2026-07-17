// Lets controllers throw an error with a specific HTTP status and a
// machine-readable code, e.g:
//   throw new AppError('Email already registered', 400, 'EMAIL_TAKEN')
// The global error handler in server.js knows how to read these.
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

module.exports = AppError
