import { createHmac, randomBytes } from 'crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(encoded: string): Buffer {
  let bits = 0, value = 0
  const output: number[] = []
  for (const char of encoded.toUpperCase().replace(/=+$/, '')) {
    const idx = BASE32.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

function generateCode(secret: string, counter: number): string {
  const key = base32Decode(secret)
  const buf = Buffer.alloc(8)
  buf.writeBigInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3]
  return (code % 1_000_000).toString().padStart(6, '0')
}

export function generateSecret(): string {
  const bytes = randomBytes(20)
  let result = ''
  for (let i = 0; i < 32; i++) result += BASE32[bytes[i % 20] & 0x1f]
  return result
}

export function generateToken(secret: string): string {
  return generateCode(secret, Math.floor(Date.now() / 30_000))
}

export function verifyToken(token: string, secret: string): boolean {
  const counter = Math.floor(Date.now() / 30_000)
  for (const w of [-1, 0, 1]) {
    if (generateCode(secret, counter + w) === token) return true
  }
  return false
}

export function keyuri(account: string, issuer: string, secret: string): string {
  return (
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
    `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
  )
}
