import { ref, readonly } from 'vue'
import km from '../locales/km'

// One shared state for the whole app (module-level, like a tiny store).
const STORAGE_KEY = 'preferredLanguage'
const read = () => {
  try { return localStorage.getItem(STORAGE_KEY) === 'km' ? 'km' : 'en' } catch { return 'en' }
}

const lang = ref(read())
const dictionaries = { km }

const apply = (code) => {
  if (typeof document !== 'undefined') document.documentElement.lang = code
}
apply(lang.value)

const setLang = (code) => {
  lang.value = code === 'km' ? 'km' : 'en'
  try { localStorage.setItem(STORAGE_KEY, lang.value) } catch { /* private mode: still works for this visit */ }
  apply(lang.value)
}

// English text is the key. No entry (or English selected) returns it unchanged,
// so untranslated text and dynamic values like a course title just stay as they are.
const t = (text) => (lang.value === 'en' ? text : (dictionaries[lang.value]?.[text] ?? text))

export function useLanguage() {
  return { lang: readonly(lang), setLang, t }
}
