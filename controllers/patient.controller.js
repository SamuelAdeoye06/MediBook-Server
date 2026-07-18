const QRCode = require('qrcode')
const User = require('../models/user.model')
const Patient = require('../models/patient.model')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')

// @route  GET /api/patients/profile
const getProfile = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ userId: req.user._id })

  if (!patient) {
    throw new AppError('Patient profile not found', 404, 'PROFILE_NOT_FOUND')
  }

  res.status(200).json({
    success: true,
    message: 'Profile retrieved',
    data: {
      user: {
        id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        phone: req.user.phone,
        photo: req.user.photo
      },
      profile: patient
    }
  })
})

// @route  PATCH /api/patients/profile
// Only allows updating fields that make sense for a patient to self-edit.
// Email is intentionally NOT editable here — changing it risks login
// issues and isn't something the brief asked for.
const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, gender, dateOfBirth, bloodGroup, address, emergencyContact } = req.body

  const userUpdates = {}
  if (firstName !== undefined) userUpdates.firstName = firstName
  if (lastName !== undefined) userUpdates.lastName = lastName
  if (phone !== undefined) userUpdates.phone = phone

  if (Object.keys(userUpdates).length > 0) {
    await User.findByIdAndUpdate(req.user._id, userUpdates, { runValidators: true })
  }

  const patientUpdates = {}
  if (gender !== undefined) patientUpdates.gender = gender
  if (dateOfBirth !== undefined) patientUpdates.dateOfBirth = dateOfBirth
  if (bloodGroup !== undefined) patientUpdates.bloodGroup = bloodGroup
  if (address !== undefined) patientUpdates.address = address
  if (emergencyContact !== undefined) patientUpdates.emergencyContact = emergencyContact

  const patient = await Patient.findOneAndUpdate(
    { userId: req.user._id },
    patientUpdates,
    { new: true, runValidators: true }
  )

  if (!patient) {
    throw new AppError('Patient profile not found', 404, 'PROFILE_NOT_FOUND')
  }

  const updatedUser = await User.findById(req.user._id).select('-password -refreshToken')

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        photo: updatedUser.photo
      },
      profile: patient
    }
  })
})

// @route  GET /api/patients/card
// Returns everything needed to render the digital patient card,
// including a ready-to-display QR code as a base64 image — the
// frontend just drops it straight into an <img src="..."> tag,
// no QR library needed on their end.
const getCard = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ userId: req.user._id })

  if (!patient) {
    throw new AppError('Patient profile not found', 404, 'PROFILE_NOT_FOUND')
  }

  const qrPayload = `MEDIBOOK-PATIENT:${patient.patientId}`
  const qrCodeDataUrl = await QRCode.toDataURL(qrPayload)

  res.status(200).json({
    success: true,
    message: 'Patient card retrieved',
    data: {
      patientId: patient.patientId,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      photo: req.user.photo,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth,
      bloodGroup: patient.bloodGroup,
      phone: req.user.phone,
      email: req.user.email,
      address: patient.address,
      emergencyContact: patient.emergencyContact,
      registrationDate: patient.createdAt,
      qrCode: qrCodeDataUrl
    }
  })
})

module.exports = { getProfile, updateProfile, getCard }
