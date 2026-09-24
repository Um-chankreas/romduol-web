// A short "someone joined" chime (src/assets/sound/join-class.mp3), played for
// the teacher when a new student's tile appears. Overlapping triggers are
// coalesced: if the chime is already playing, at most one more play is queued
// right behind it — a burst of joins never stacks into noise.
import chimeUrl from '@/assets/sound/join-class.mp3';

const MUTE_KEY = 'live.joinChime.muted';

export function isJoinChimeMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setJoinChimeMuted(muted) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode, etc. */ }
}

export function createJoinChime() {
  const audio = new Audio(chimeUrl);
  audio.preload = 'auto';
  audio.volume = 0.55;
  let pending = false;

  audio.addEventListener('ended', () => {
    if (!pending) return;
    pending = false;
    audio.currentTime = 0;
    audio.play().catch(() => {});   // autoplay can still refuse; never throw over a chime
  });

  function play() {
    if (isJoinChimeMuted()) return;
    if (audio.paused) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      pending = true;   // already sounding — ride the queue instead of overlapping
    }
  }

  return { play };
}
