import AgoraRTC from 'agora-rtc-sdk-ng';

// Why a local track could not be created. Agora reports each with a different
// error code, and the user needs a different message (and different fix) for
// each: plug something in, unblock the browser permission, or close the other
// app that's holding the device.
export const DeviceIssue = {
  NOT_FOUND: 'not_found',
  DENIED: 'denied',
  IN_USE: 'in_use',
  OTHER: 'other',
};

export function classifyDeviceError(err) {
  const code = err?.code || '';
  const name = err?.name || err?.originalError?.name || '';
  const text = `${code} ${name} ${err?.message || ''}`;

  if (/PERMISSION_DENIED|NotAllowedError|SecurityError/i.test(text)) return DeviceIssue.DENIED;
  if (/NOT_READABLE|NotReadableError|TrackStartError/i.test(text)) return DeviceIssue.IN_USE;
  if (/DEVICE_NOT_FOUND|NotFoundError|OverconstrainedError|CONSTRAINT_NOT_SATISFIED/i.test(text)) {
    return DeviceIssue.NOT_FOUND;
  }
  return DeviceIssue.OTHER;
}

const NOUN = { audio: 'microphone', video: 'camera' };

function subject(issue, kinds) {
  const names = kinds.map((k) => NOUN[k]).join(' and ');
  const cap = names.charAt(0).toUpperCase() + names.slice(1);
  switch (issue) {
    case DeviceIssue.NOT_FOUND: return `No ${names.replace(' and ', ' or ')} detected`;
    case DeviceIssue.DENIED: return `${cap} access is blocked`;
    case DeviceIssue.IN_USE: return `Your ${names} ${kinds.length > 1 ? 'are' : 'is'} being used by another app`;
    default: return `Your ${names} could not be started`;
  }
}

/**
 * Turn per-device failures into one friendly sentence, e.g.
 * "No camera or microphone detected — you've joined in view-only mode."
 * Returns '' when nothing failed.
 */
export function describeDeviceIssues({ audio, video, presenter = false }) {
  if (!audio && !video) return '';

  let lead;
  if (audio && video && audio === video) {
    lead = subject(audio, ['video', 'audio']);
  } else {
    const parts = [];
    if (video) parts.push(subject(video, ['video']));
    if (audio) parts.push(subject(audio, ['audio']));
    lead = parts.map((p, i) => (i ? p.charAt(0).toLowerCase() + p.slice(1) : p)).join('; ');
  }

  let tail;
  if (audio && video) tail = "you've joined in view-only mode";
  else if (video) tail = "you've joined with your microphone only";
  else tail = "you've joined with your camera only";

  let msg = `${lead} — ${tail}.`;
  if (audio === DeviceIssue.DENIED || video === DeviceIssue.DENIED) {
    msg += " Allow access in your browser's site settings, then reload.";
  }
  if (presenter && audio && video) {
    msg += " Students won't see or hear you until a device is available.";
  }
  return msg;
}

/** One-device sentence for actions that need it, e.g. "Microphone access is blocked. …" */
export function describeDeviceProblem(kind, issue) {
  let msg = `${subject(issue, [kind])}.`;
  if (issue === DeviceIssue.DENIED) msg += " Allow access in your browser's site settings, then reload.";
  return msg;
}

async function createOne(kind, preferred = {}) {
  const create = kind === 'audio'
    ? (opts) => AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true, ...opts })
    : (opts) => AgoraRTC.createCameraVideoTrack({
      encoderConfig: { width: { ideal: 1280 }, height: { ideal: 720 } },
      ...opts,
    });

  try {
    return { track: await create(preferred), issue: null };
  } catch (err) {
    // A remembered device id can go stale (unplugged headset, new browser
    // profile) and make an otherwise working machine look like it has no
    // device at all — retry once with the system default.
    if (Object.keys(preferred).length && classifyDeviceError(err) !== DeviceIssue.DENIED) {
      try {
        return { track: await create({}), issue: null };
      } catch (retryErr) {
        console.warn(`[live] ${kind} track failed:`, retryErr);
        return { track: null, issue: classifyDeviceError(retryErr) };
      }
    }
    console.warn(`[live] ${kind} track failed:`, err);
    return { track: null, issue: classifyDeviceError(err) };
  }
}

/**
 * Create the mic and camera tracks independently, so a missing camera never
 * costs a working microphone (createMicrophoneAndCameraTracks is all-or-nothing).
 * Never throws — failures come back as `audioIssue` / `videoIssue`.
 *
 * @param {{ audio?: boolean, video?: boolean, preferred?: { audio?: object, video?: object } }} opts
 */
export async function createLocalTracks({ audio = true, video = true, preferred = {} } = {}) {
  const [a, v] = await Promise.all([
    audio ? createOne('audio', preferred.audio) : { track: null, issue: null },
    video ? createOne('video', preferred.video) : { track: null, issue: null },
  ]);
  return {
    audioTrack: a.track,
    videoTrack: v.track,
    audioIssue: a.issue,
    videoIssue: v.issue,
  };
}
