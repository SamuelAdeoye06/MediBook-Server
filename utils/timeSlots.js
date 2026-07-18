// Pure helper functions — no database access here, just date/time math.
// Kept separate from getAvailableSlots.js so these can be tested or
// reused without needing a DB connection.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Takes "2026-07-20" and returns "Monday". Uses UTC deliberately so the
// day-of-week never shifts due to server timezone — a date string alone
// has no timezone, so we treat it as a fixed UTC midnight consistently
// everywhere in the app.
const getDayName = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00Z`)
  return DAY_NAMES[date.getUTCDay()]
}

// "14:30" -> "02:30 PM"
const to12Hour = (time24) => {
  const [h, m] = time24.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
}

// Generates 30-minute slot labels between a start and end time.
// e.g. generateSlots("09:00", "10:30") -> ["09:00 AM", "09:30 AM", "10:00 AM"]
// (the end time itself is not included as a bookable slot)
const generateSlots = (startTime, endTime) => {
  const slots = []
  let [h, m] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)

  while (h < endH || (h === endH && m < endM)) {
    const label = to12Hour(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    slots.push(label)
    m += 30
    if (m >= 60) {
      m -= 60
      h += 1
    }
  }

  return slots
}

module.exports = { getDayName, generateSlots, to12Hour }
