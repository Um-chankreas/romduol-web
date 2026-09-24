// ─────────────────────────────────────────────────────────────────────────────
// Browser-side class recording with MediaRecorder — no service, no install.
//
// MediaRecorder can't follow a stream whose tracks change (it stops), so we
// don't record the Agora tracks directly. We record a <canvas> that is painted
// with whichever video is active — the shared screen, else the camera, else a
// name card — plus a Web Audio mix of every live audio track. update() can then
// be called freely as the teacher starts / stops sharing, mutes, or a student
// takes the mic, and the recording carries on as one continuous file.
// ─────────────────────────────────────────────────────────────────────────────

// MP4 (H.264 + AAC) first: it plays everywhere and seeks properly. Chrome and
// Edge 126+ and Safari can record it; other browsers (Firefox) fall back to WebM.
const FORMATS = [
  { mimeType: 'video/mp4;codecs=avc1.640028,mp4a.40.2', ext: 'mp4', type: 'video/mp4' },
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4', type: 'video/mp4' },
  { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4', type: 'video/mp4' },
  { mimeType: 'video/mp4', ext: 'mp4', type: 'video/mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm', type: 'video/webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm', type: 'video/webm' },
  { mimeType: 'video/webm', ext: 'webm', type: 'video/webm' },
];

/** First container/codec this browser can record, or null. */
export function pickRecordingFormat() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
  return FORMATS.find(f => MediaRecorder.isTypeSupported(f.mimeType)) || null;
}

