const mongoose = require('mongoose')

const appointmentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  department: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  timeSlot: {
    type: String, // e.g. "09:00 AM"
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'],
    default: 'pending'
  },
  reason: {
    type: String,
    default: ''
  },
  doctorNotes: {
    type: String,
    default: ''
  },
  // If this appointment was created by rescheduling another one,
  // this points back to the original (which gets marked 'cancelled').
  rescheduledFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  }
}, { timestamps: true })

// Safety net at the database level: the same doctor can't have two
// active (pending/confirmed) appointments in the same slot. The
// controller will also check this before creating, but this index
// guards against race conditions.
appointmentSchema.index(
  { doctorId: 1, date: 1, timeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } }
  }
)

module.exports = mongoose.model('Appointment', appointmentSchema)
