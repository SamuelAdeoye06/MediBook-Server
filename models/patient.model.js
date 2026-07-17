const mongoose = require('mongoose')

const patientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  patientId: {
    type: String,
    unique: true
    // generated automatically before save, see below
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: null
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null],
    default: null
  },
  address: {
    type: String,
    default: ''
  },
  emergencyContact: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    relationship: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'deactivated'],
    default: 'active'
  }
}, { timestamps: true })

// Generates an ID like PT-2026-4F3A1B — year + random 6-char code.
// Retries on the rare chance of a collision.
//
// Note: this hook takes NO `next` parameter. It's declared `async`,
// and Mongoose runs async hooks by just waiting for the returned
// Promise to resolve — it does not also pass in a callback. Declaring
// `next` here would mean the function expects a callback that Mongoose
// never gives it, which is exactly the bug we hit ("next is not a
// function"). To exit early, we just `return` (no value needed).
patientSchema.pre('save', async function () {
  if (this.patientId) return

  const Patient = this.constructor
  const year = new Date().getFullYear()
  let id
  let exists = true

  while (exists) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    id = `PT-${year}-${random}`
    exists = await Patient.findOne({ patientId: id })
  }

  this.patientId = id
})

module.exports = mongoose.model('Patient', patientSchema)
