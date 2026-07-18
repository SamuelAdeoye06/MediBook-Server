const express = require('express')
const router = express.Router()
const { uploadPhoto, changePassword } = require('../controllers/account.controller')
const { protect } = require('../middleware/auth.middleware')
const upload = require('../middleware/upload.middleware')

// No authorizeRoles() here on purpose — photo and password belong to
// the base User model, so patient, doctor, and admin all use the same
// two endpoints instead of three separate copies.
router.use(protect)

router.patch('/photo', upload.single('photo'), uploadPhoto)
router.patch('/password', changePassword)

module.exports = router