export function isRecordingSupported() {
  return !!pickRecordingFormat()
    && typeof HTMLCanvasElement !== 'undefined'
    && !!HTMLCanvasElement.prototype.captureStream
    && !!(window.AudioContext || window.webkitAudioContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Chunk storage: a 1-2 hour class at the defaults below (1080p/4 Mbps + 128 kbps
// audio) produces ~2-4 GB. MediaRecorder hands that back in ~1 s chunks, and
// simply pushing every chunk onto a JS array for the whole class — then doing
// `new Blob(allChunks)` at the end — holds the entire recording in the tab's
// memory and forces one huge concatenation right as the teacher clicks Stop.
// That is an OOM tab crash waiting to happen on anything but a short recording.
//
// Instead, each chunk is written straight to a temp file in the Origin Private
// File System (OPFS) as it arrives, so memory use stays flat regardless of how
// long the class runs; `stop()` hands back a File backed by that OPFS entry
// instead of an in-memory Blob. No backend involved — this is purely local
// browser storage, freed once the next recording starts (see openOpfsSink).
//
// Falls back to the old in-memory array when OPFS isn't available (older
// Safari, Firefox) — same behavior as before on those browsers, not a
// regression, since Firefox already can't produce MP4 here either.
// ─────────────────────────────────────────────────────────────────────────────
const OPFS_DIR = 'live-recordings';

async function openOpfsSink() {
  if (!navigator.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(OPFS_DIR, { create: true });
    // Best-effort: clear anything left over from a prior recording that never
    // got a chance to clean up after itself (crash, tab closed mid-upload).
    // Bounded to "at most the previous session's leftovers" — never grows.
    for await (const name of dir.keys()) {
      try { await dir.removeEntry(name); } catch (_) { /* in use elsewhere — leave it */ }
    }
    const name = `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    return { dir, handle, name, writable };
  } catch (err) {
    console.warn('[recorder] OPFS unavailable, buffering in memory instead:', err);
    return null;
  }
}

async function releaseOpfsSink(sink) {
  if (!sink) return;
  try { await sink.writable.close(); } catch (_) { /* already closed/aborted */ }
  try { await sink.dir.removeEntry(sink.name); } catch (_) { /* already gone */ }
}

// requestAnimationFrame stops in a background tab — and the teacher is usually
// looking at the window they're sharing. A worker's timer keeps ticking.
function startTicker(fn, ms) {
  try {
    const url = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${ms})`], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = fn;
    return () => { worker.terminate(); URL.revokeObjectURL(url); };
  } catch {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }
}

/**
 * @param {{ width?: number, height?: number, fps?: number, videoBitsPerSecond?: number,
 *           name?: string, onError?: (e: Error) => void }} opts
 *   Defaults are 1080p at 4 Mbps: a shared 1080p screen keeps small text
 *   readable (720p @ ~2 Mbps made it soft). `name` is shown on the card that
 *   fills the frame when nothing is on camera.
 */
export function createBrowserRecorder({ width = 1920, height = 1080, fps = 30, videoBitsPerSecond = 4_000_000, name = '', onError } = {}) {
  const format = pickRecordingFormat();
  if (!format || !isRecordingSupported()) {
    const err = new Error("This browser can't record.");
    err.code = 'unsupported';
    throw err;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const mix = audioCtx.createMediaStreamDestination();

  const videoEls = new Map();    // MediaStreamTrack -> <video> we draw from
  const audioNodes = new Map();  // MediaStreamTrack -> source node feeding the mix
  let screenTrack = null;
  let cameraTrack = null;

  function videoFor(track) {
    let el = videoEls.get(track);
    if (!el) {
      el = document.createElement('video');
      el.muted = true;
      el.playsInline = true;
      el.srcObject = new MediaStream([track]);
      // Off-screen but attached: a detached <video> can stop decoding.
      el.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
      document.body.appendChild(el);
      el.play().catch(() => {});
      videoEls.set(track, el);
    }
    return el;
  }
  function dropVideo(track) {
    const el = videoEls.get(track);
    if (!el) return;
    el.pause();
    el.srcObject = null;
    el.remove();
    videoEls.delete(track);
  }

  /**
   * Tell the recorder what's live right now. Safe to call as often as you like
   * (it only reacts to changes). A track that has ended is ignored.
   * @param {{ screen?: MediaStreamTrack|null, camera?: MediaStreamTrack|null, audio?: MediaStreamTrack[] }} sources
   */
  function update({ screen = null, camera = null, audio = [] } = {}) {
    screenTrack = screen?.readyState === 'live' ? screen : null;
    cameraTrack = camera?.readyState === 'live' ? camera : null;

    const wantVideo = new Set([screenTrack, cameraTrack].filter(Boolean));
    for (const t of [...videoEls.keys()]) if (!wantVideo.has(t)) dropVideo(t);
    for (const t of wantVideo) videoFor(t);

    const wantAudio = new Set(audio.filter(t => t?.readyState === 'live'));
    for (const [t, node] of [...audioNodes]) {
      if (!wantAudio.has(t)) { node.disconnect(); audioNodes.delete(t); }
    }
    for (const t of wantAudio) {
      if (audioNodes.has(t)) continue;
      const node = audioCtx.createMediaStreamSource(new MediaStream([t]));
      node.connect(mix);
      audioNodes.set(t, node);
    }
  }

  function drawCard() {
    const k = height / 720;   // sizes below were tuned for 720p
    const cx = width / 2;
    const cy = height / 2 - 30 * k;
    ctx.fillStyle = '#016a36';
    ctx.beginPath();
    ctx.arc(cx, cy, 72 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${72 * k}px 'Noto Sans Khmer', 'Khmer OS', system-ui, sans-serif`;
    ctx.fillText((name.trim().charAt(0) || '•').toUpperCase(), cx, cy + 4 * k);
    if (name) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `${30 * k}px 'Noto Sans Khmer', 'Khmer OS', system-ui, sans-serif`;
      ctx.fillText(name, cx, cy + 120 * k);
    }
  }

  function draw() {
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, width, height);
    const el = screenTrack ? videoEls.get(screenTrack) : cameraTrack ? videoEls.get(cameraTrack) : null;
    if (el && el.videoWidth) {
      // Fit, don't crop — slides and documents must stay whole.
      const scale = Math.min(width / el.videoWidth, height / el.videoHeight);
      const w = el.videoWidth * scale;
      const h = el.videoHeight * scale;
      ctx.drawImage(el, (width - w) / 2, (height - h) / 2, w, h);
    } else {
      drawCard();
    }
  }

  const stream = new MediaStream([
    ...canvas.captureStream(fps).getVideoTracks(),
    ...mix.stream.getAudioTracks(),
  ]);
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond,
    audioBitsPerSecond: 128_000,
  });
  // sink: OPFS-backed (chunks written straight to disk). chunks: in-memory
  // fallback array, only used when OPFS isn't available. Exactly one is active.
  let sink = null;
  let chunks = null;
  let writeChain = Promise.resolve();
  let writeError = null;
  let startedAt = 0;
  let stopTicker = null;
  let handedOff = false;   // true once stop() has resolved — dispose() must never touch that file again

  recorder.ondataavailable = (e) => {
    if (!e.data || !e.data.size) return;
    if (sink) {
      // Writes must land in order on one stream — chain them rather than
      // firing concurrently, and remember the first failure so stop() can
      // surface it instead of silently handing back a truncated recording.
      writeChain = writeChain
        .then(() => sink.writable.write(e.data))
        .catch((err) => {
          writeError = writeError || err;
          console.error('[recorder] writing a chunk to disk failed:', err);
        });
    } else {
      chunks.push(e.data);
    }
  };
  recorder.onerror = (e) => onError?.(e.error || new Error('Recording failed'));

  function cleanup() {
    stopTicker?.();
    stopTicker = null;
    for (const t of [...videoEls.keys()]) dropVideo(t);
    for (const node of audioNodes.values()) node.disconnect();
    audioNodes.clear();
    stream.getTracks().forEach(t => t.stop());
    audioCtx.close().catch(() => {});
  }

  // Give the video elements a moment to decode their first frame, so the
  // recording opens on the real picture and not a flash of the name card.
  async function firstFrames(timeoutMs = 800) {
    const t0 = performance.now();
    while (performance.now() - t0 < timeoutMs && [...videoEls.values()].some(el => !el.videoWidth)) {
      await new Promise(r => setTimeout(r, 40));
    }
  }

  async function start(sources) {
    sink = await openOpfsSink();
    if (!sink) chunks = [];
    update(sources);
    audioCtx.resume().catch(() => {});
    await firstFrames();
    draw();
    stopTicker = startTicker(draw, Math.round(1000 / fps));
    recorder.start(1000);   // a chunk a second, so nothing is lost if the tab dies late
    startedAt = performance.now();
  }

  /** Finish and return the recording. The blob is only kept around (in OPFS or
   * memory) until the NEXT recording starts — callers must finish downloading
   * / uploading it before then. */
  function stop() {
    return new Promise((resolve, reject) => {
      if (recorder.state === 'inactive') {
        cleanup();
        reject(new Error('Nothing was recorded.'));
        return;
      }
      recorder.onstop = async () => {
        const durationMs = performance.now() - startedAt;
        try {
          let blob;
          if (sink) {
            await writeChain;   // let every queued chunk actually land first
            if (writeError) throw writeError;
            await sink.writable.close();
            blob = await sink.handle.getFile();   // OPFS-backed File — reading it doesn't re-buffer the whole thing into heap
          } else {
            blob = new Blob(chunks, { type: format.type });
          }
          cleanup();
          if (blob.size) {
            handedOff = true;   // the caller now owns this file; leave it for the next start() to sweep
            resolve({ blob, ext: format.ext, mimeType: format.type, durationMs });
          } else {
            reject(new Error('The recording is empty.'));
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };
      recorder.stop();
    });
  }

  /** Abandon without producing a file (page is going away, or an error mid-recording). */
  function dispose() {
    recorder.onstop = null;
    try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* noop */ }
    if (sink && !handedOff) {
      writeChain.catch(() => {}).finally(() => releaseOpfsSink(sink));
    }
    cleanup();
  }

  return { start, update, stop, dispose, elapsedMs: () => performance.now() - startedAt, format };
}
