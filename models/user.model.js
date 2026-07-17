const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: [8, 'Password must be at least 8 characters long'],
    validate: {
      validator: function (value) {
        // At least one uppercase, one lowercase, one number, one special character
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=]).{8,}$/.test(value)
      },
      message: 'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character'
    }
  },
  phone: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['patient', 'doctor', 'admin'],
    required: true
  },
  photo: {
    type: String,
    default: ''
  },
  // Patients & admins are usable immediately. Doctors self-register but
  // can't log in until an admin approves them.
  approvalStatus: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
    default: 'approved'
  },
  // Soft-delete style status — records are never hard-deleted so
  // appointment history stays intact.
  status: {
    type: String,
    enum: ['active', 'inactive', 'deactivated'],
    default: 'active'
  },
  refreshToken: {
    type: String,
    default: ''
  }
}, { timestamps: true })

// Doctors need admin approval before they can log in; everyone else
// is approved by default. Also hashes the password before saving.
// Merged into one async hook (no `next` param) — declaring `next` as
// a parameter makes Mongoose treat this as callback-style middleware,
// which isn't being invoked correctly in this project's Mongoose
// version and throws "next is not a function". Async-without-next
// avoids that entirely.
userSchema.pre('save', async function () {
  if (this.isNew && this.role === 'doctor') {
    this.approvalStatus = 'pending'
  }

  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
  }
})

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

module.exports = mongoose.model('User', userSchema)
