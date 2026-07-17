const express = require('express')
const router = express.Router()
const { registerPatient, registerDoctor, login, getMe, logout } = require('../controllers/auth.controller')
const { protect } = require('../middleware/auth.middleware')

router.post('/register/patient', registerPatient)
router.post('/register/doctor', registerDoctor)
router.post('/login', login)
router.post('/logout', logout)
router.get('/me', protect, getMe)

module.exports = router
