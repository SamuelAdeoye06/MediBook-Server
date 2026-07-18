const Doctor = require('../models/doctor.model')
const User = require('../models/user.model')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')
const { DEPARTMENTS } = require('../utils/constants')
const getAvailableSlots = require('../utils/getAvailableSlots')

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

// @route  GET /api/departments
// Public — the doctor sign-up form needs this before anyone is logged in.
const getDepartments = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Departments retrieved',
    data: DEPARTMENTS
  })
})

// @route  GET /api/doctors
// Protected (any logged-in role) — used when a patient is booking, to
// pick a department then a doctor. Only shows doctors who are actually
// approved AND active, never pending/rejected/deactivated ones.
// Query params: ?department=Cardiology&page=1&limit=10
const getDoctors = asyncHandler(async (req, res) => {
  const { department, page = 1, limit = 10 } = req.query

  const doctorFilter = { status: 'active' }
  if (department) doctorFilter.department = department

  const skip = (Number(page) - 1) * Number(limit)

  const doctors = await Doctor.find(doctorFilter)
    .populate({
      path: 'userId',
      match: { approvalStatus: 'approved', status: 'active' },
      select: 'firstName lastName photo'
    })
    .skip(skip)
    .limit(Number(limit))
    .sort({ createdAt: -1 })

  // populate's `match` filters at the User level, but doesn't remove
  // the Doctor doc itself if the match fails — it just leaves userId
  // as null. So we filter those out here.
  const approvedDoctors = doctors.filter(d => d.userId !== null)

  const formatted = approvedDoctors.map(d => ({
    id: d._id,
    firstName: d.userId.firstName,
    lastName: d.userId.lastName,
    photo: d.userId.photo,
    department: d.department,
    specialization: d.specialization
  }))

  res.status(200).json({
    success: true,
    message: 'Doctors retrieved',
    data: {
      doctors: formatted,
      pagination: {
        page: Number(page),
        limit: Number(limit)
      }
    }
  })
})

// @route  GET /api/doctors/:id/slots?date=2026-07-20
// Protected — returns only the slots that are actually free, so the
// frontend just renders them as buttons with zero calculation needed.
const getDoctorSlots = asyncHandler(async (req, res) => {
  const { date } = req.query

  if (!date || !DATE_REGEX.test(date)) {
    throw new AppError('A valid date is required, format: YYYY-MM-DD', 400, 'INVALID_DATE')
  }

  const { slots } = await getAvailableSlots(req.params.id, date)

  res.status(200).json({
    success: true,
    message: 'Available slots retrieved',
    data: { date, slots }
  })
})

module.exports = { getDepartments, getDoctors, getDoctorSlots }
