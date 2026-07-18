const QRCode = require('qrcode')
const PDFDocument = require('pdfkit')
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

// @route  GET /api/patients/card/pdf?download=true
// Generates an actual card-SIZED PDF (CR80 / standard ID card
// dimensions — 3.375in x 2.125in, same physical size as a debit
// card), two pages: front (photo, name, ID, QR) and back (the rest
// of the details) — same way a real physical ID card has a front and
// back. Built with pdfkit (pure JS, no headless browser) so it runs
// reliably on Vercel's serverless functions.
//
// ?download=true forces a "Save As" prompt. Without it, the PDF opens
// inline, and the browser's own Print function covers printing.
const getCardPdf = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ userId: req.user._id })

  if (!patient) {
    throw new AppError('Patient profile not found', 404, 'PROFILE_NOT_FOUND')
  }

  // Gather everything BEFORE writing to the response — once the PDF
  // starts streaming, we can no longer send a clean JSON error.
  const qrPayload = `MEDIBOOK-PATIENT:${patient.patientId}`
  const qrBuffer = await QRCode.toBuffer(qrPayload)

  let photoBuffer = null
  if (req.user.photo) {
    try {
      const response = await fetch(req.user.photo)
      const arrayBuffer = await response.arrayBuffer()
      photoBuffer = Buffer.from(arrayBuffer)
    } catch (err) {
      console.error('Could not fetch patient photo for PDF card:', err.message)
    }
  }

  const formatDate = (date) => {
    if (!date) return 'Not provided'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
    })
  }

  const DARK = '#0B1620'
  const ACCENT = '#0D9488'
  const ACCENT_LIGHT = '#CCFBF1'
  const TEXT_MUTED = '#64748B'
  const TEXT_DARK = '#0F172A'
  const WHITE = '#FFFFFF'
  const ZEBRA = '#F8FAFC'

  // Standard CR80 ID card size, in PDF points (72 points = 1 inch)
  const CARD_WIDTH = 243   // 3.375in
  const CARD_HEIGHT = 153  // 2.125in
  const RADIUS = 10

  const filename = `${patient.patientId}-card.pdf`
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `${req.query.download ? 'attachment' : 'inline'}; filename="${filename}"`
  )

  const doc = new PDFDocument({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 })
  doc.pipe(res)

  // ══════════════════════ FRONT ══════════════════════
  doc.save()
  doc.roundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, RADIUS).clip()
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill(WHITE)

  // Top brand band
  doc.rect(0, 0, CARD_WIDTH, 32).fill(DARK)
  doc.fontSize(11).font('Helvetica-Bold').fillColor(WHITE)
    .text('Medi', 10, 9, { continued: true })
  doc.fillColor(ACCENT).text('Book+')
  doc.fontSize(5.5).font('Helvetica').fillColor('#94A3B8')
    .text('DIGITAL PATIENT CARD', 10, 22, { characterSpacing: 0.5 })

  // Photo with accent ring
  const photoSize = 46
  const photoX = 10
  const photoY = 42
  doc.save()
  doc.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2 + 2)
    .lineWidth(1.5).strokeColor(ACCENT).stroke()
  doc.restore()

  if (photoBuffer) {
    doc.save()
    doc.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2).clip()
    doc.image(photoBuffer, photoX, photoY, { width: photoSize, height: photoSize })
    doc.restore()
  } else {
    doc.save()
    doc.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2).fill('#E2E8F0')
    doc.restore()
  }

  // Name, patient ID, gender/DOB — next to photo
  const infoX = photoX + photoSize + 12
  doc.fontSize(10).font('Helvetica-Bold').fillColor(TEXT_DARK)
    .text(`${req.user.firstName} ${req.user.lastName}`, infoX, 44, { width: 90 })
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(ACCENT)
    .text(patient.patientId, infoX, 58)

  const genderDobLine = [patient.gender, formatDate(patient.dateOfBirth)]
    .filter(Boolean).join('  •  ')
  if (genderDobLine) {
    doc.fontSize(6.5).font('Helvetica').fillColor(TEXT_MUTED)
      .text(genderDobLine, infoX, 70, { width: 100 })
  }

  // Blood group badge (chip)
  if (patient.bloodGroup) {
    const badgeY = 84
    const badgeWidth = 34
    doc.roundedRect(infoX, badgeY, badgeWidth, 14, 7).fill(ACCENT_LIGHT)
    doc.fontSize(7).font('Helvetica-Bold').fillColor(ACCENT)
      .text(patient.bloodGroup, infoX, badgeY + 3.5, { width: badgeWidth, align: 'center' })
  }

  // QR code, bottom-right, with a soft white backing card
  const qrSize = 40
  const qrX = CARD_WIDTH - qrSize - 10
  const qrY = CARD_HEIGHT - qrSize - 14
  doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 4)
    .fillOpacity(1).fill(WHITE)
    .strokeColor('#E2E8F0').lineWidth(0.75).stroke()
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize })

  doc.fontSize(5).font('Helvetica').fillColor(TEXT_MUTED)
    .text('SCAN TO VERIFY', qrX - 4, qrY + qrSize + 6, { width: qrSize + 8, align: 'center', characterSpacing: 0.3 })

  // Bottom accent stripe
  doc.rect(0, CARD_HEIGHT - 4, CARD_WIDTH, 4).fill(ACCENT)

  doc.restore() // release the rounded-corner clip for this page

  // ══════════════════════ BACK ══════════════════════
  doc.addPage({ size: [CARD_WIDTH, CARD_HEIGHT], margin: 0 })
  doc.save()
  doc.roundedRect(0, 0, CARD_WIDTH, CARD_HEIGHT, RADIUS).clip()
  doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT).fill(WHITE)

  doc.rect(0, 0, CARD_WIDTH, 20).fill(DARK)
  doc.fontSize(7).font('Helvetica-Bold').fillColor(WHITE)
    .text('Medi', 10, 6, { continued: true })
  doc.fillColor(ACCENT).text('Book+', { continued: false })
  doc.fontSize(5.5).font('Helvetica').fillColor('#94A3B8')
    .text('PATIENT DETAILS', CARD_WIDTH - 90, 7.5, { width: 80, align: 'right', characterSpacing: 0.3 })

  let y = 26
  let rowIndex = 0
  const drawRow = (label, value) => {
    const text = `${label.toUpperCase()}:  ${value || 'Not provided'}`
    const height = Math.max(doc.heightOfString(text, { width: CARD_WIDTH - 20, fontSize: 6.5 }), 9)

    // Zebra striping — faint background on every other row, for scanability
    if (rowIndex % 2 === 0) {
      doc.rect(0, y - 2, CARD_WIDTH, height + 5).fill(ZEBRA)
    }

    doc.fontSize(6).font('Helvetica-Bold').fillColor(TEXT_MUTED)
      .text(`${label.toUpperCase()}:`, 10, y, { continued: true, width: CARD_WIDTH - 20 })
    doc.font('Helvetica').fillColor(TEXT_DARK)
      .text(` ${value || 'Not provided'}`)

    y += height + 5
    rowIndex += 1
  }

  drawRow('Phone', req.user.phone)
  drawRow('Email', req.user.email)
  drawRow('Address', patient.address)
  const emergency = patient.emergencyContact
  const emergencyLabel = emergency?.name
    ? `${emergency.name} (${emergency.relationship || 'N/A'}) - ${emergency.phone || 'N/A'}`
    : null
  drawRow('Emergency Contact', emergencyLabel)
  drawRow('Registered', formatDate(patient.createdAt))

  // Bottom accent stripe — matches front, for a "finished" consistent look
  doc.rect(0, CARD_HEIGHT - 4, CARD_WIDTH, 4).fill(ACCENT)

  doc.restore()
  doc.end()
})

module.exports = { getProfile, updateProfile, getCard, getCardPdf }
