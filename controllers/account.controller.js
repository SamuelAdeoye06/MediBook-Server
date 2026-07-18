const User = require('../models/user.model')
const asyncHandler = require('../utils/asyncHandler')
const AppError = require('../utils/AppError')

// @route  PATCH /api/account/photo
// Any logged-in role. multer + Cloudinary storage already handled the
// upload before this runs — req.file.path is the final Cloudinary URL.
const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No photo file was received', 400, 'NO_FILE')
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { photo: req.file.path },
    { new: true }
  ).select('-password -refreshToken')

  res.status(200).json({
    success: true,
    message: 'Photo updated successfully',
    data: { photo: user.photo }
  })
})

// @route  PATCH /api/account/password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are both required', 400, 'MISSING_FIELDS')
  }

  const user = await User.findById(req.user._id)

  if (!(await user.matchPassword(currentPassword))) {
    throw new AppError('Current password is incorrect', 401, 'INCORRECT_PASSWORD')
  }

  // Schema validation (length + regex strength rule) runs automatically
  // on save, same as at registration.
  user.password = newPassword
  await user.save()

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
    data: null
  })
})

module.exports = { uploadPhoto, changePassword }
