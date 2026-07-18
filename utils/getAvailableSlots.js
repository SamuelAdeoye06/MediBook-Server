const Doctor = require('../models/doctor.model')
const Appointment = require('../models/appointment.model')
const AppError = require('./AppError')
const { getDayName, generateSlots } = require('./timeSlots')

// Nigeria (Africa/Lagos) is a fixed UTC+1 year-round — no daylight
// saving to worry about — so this simple offset is safe and accurate.
const getTodayInLagos = () => {
  const nowLagos = new Date(Date.now() + 60 * 60 * 1000)
  return nowLagos.toISOString().slice(0, 10) // "YYYY-MM-DD"
}

// The single source of truth for "which time slots are actually free
// for this doctor on this date." Used by both the slots-lookup endpoint
// (so the frontend can render buttons) AND the booking endpoint itself
// (so we never trust the frontend's word for it — always re-check
// server-side before creating an appointment).
const getAvailableSlots = async (doctorId, dateStr) => {
  const today = getTodayInLagos()
  if (dateStr < today) {
    throw new AppError('You cannot view or book slots for a date that has already passed', 400, 'PAST_DATE')
  }

  const doctor = await Doctor.findOne({ _id: doctorId, status: 'active' })

  if (!doctor) {
    throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND')
  }

  const dayName = getDayName(dateStr)
  const dayEntry = doctor.availability.find(a => a.day === dayName)

  // Doctor simply doesn't work this day — not an error, just no slots.
  if (!dayEntry) {
    return { doctor, slots: [] }
  }

  const allSlots = generateSlots(dayEntry.startTime, dayEntry.endTime)

  const startOfDay = new Date(`${dateStr}T00:00:00Z`)
  const endOfDay = new Date(`${dateStr}T23:59:59Z`)

  const existingAppointments = await Appointment.find({
    doctorId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'confirmed'] } // only these block a slot
  }).select('timeSlot')

  const bookedSlots = new Set(existingAppointments.map(a => a.timeSlot))
  const freeSlots = allSlots.filter(slot => !bookedSlots.has(slot))

  return { doctor, slots: freeSlots }
}

module.exports = getAvailableSlots
