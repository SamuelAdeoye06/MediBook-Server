const express = require('express')
const router = express.Router()
const { getProfile, updateProfile, getCard, getCardPdf } = require('../controllers/patient.controller')
const { bookAppointment, getMyAppointments, cancelAppointment, rescheduleAppointment } = require('../controllers/appointment.controller')
const { protect, authorizeRoles } = require('../middleware/auth.middleware')

router.use(protect, authorizeRoles('patient'))

router.get('/profile', getProfile)
router.patch('/profile', updateProfile)
router.get('/card', getCard)
router.get('/card/pdf', getCardPdf)

router.post('/appointments', bookAppointment)
router.get('/appointments', getMyAppointments)
router.patch('/appointments/:id/cancel', cancelAppointment)
router.patch('/appointments/:id/reschedule', rescheduleAppointment)

module.exports = router
