const User = require('../models/user.model')
const Patient = require('../models/patient.model')
const Doctor = require('../models/doctor.model')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')
const generateToken = require('../utils/generateToken')
const { DEPARTMENTS } = require('../utils/constants')
const sendMail = require('../utils/sendMail')
const { welcomePatientEmail, doctorApplicationReceivedEmail } = require('../utils/emailTemplates')

// @route  POST /api/auth/register/patient
const registerPatient = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phone, gender, dateOfBirth, bloodGroup, address, emergencyContact } = req.body

  if (!firstName || !lastName || !email || !password) {
    throw new AppError('First name, last name, email and password are required', 400, 'MISSING_FIELDS')
  }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) {
    throw new AppError('An account with this email already exists', 400, 'EMAIL_TAKEN')
  }

  const user = await User.create({
    firstName, lastName, email, password, phone, role: 'patient'
  })

  let patient
  try {
    patient = await Patient.create({
      userId: user._id,
      gender,
      dateOfBirth,
      bloodGroup,
      address,
      emergencyContact
    })
  } catch (err) {
    // Roll back the user if the patient profile fails to create,
    // so we never end up with a User that has no matching profile.
    await User.findByIdAndDelete(user._id)
    throw err
  }

  const token = generateToken(user)

  // Awaited before the response is sent — required on serverless hosts
  // like Vercel, which pause background work once a response goes out.
  // Wrapped so a mail failure never breaks account creation itself.
  try {
    const { subject, html } = welcomePatientEmail(user.firstName, patient.patientId)
    await sendMail({ to: user.email, subject, html })
  } catch (err) {
    console.error('Failed to send welcome email:', err.message)
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        patientId: patient.patientId
      }
    }
  })
})

// @route  POST /api/auth/register/doctor
const registerDoctor = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, phone, department, specialization } = req.body

  if (!firstName || !lastName || !email || !password || !department) {
    throw new AppError('First name, last name, email, password and department are required', 400, 'MISSING_FIELDS')
  }

  if (!DEPARTMENTS.includes(department)) {
    throw new AppError('That is not a valid department', 400, 'INVALID_DEPARTMENT')
  }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) {
    throw new AppError('An account with this email already exists', 400, 'EMAIL_TAKEN')
  }

  // approvalStatus is auto-set to 'pending' by the User model itself
  const user = await User.create({
    firstName, lastName, email, password, phone, role: 'doctor'
  })

  try {
    await Doctor.create({
      userId: user._id,
      department,
      specialization
    })
  } catch (err) {
    await User.findByIdAndDelete(user._id)
    throw err
  }

  try {
    const { subject, html } = doctorApplicationReceivedEmail(user.firstName)
    await sendMail({ to: user.email, subject, html })
  } catch (err) {
    console.error('Failed to send doctor application email:', err.message)
  }

  // No token issued — doctor can't log in until admin approves.
  res.status(201).json({
    success: true,
    message: 'Registration successful. Your account is pending admin approval — you will be able to log in once approved.',
    data: null
  })
})

// @route  POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    throw new AppError('Email and password are required', 400, 'MISSING_FIELDS')
  }

  const user = await User.findOne({ email: email.toLowerCase() })

  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Incorrect email or password', 401, 'INVALID_CREDENTIALS')
  }

  if (user.status !== 'active') {
    throw new AppError('This account has been deactivated. Contact the hospital administrator.', 403, 'ACCOUNT_DEACTIVATED')
  }

  if (user.role === 'doctor') {
    if (user.approvalStatus === 'pending') {
      throw new AppError('Your account is still awaiting admin approval', 403, 'DOCTOR_PENDING')
    }
    if (user.approvalStatus === 'rejected') {
      throw new AppError('Your doctor account application was not approved', 403, 'DOCTOR_REJECTED')
    }
  }

  const token = generateToken(user)

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    }
  })
})

// @route  GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = req.user // set by protect middleware
  let profile = null

  if (user.role === 'patient') {
    profile = await Patient.findOne({ userId: user._id })
  } else if (user.role === 'doctor') {
    profile = await Doctor.findOne({ userId: user._id })
  }

  res.status(200).json({
    success: true,
    message: 'Current user retrieved',
    data: {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        photo: user.photo,
        role: user.role
      },
      profile
    }
  })
})

// @route  POST /api/auth/logout
// Stateless JWT setup — logout is really just "frontend deletes the
// token from localStorage." This endpoint exists mainly so the
// frontend has something consistent to call.
const logout = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
    data: null
  })
})

module.exports = { registerPatient, registerDoctor, login, getMe, logout }
