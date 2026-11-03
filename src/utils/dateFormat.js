// Dates in the admin portal: dd/mm/yyyy, 24-hour time, Cambodia time
// (Asia/Phnom_Penh) no matter where the browser is.
const TZ = 'Asia/Phnom_Penh'

const parts = (iso) => {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return null
  const out = {}
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).forEach(p => { out[p.type] = p.value })
  return out
}

export const formatDate = (iso) => {
  const p = parts(iso)
  return p ? `${p.day}/${p.month}/${p.year}` : ''
}

export const formatDateTime = (iso) => {
  const p = parts(iso)
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : ''
}

// "02/11 · 09:14" for tables where the year is clear from context.
export const formatShort = (iso) => {
  const p = parts(iso)
  return p ? `${p.day}/${p.month} · ${p.hour}:${p.minute}` : ''
}
