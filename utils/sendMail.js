const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS // must be a Gmail App Password, not your login password
  }
})

// Single point of contact for sending mail across the whole app.
// If we switch providers later (e.g. to Resend once a domain is
// bought), only this file needs to change — no controller does.
const sendMail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"MediBook+" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html
  })
}

module.exports = sendMail
