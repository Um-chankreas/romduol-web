// Mirror of the backend's src/utils/agoraUid.js so the client can map a
// user id to the numeric Agora UID the server puts in the token / hand list.
// Must stay byte-for-byte identical to the backend implementation.
export function generateAgoraUid(userId) {
  let hash = 0
  const value = String(userId)

  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }

  hash = Math.abs(hash)

  return (hash % 2147483646) + 1
}
