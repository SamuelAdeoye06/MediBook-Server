const express = require('express')
const router = express.Router()
const { getAvailability, setAvailability, getMyAppointments, approveAppointment, rejectAppointment } = require('../controllers/doctor.controller')
const { protect, authorizeRoles } = require('../middleware/auth.middleware')

router.use(protect, authorizeRoles('doctor'))

router.get('/availability', getAvailability)
router.patch('/availability', setAvailability)

router.get('/appointments', getMyAppointments)
router.patch('/appointments/:id/approve', approveAppointment)
router.patch('/appointments/:id/reject', rejectAppointment)

module.exports = router
