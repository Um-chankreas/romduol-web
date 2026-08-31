import { io } from 'socket.io-client'
import { SOCKET_URL } from './axios'

/**
 * Thin wrapper around the live-class Socket.IO layer (backend:
 * src/realtime/liveClassSocket.js). Google-Meet style — no request queue.
 *
 * The REST endpoints stay the source of truth and do every write; this socket
 * only receives the fan-out so the UI never has to poll.
 *
 * Server -> client events:
 *   "participants:changed" { participants: [...] }        everyone in the call
 *   "stage:changed"        { speakers: [...], raised_hands: [...] }
 *   "hand:raised"          { user_id, name }              transient toast
 *   "hand:lowered"         { user_id }
 *   "hand:update"          { status }                     this student only
 *   "speaker:mute"         { user_id }                    teacher asked you to mute
 *   "class:status"         { status }
 *
 * Usage:
 *   const conn = connectLiveClassSocket(classId, {
 *     onState:        (state) => {},   // ack: { role, status, stage, participants, hand? }
 *     onParticipants: (participants) => {},
 *     onStage:        (stage) => {},   // { speakers, raised_hands }
 *     onHandRaised:   (user_id, name) => {},
 *     onHandLowered:  (user_id) => {},
 *     onHandUpdate:   (status) => {},
 *     onForceMute:    () => {},
 *     onClassStatus:  (status) => {},
 *     onError:        (msg) => {},
 *   })
 *   conn.disconnect()
 */
export function connectLiveClassSocket(liveClassId, handlers = {}) {
  const token = localStorage.getItem('token')

  const socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  })

  const subscribe = () => {
    socket.emit('live-class:subscribe', { liveClassId }, (ack) => {
      if (!ack?.ok) {
        handlers.onError?.(ack?.error || 'Failed to subscribe to live class')
        return
      }
      handlers.onState?.({ role: ack.role, ...ack.state })
    })
  }

  socket.on('connect', subscribe)
  socket.on('connect_error', (err) => handlers.onError?.(err.message))

  const forThisClass = (p) => p && p.liveClassId === liveClassId

  socket.on('participants:changed', (p) => {
    if (forThisClass(p)) handlers.onParticipants?.(p.participants || [])
  })
  socket.on('stage:changed', (p) => {
    if (forThisClass(p)) handlers.onStage?.({ speakers: p.speakers || [], raised_hands: p.raised_hands || [] })
  })
  socket.on('hand:raised', (p) => {
    if (forThisClass(p)) handlers.onHandRaised?.(p.user_id, p.name)
  })
  socket.on('hand:lowered', (p) => {
    if (forThisClass(p)) handlers.onHandLowered?.(p.user_id)
  })
  socket.on('hand:update', (p) => {
    if (forThisClass(p)) handlers.onHandUpdate?.(p.status)
  })
  socket.on('speaker:mute', (p) => {
    if (forThisClass(p)) handlers.onForceMute?.()
  })
  socket.on('class:status', (p) => {
    if (forThisClass(p)) handlers.onClassStatus?.(p.status)
  })

  return {
    socket,
    disconnect() {
      try {
        socket.emit('live-class:unsubscribe', { liveClassId })
      } catch (_) { /* socket may already be closed */ }
      socket.removeAllListeners()
      socket.disconnect()
    },
  }
}
