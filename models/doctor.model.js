const mongoose = require('mongoose')
const { DEPARTMENTS } = require('../utils/constants')

// One entry per day the doctor works. Slots are generated on the fly
// from startTime/endTime (every 30 mins) when the frontend asks for
// available slots — we don't pre-generate and store every slot.
const availabilitySchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true
  },
  startTime: { type: String, required: true }, // e.g. "09:00"
  endTime: { type: String, required: true }    // e.g. "12:00"
}, { _id: false })

const doctorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  department: {
    type: String,
    enum: DEPARTMENTS,
    required: true
  },
  specialization: {
    type: String,
    default: ''
  },
  availability: {
    type: [availabilitySchema],
    default: []
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'deactivated'],
    default: 'active'
  }
}, { timestamps: true })

module.exports = mongoose.model('Doctor', doctorSchema)
