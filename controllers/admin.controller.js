const User = require('../models/user.model')
const Doctor = require('../models/doctor.model')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')
const sendMail = require('../utils/sendMail')
const { doctorApprovedEmail, doctorRejectedEmail } = require('../utils/emailTemplates')

// @route  GET /api/admin/doctors
// Query params: ?status=pending | approved | rejected  &page=1&limit=10
const getDoctors = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query

  const userFilter = { role: 'doctor' }
  if (status) userFilter.approvalStatus = status

  const skip = (Number(page) - 1) * Number(limit)

  const users = await User.find(userFilter)
    .select('-password -refreshToken')
    .skip(skip)
    .limit(Number(limit))
    .sort({ createdAt: -1 })

  const total = await User.countDocuments(userFilter)

  // Attach each doctor's department/specialization from the Doctor collection
  const doctorProfiles = await Doctor.find({ userId: { $in: users.map(u => u._id) } })
  const merged = users.map(user => {
    const profile = doctorProfiles.find(d => d.userId.toString() === user._id.toString())
    return {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      approvalStatus: user.approvalStatus,
      status: user.status,
      createdAt: user.createdAt,
      department: profile?.department || null,
      specialization: profile?.specialization || null
    }
  })

  res.status(200).json({
    success: true,
    message: 'Doctors retrieved',
    data: {
      doctors: merged,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    }
  })
})

// @route  PATCH /api/admin/doctors/:id/approve
const approveDoctor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)

  if (!user || user.role !== 'doctor') {
    throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND')
  }

  if (user.approvalStatus === 'approved') {
    throw new AppError('This doctor is already approved', 400, 'ALREADY_APPROVED')
  }

  user.approvalStatus = 'approved'
  await user.save()

  try {
    const { subject, html } = doctorApprovedEmail(user.firstName)
    await sendMail({ to: user.email, subject, html })
  } catch (err) {
    console.error('Failed to send doctor approval email:', err.message)
  }

  res.status(200).json({
    success: true,
    message: `${user.firstName} ${user.lastName} has been approved and can now log in`,
    data: { id: user._id, approvalStatus: user.approvalStatus }
  })
})

// @route  PATCH /api/admin/doctors/:id/reject
const rejectDoctor = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)

  if (!user || user.role !== 'doctor') {
    throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND')
  }

  user.approvalStatus = 'rejected'
  await user.save()

  try {
    const { subject, html } = doctorRejectedEmail(user.firstName)
    await sendMail({ to: user.email, subject, html })
  } catch (err) {
    console.error('Failed to send doctor rejection email:', err.message)
  }

  res.status(200).json({
    success: true,
    message: `${user.firstName} ${user.lastName}'s application has been rejected`,
    data: { id: user._id, approvalStatus: user.approvalStatus }
  })
})

module.exports = { getDoctors, approveDoctor, rejectDoctor }
