const express = require('express')
const router = express.Router()
const { getDepartments, getDoctors, getDoctorSlots } = require('../controllers/lookup.controller')
const { protect } = require('../middleware/auth.middleware')

// Public — needed on the doctor sign-up form before login exists
router.get('/departments', getDepartments)

// Protected — any logged-in role can browse doctors (mainly patients booking)
router.get('/doctors', protect, getDoctors)
router.get('/doctors/:id/slots', protect, getDoctorSlots)

module.exports = router
