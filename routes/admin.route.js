const express = require('express')
const router = express.Router()
const { getDoctors, approveDoctor, rejectDoctor } = require('../controllers/admin.controller')
const { protect, authorizeRoles } = require('../middleware/auth.middleware')

// Every route below requires a logged-in admin
router.use(protect, authorizeRoles('admin'))

router.get('/doctors', getDoctors)
router.patch('/doctors/:id/approve', approveDoctor)
router.patch('/doctors/:id/reject', rejectDoctor)

module.exports = router
