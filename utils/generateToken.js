const jwt = require('jsonwebtoken')

// Single token, 30-day expiry. Simpler than an access+refresh pair —
// the frontend just stores this in localStorage and sends it as
// Authorization: Bearer <token> on every request. Matches the
// client's own instruction to keep auth simple for the hackathon.
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '30d' }
  )
}

module.exports = generateToken
