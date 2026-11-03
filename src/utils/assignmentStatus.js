// What a teacher should see for an assignment, worked out from its fields.
//   draft     not published yet
//   scheduled published, but students see it only from opens_at
//   open      published, due date far off or none
//   due-soon  published, due in under 24 hours
//   closed    due date passed, or the teacher closed it
const DAY = 24 * 60 * 60 * 1000

export const statusOf = (a, now = Date.now()) => {
  if (a.status !== 'published') return 'draft'
  if (a.closed_at) return 'closed'
  if (a.opens_at && new Date(a.opens_at).getTime() > now) return 'scheduled'
  const due = a.due_date ? new Date(a.due_date).getTime() : null
  if (due !== null && due < now) return 'closed'
  if (due !== null && due - now < DAY) return 'due-soon'
  return 'open'
}

export const STATUS_LABEL = { draft: 'Draft', scheduled: 'Scheduled', open: 'Open', 'due-soon': 'Due soon', closed: 'Closed' }

// Chips are never red. Light: soft fill + dark text. Dark: 15% tint + bright text.
export const STATUS_CLASS = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300',
  scheduled: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  open: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  'due-soon': 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  closed: 'bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400',
}

// "in 2 days", "3 hours ago", "just now"
export const relativeTime = (iso, now = Date.now()) => {
  const t = new Date(iso).getTime()
  if (!iso || Number.isNaN(t)) return ''
  const diff = t - now
  const abs = Math.abs(diff)
  const unit = abs < 3600e3 ? [60e3, 'minute'] : abs < DAY ? [3600e3, 'hour'] : [DAY, 'day']
  const n = Math.max(1, Math.round(abs / unit[0]))
  if (abs < 60e3) return 'just now'
  const text = `${n} ${unit[1]}${n === 1 ? '' : 's'}`
  return diff > 0 ? `in ${text}` : `${text} ago`
}
