const Doctor = require('../models/doctor.model')
const Appointment = require('../models/appointment.model')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')
const sendMail = require('../utils/sendMail')
const { appointmentApprovedEmail, appointmentRejectedEmail } = require('../utils/emailTemplates')

const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/ // 24-hour HH:MM, e.g. "09:00", "14:30"

// Shared validation used by setAvailability below. Throws a clear
// AppError the moment something's wrong, rather than silently saving
// bad data.
const validateAvailability = (availability) => {
  if (!Array.isArray(availability)) {
    throw new AppError('Availability must be a list of schedule entries', 400, 'INVALID_AVAILABILITY')
  }

  for (const entry of availability) {
    if (!entry.day || !VALID_DAYS.includes(entry.day)) {
      throw new AppError(`"${entry.day}" is not a valid day`, 400, 'INVALID_DAY')
    }
    if (!TIME_REGEX.test(entry.startTime) || !TIME_REGEX.test(entry.endTime)) {
      throw new AppError('Times must be in 24-hour HH:MM format, e.g. "09:00"', 400, 'INVALID_TIME_FORMAT')
    }
    if (entry.startTime >= entry.endTime) {
      throw new AppError(`On ${entry.day}, start time must be before end time`, 400, 'INVALID_TIME_RANGE')
    }
  }

  // No two entries for the same day (avoids ambiguous/overlapping schedules)
  const days = availability.map(e => e.day)
  const hasDuplicateDay = new Set(days).size !== days.length
  if (hasDuplicateDay) {
    throw new AppError('Each day can only appear once — combine multiple time ranges under one entry if needed', 400, 'DUPLICATE_DAY')
  }
}

// @route  GET /api/doctor/availability
const getAvailability = asyncHandler(async (req, res) => {
  const doctor = await Doctor.findOne({ userId: req.user._id })

  if (!doctor) {
    throw new AppError('Doctor profile not found', 404, 'PROFILE_NOT_FOUND')
  }

  res.status(200).json({
    success: true,
    message: 'Availability retrieved',
    data: { availability: doctor.availability }
  })
})

// @route  PATCH /api/doctor/availability
// Replaces the doctor's entire availability list. To "unset" a day,
// just send the full list without that day included — simpler and
// less error-prone than separate add/remove endpoints.
const setAvailability = asyncHandler(async (req, res) => {
  const { availability } = req.body

  validateAvailability(availability || [])

  const doctor = await Doctor.findOneAndUpdate(
    { userId: req.user._id },
    { availability },
    { new: true, runValidators: true }
  )

  if (!doctor) {
    throw new AppError('Doctor profile not found', 404, 'PROFILE_NOT_FOUND')
  }

  res.status(200).json({
    success: true,
    message: 'Availability updated successfully',
    data: { availability: doctor.availability }
  })
})

const getOwnDoctor = async (userId) => {
  const doctor = await Doctor.findOne({ userId })
  if (!doctor) {
    throw new AppError('Doctor profile not found', 404, 'PROFILE_NOT_FOUND')
  }
  return doctor
}

// Appointment.date is stored as UTC midnight representing a calendar
// date — timeZone: 'UTC' here keeps the label matching that same date,
// instead of possibly shifting a day due to local timezone conversion.
const formatDateLabel = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  })
}

// @route  GET /api/doctor/appointments
// Query params: ?status=pending&page=1&limit=10
const getMyAppointments = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query
  const doctor = await getOwnDoctor(req.user._id)

  const filter = { doctorId: doctor._id }
  if (status) filter.status = status

  const skip = (Number(page) - 1) * Number(limit)

  const appointments = await Appointment.find(filter)
    .populate({ path: 'patientId', populate: { path: 'userId', select: 'firstName lastName phone email' } })
    .sort({ date: 1 })
    .skip(skip)
    .limit(Number(limit))

  const total = await Appointment.countDocuments(filter)

  res.status(200).json({
    success: true,
    message: 'Appointments retrieved',
    data: {
      appointments,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    }
  })
})

// @route  PATCH /api/doctor/appointments/:id/approve
const approveAppointment = asyncHandler(async (req, res) => {
  const doctor = await getOwnDoctor(req.user._id)

  const appointment = await Appointment.findOne({ _id: req.params.id, doctorId: doctor._id })
    .populate({ path: 'patientId', populate: { path: 'userId', select: 'firstName lastName email' } })

  if (!appointment) {
    throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND')
  }
  if (appointment.status !== 'pending') {
    throw new AppError(`This appointment is already ${appointment.status} and can't be approved`, 400, 'NOT_APPROVABLE')
  }

  appointment.status = 'confirmed'
  await appointment.save()

  try {
    const patientUser = appointment.patientId.userId
    const { subject, html } = appointmentApprovedEmail(
      patientUser.firstName,
      `${req.user.firstName} ${req.user.lastName}`,
      appointment.department,
      formatDateLabel(appointment.date),
      appointment.timeSlot
    )
    await sendMail({ to: patientUser.email, subject, html })
  } catch (err) {
    console.error('Failed to send appointment approval email:', err.message)
  }

  res.status(200).json({
    success: true,
    message: 'Appointment approved',
    data: { appointment }
  })
})

// @route  PATCH /api/doctor/appointments/:id/reject
const rejectAppointment = asyncHandler(async (req, res) => {
  const doctor = await getOwnDoctor(req.user._id)

  const appointment = await Appointment.findOne({ _id: req.params.id, doctorId: doctor._id })
    .populate({ path: 'patientId', populate: { path: 'userId', select: 'firstName lastName email' } })

  if (!appointment) {
    throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND')
  }
  if (appointment.status !== 'pending') {
    throw new AppError(`This appointment is already ${appointment.status} and can't be rejected`, 400, 'NOT_REJECTABLE')
  }

  appointment.status = 'rejected'
  if (req.body.reason) appointment.doctorNotes = req.body.reason
  await appointment.save()

  try {
    const patientUser = appointment.patientId.userId
    const { subject, html } = appointmentRejectedEmail(
      patientUser.firstName,
      `${req.user.firstName} ${req.user.lastName}`,
      formatDateLabel(appointment.date),
      appointment.timeSlot
    )
    await sendMail({ to: patientUser.email, subject, html })
  } catch (err) {
    console.error('Failed to send appointment rejection email:', err.message)
  }

  res.status(200).json({
    success: true,
    message: 'Appointment rejected',
    data: { appointment }
  })
})

module.exports = { getAvailability, setAvailability, getMyAppointments, approveAppointment, rejectAppointment }
