/**
 * Service-account JWT signing using the Web Crypto API (RS256).
 * Ported from airflow-dag-extension.
 *
 * Flow:
 *   1. Load service-account JSON from chrome.storage.local
 *   2. Build a JWT signed with the private key via crypto.subtle
 *   3. POST to Google's token endpoint → access_token (valid 1 h)
 *   4. Cache in chrome.storage.local; refresh when < 2 min remain
 */

export interface ServiceAccount {
  project_id:   string
  client_email: string
  private_key:  string
}

const TOKEN_CACHE_KEY    = 'vertex_access_token'
const TOKEN_EXPIRY_KEY   = 'vertex_token_expiry'
const GCP_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GCP_SCOPE          = 'https://www.googleapis.com/auth/cloud-platform'

async function localGet<T extends Record<string, unknown>>(keys: string[]): Promise<T> {
  if (typeof chrome === 'undefined' || !chrome.storage) return {} as T
  return new Promise(r => chrome.storage.local.get(keys, v => r(v as T)))
}

async function localSet(obj: Record<string, unknown>): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) return
  return new Promise(r => chrome.storage.local.set(obj, r))
}

export async function loadServiceAccount(): Promise<ServiceAccount | null> {
  const { serviceAccountJson } = await localGet<{ serviceAccountJson: string }>(['serviceAccountJson'])
  if (!serviceAccountJson) return null
  try { return JSON.parse(serviceAccountJson) as ServiceAccount } catch { return null }
}

export async function saveServiceAccount(json: string): Promise<void> {
  await localSet({ serviceAccountJson: json })
}

function base64url(data: ArrayBuffer | string): string {
  let base64: string
  if (typeof data === 'string') {
    base64 = btoa(unescape(encodeURIComponent(data)))
  } else {
    base64 = btoa(String.fromCharCode(...new Uint8Array(data)))
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function pemToDer(pem: string): ArrayBuffer {
  const stripped = pem.replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, '').replace(/\s+/g, '')
  const binary = atob(stripped)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToDer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function createSignedJwt(sa: ServiceAccount): Promise<string> {
  const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const now     = Math.floor(Date.now() / 1000)
  const payload = base64url(JSON.stringify({
    iss: sa.client_email, sub: sa.client_email,
    scope: GCP_SCOPE, aud: GCP_TOKEN_ENDPOINT,
    iat: now, exp: now + 3600,
  }))
  const unsigned  = `${header}.${payload}`
  const key       = await importPrivateKey(sa.private_key)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  return `${unsigned}.${base64url(signature)}`
}

export async function getVertexToken(): Promise<string> {
  const { [TOKEN_CACHE_KEY]: cached, [TOKEN_EXPIRY_KEY]: expiry } =
    await localGet<Record<string, string>>([TOKEN_CACHE_KEY, TOKEN_EXPIRY_KEY])

  if (cached && expiry && Number(expiry) - Date.now() > 120_000) return cached

  const sa = await loadServiceAccount()
  if (!sa) throw new Error('No service account configured. Add your JSON key in Settings → Gemini.')

  const jwt  = await createSignedJwt(sa)
  const resp = await fetch(GCP_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  if (!resp.ok) throw new Error(`Token exchange failed (${resp.status}): ${await resp.text()}`)

  const data = await resp.json() as { access_token: string; expires_in: number }
  const newExpiry = Date.now() + (data.expires_in ?? 3600) * 1000
  await localSet({ [TOKEN_CACHE_KEY]: data.access_token, [TOKEN_EXPIRY_KEY]: String(newExpiry) })
  return data.access_token
}
