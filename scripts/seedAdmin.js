// One-time script to create the first Admin account.
// Run it once from your terminal: node scripts/seedAdmin.js
// It reads the admin's details from .env so the password never has
// to be typed in plain text into a chat, a script file, or committed
// to git.
//
// Add these to your .env before running:
//   ADMIN_FIRST_NAME=
//   ADMIN_LAST_NAME=
//   ADMIN_EMAIL=
//   ADMIN_PASSWORD=
//
// After it runs successfully, you can delete those ADMIN_* lines from
// .env if you like — they're only needed for this one script.

const dotenv = require('dotenv')
dotenv.config()
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const User = require('../models/user.model')

const run = async () => {
  const { ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env

  if (!ADMIN_FIRST_NAME || !ADMIN_LAST_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Missing ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_EMAIL, or ADMIN_PASSWORD in .env')
    process.exit(1)
  }

  await connectDB()

  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() })
  if (existing) {
    console.log(`An account with email ${ADMIN_EMAIL} already exists (role: ${existing.role}). No new admin created.`)
    process.exit(0)
  }

  const admin = await User.create({
    firstName: ADMIN_FIRST_NAME,
    lastName: ADMIN_LAST_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'admin'
  })

  console.log(`Admin account created successfully: ${admin.email}`)
  process.exit(0)
}

run().catch((err) => {
  console.error('Failed to seed admin:', err.message)
  process.exit(1)
})
