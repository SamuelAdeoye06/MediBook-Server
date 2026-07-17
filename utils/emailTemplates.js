// Centralized email copy, styled to match the SIWESlog branded template
// pattern (dark header bar, card layout, accent color, footer).
// MediBook+ uses a teal/blue medical accent instead of SIWESlog's blue.

const BRAND_DARK = '#0B1620'   // header background
const ACCENT = '#0D9488'       // teal accent — buttons, highlights
const TEXT_MUTED = '#64748B'
const TEXT_DARK = '#0F172A'
const BORDER = '#E2E8F0'
const BG = '#F5F7FA'

// Shared wrapper so every email has identical structure — only the
// inner content changes per template. Keeps this file from repeating
// the same 20 lines of markup four times.
const wrapper = (innerHtml) => `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:${BG};font-family:Arial,sans-serif;">
    <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
      <div style="background:${BRAND_DARK};padding:28px 32px;">
        <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
          Medi<span style="color:${ACCENT};">Book+</span>
        </div>
      </div>
      <div style="padding:32px;">
        ${innerHtml}
      </div>
      <div style="padding:20px 32px;border-top:1px solid ${BORDER};font-size:12px;color:#94A3B8;text-align:center;">
        © ${new Date().getFullYear()} MediBook+. All rights reserved.
      </div>
    </div>
  </body>
  </html>
`

const button = (href, label) => `
  <a href="${href}"
     style="display:inline-block;background:${ACCENT};color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
    ${label}
  </a>
`

const welcomePatientEmail = (firstName, patientId) => ({
  subject: 'Welcome to MediBook+',
  html: wrapper(`
    <h2 style="font-size:22px;font-weight:800;color:${TEXT_DARK};margin:0 0 8px;">Welcome, ${firstName}!</h2>
    <p style="font-size:15px;color:${TEXT_MUTED};line-height:1.65;margin:0 0 20px;">
      Your patient account on MediBook+ has been created successfully.
    </p>
    <div style="background:#F8FAFC;border:2px dashed ${BORDER};border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
      <p style="font-size:12px;font-weight:700;color:${TEXT_MUTED};text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Your Patient ID</p>
      <p style="font-size:22px;font-weight:800;color:${TEXT_DARK};letter-spacing:2px;margin:0;">${patientId}</p>
    </div>
    <p style="font-size:15px;color:${TEXT_MUTED};line-height:1.65;margin:0 0 28px;">
      You can now log in, book appointments with our doctors, and view your digital patient card anytime.
    </p>
    ${button(`${process.env.CLIENT_URL}/login`, 'Sign In to MediBook+')}
  `)
})

const doctorApplicationReceivedEmail = (firstName) => ({
  subject: 'MediBook+ — Application Received',
  html: wrapper(`
    <h2 style="font-size:22px;font-weight:800;color:${TEXT_DARK};margin:0 0 8px;">Hi Dr. ${firstName},</h2>
    <p style="font-size:15px;color:${TEXT_MUTED};line-height:1.65;margin:0 0 20px;">
      Thanks for registering with MediBook+. Your account is currently pending review by our administrator.
    </p>
    <p style="font-size:15px;color:${TEXT_MUTED};line-height:1.65;margin:0;">
      You'll receive another email as soon as it's approved, and you'll be able to log in from then on.
    </p>
  `)
})

const doctorApprovedEmail = (firstName) => ({
  subject: 'MediBook+ — Your Account Has Been Approved',
  html: wrapper(`
    <h2 style="font-size:22px;font-weight:800;color:${TEXT_DARK};margin:0 0 8px;">Good news, Dr. ${firstName}!</h2>
    <p style="font-size:15px;color:${TEXT_MUTED};line-height:1.65;margin:0 0 28px;">
      Your MediBook+ account has been approved. You can now log in and start managing your appointment schedule.
    </p>
    ${button(`${process.env.CLIENT_URL}/login`, 'Sign In Now')}
  `)
})

const doctorRejectedEmail = (firstName) => ({
  subject: 'MediBook+ — Application Update',
  html: wrapper(`
    <h2 style="font-size:22px;font-weight:800;color:${TEXT_DARK};margin:0 0 8px;">Hi Dr. ${firstName},</h2>
    <p style="font-size:15px;color:${TEXT_MUTED};line-height:1.65;margin:0 0 20px;">
      Thanks for your interest in joining MediBook+. Unfortunately, your application was not approved at this time.
    </p>
    <p style="font-size:13px;color:#94A3B8;margin:0;">
      If you believe this was a mistake, please contact the hospital administrator directly.
    </p>
  `)
})

module.exports = {
  welcomePatientEmail,
  doctorApplicationReceivedEmail,
  doctorApprovedEmail,
  doctorRejectedEmail
}
