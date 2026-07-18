const mongoose = require('mongoose')
const Patient = require('../models/patient.model')
const Appointment = require('../models/appointment.model')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')
const getAvailableSlots = require('../utils/getAvailableSlots')

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const getOwnPatientId = async (userId) => {
  const patient = await Patient.findOne({ userId })
  if (!patient) {
    throw new AppError('Patient profile not found', 404, 'PROFILE_NOT_FOUND')
  }
  return patient
}

// @route  POST /api/patients/appointments
const bookAppointment = asyncHandler(async (req, res) => {
  const { doctorId, date, timeSlot, reason } = req.body

  if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
    throw new AppError('A valid doctorId is required', 400, 'INVALID_DOCTOR_ID')
  }
  if (!date || !DATE_REGEX.test(date)) {
    throw new AppError('A valid date is required, format: YYYY-MM-DD', 400, 'INVALID_DATE')
  }
  if (!timeSlot) {
    throw new AppError('A timeSlot is required', 400, 'MISSING_TIME_SLOT')
  }

  const patient = await getOwnPatientId(req.user._id)
  const { doctor, slots } = await getAvailableSlots(doctorId, date)

  if (!slots.includes(timeSlot)) {
    throw new AppError('That time slot is no longer available. Please choose another.', 400, 'SLOT_TAKEN')
  }

  let appointment
  try {
    appointment = await Appointment.create({
      patientId: patient._id,
      doctorId,
      department: doctor.department,
      date: new Date(`${date}T00:00:00Z`),
      timeSlot,
      reason: reason || ''
    })
  } catch (err) {
    // Safety net: our DB index also blocks this same slot being taken
    // twice, in case two people booked in the same instant.
    if (err.code === 11000) {
      throw new AppError('That time slot was just taken by someone else. Please choose another.', 400, 'SLOT_TAKEN')
    }
    throw err
  }

  res.status(201).json({
    success: true,
    message: 'Appointment booked successfully and is pending doctor approval',
    data: { appointment }
  })
})

// @route  GET /api/patients/appointments
// Query params: ?status=pending&page=1&limit=10
const getMyAppointments = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query
  const patient = await getOwnPatientId(req.user._id)

  const filter = { patientId: patient._id }
  if (status) filter.status = status

  const skip = (Number(page) - 1) * Number(limit)

  const appointments = await Appointment.find(filter)
    .populate({ path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName' } })
    .sort({ date: -1, createdAt: -1 })
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

// @route  PATCH /api/patients/appointments/:id/cancel
const cancelAppointment = asyncHandler(async (req, res) => {
  const patient = await getOwnPatientId(req.user._id)

  const appointment = await Appointment.findOne({ _id: req.params.id, patientId: patient._id })

  if (!appointment) {
    throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND')
  }

  if (!['pending', 'confirmed'].includes(appointment.status)) {
    throw new AppError(`This appointment is already ${appointment.status} and can't be cancelled`, 400, 'NOT_CANCELLABLE')
  }

  appointment.status = 'cancelled'
  await appointment.save()

  res.status(200).json({
    success: true,
    message: 'Appointment cancelled successfully',
    data: { appointment }
  })
})

// @route  PATCH /api/patients/appointments/:id/reschedule
// Body: { date, timeSlot } — the NEW date/time. Creates a fresh
// appointment and cancels the old one, keeping history clean.
const rescheduleAppointment = asyncHandler(async (req, res) => {
  const { date, timeSlot } = req.body

  if (!date || !DATE_REGEX.test(date)) {
    throw new AppError('A valid date is required, format: YYYY-MM-DD', 400, 'INVALID_DATE')
  }
  if (!timeSlot) {
    throw new AppError('A timeSlot is required', 400, 'MISSING_TIME_SLOT')
  }

  const patient = await getOwnPatientId(req.user._id)
  const original = await Appointment.findOne({ _id: req.params.id, patientId: patient._id })

  if (!original) {
    throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND')
  }
  if (!['pending', 'confirmed'].includes(original.status)) {
    throw new AppError(`This appointment is already ${original.status} and can't be rescheduled`, 400, 'NOT_RESCHEDULABLE')
  }

  const { doctor, slots } = await getAvailableSlots(original.doctorId, date)

  if (!slots.includes(timeSlot)) {
    throw new AppError('That time slot is not available. Please choose another.', 400, 'SLOT_TAKEN')
  }

  let newAppointment
  try {
    newAppointment = await Appointment.create({
      patientId: patient._id,
      doctorId: original.doctorId,
      department: doctor.department,
      date: new Date(`${date}T00:00:00Z`),
      timeSlot,
      reason: original.reason,
      rescheduledFrom: original._id
    })
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError('That time slot was just taken by someone else. Please choose another.', 400, 'SLOT_TAKEN')
    }
    throw err
  }

  original.status = 'cancelled'
  await original.save()

  res.status(201).json({
    success: true,
    message: 'Appointment rescheduled successfully and is pending doctor approval',
    data: { appointment: newAppointment }
  })
})

module.exports = { bookAppointment, getMyAppointments, cancelAppointment, rescheduleAppointment }
