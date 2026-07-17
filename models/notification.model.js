const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'appointment_approved',
      'appointment_rejected',
      'appointment_cancelled',
      'appointment_rescheduled',
      'appointment_reminder',
      'doctor_account_approved',
      'doctor_account_rejected'
    ],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  link: {
    type: String,
    default: ''
  },
  read: {
    type: Boolean,
    default: false
  }
}, { timestamps: true })

module.exports = mongoose.model('Notification', notificationSchema)
