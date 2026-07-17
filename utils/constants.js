// Single source of truth for departments. Served to the frontend via
// GET /api/departments so nothing is hardcoded on their end.
// If this ever needs to become fully dynamic (admin adding/removing
// departments), this can be upgraded to its own Mongo collection later
// without changing how Doctor.department is used elsewhere.
const DEPARTMENTS = [
  'General Medicine',
  'Cardiology',
  'Dentistry',
  'Pediatrics',
  'Orthopedics',
  'Eye Clinic',
  'ENT',
  'Neurology',
  'Dermatology'
]

module.exports = { DEPARTMENTS }
