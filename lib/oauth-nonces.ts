import { randomBytes } from 'crypto'

// Short-lived nonce store: nonce -> { userId, expiresAt }
export const oauthNonces = new Map<string, { userId: string; expiresAt: number }>()

// Clean up expired nonces every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [nonce, data] of oauthNonces.entries()) {
    if (data.expiresAt < now) oauthNonces.delete(nonce)
  }
}, 10 * 60 * 1000)

/** Generate a cryptographically random nonce and store it for the given userId (10-minute TTL). */
export function createOAuthNonce(userId: string): string {
  const nonce = randomBytes(32).toString('hex')
  oauthNonces.set(nonce, { userId, expiresAt: Date.now() + 10 * 60 * 1000 })
  return nonce
}
