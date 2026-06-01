/**
 * GCP Bearer token acquisition.
 * Three modes (set in Settings → Gemini):
 *   manual — paste token from `gcloud auth print-access-token`
 *   oauth  — browser OAuth flow via chrome.identity.launchWebAuthFlow
 *   json   — service account JWT (auto-refreshed, no manual steps)
 *
 * Ported from airflow-dag-extension.
 */

import { getVertexToken } from './jwtAuth'

const CACHE_KEY_TOKEN  = 'cached_gcp_token'
const CACHE_KEY_EXPIRY = 'cached_gcp_token_expiry'
const GCP_SCOPE        = 'https://www.googleapis.com/auth/cloud-platform'

// ── Storage helpers ───────────────────────────────────────────────────────────

function hasStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage
}

async function localGet<T extends Record<string, unknown>>(keys: string[]): Promise<T> {
  if (!hasStorage()) return {} as T
  return new Promise(r => chrome.storage.local.get(keys, v => r(v as T)))
}

async function localSet(obj: Record<string, unknown>): Promise<void> {
  if (!hasStorage()) return
  return new Promise(r => chrome.storage.local.set(obj, r))
}

// ── OAuth via launchWebAuthFlow ───────────────────────────────────────────────

async function getCachedOAuthToken(): Promise<string | null> {
  const { [CACHE_KEY_TOKEN]: tok, [CACHE_KEY_EXPIRY]: exp } =
    await localGet<Record<string, string>>([CACHE_KEY_TOKEN, CACHE_KEY_EXPIRY])
  if (!tok || !exp) return null
  return new Date(exp).getTime() - Date.now() > 60_000 ? tok : null
}

export async function launchOAuth(clientId: string): Promise<string> {
  const cached = await getCachedOAuthToken()
  if (cached) return cached

  if (typeof chrome === 'undefined' || !chrome.identity)
    throw new Error('chrome.identity not available. Use manual token mode.')

  const redirectUri = chrome.identity.getRedirectURL()
  const authUrl     = new URL('https://accounts.google.com/o/oauth2/auth')
  authUrl.searchParams.set('client_id',     clientId)
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set('redirect_uri',  redirectUri)
  authUrl.searchParams.set('scope',         GCP_SCOPE)
  authUrl.searchParams.set('prompt',        'none')

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true }, async (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        reject(new Error(chrome.runtime.lastError?.message ?? 'OAuth flow failed'))
        return
      }
      const params    = new URLSearchParams(new URL(responseUrl.replace('#', '?')).search)
      const token     = params.get('access_token')
      const expiresIn = parseInt(params.get('expires_in') ?? '3600', 10)
      if (!token) { reject(new Error('No access_token in OAuth response')); return }
      const expiry = new Date(Date.now() + expiresIn * 1000).toISOString()
      await localSet({ [CACHE_KEY_TOKEN]: token, [CACHE_KEY_EXPIRY]: expiry })
      resolve(token)
    })
  })
}

export async function invalidateCachedToken(): Promise<void> {
  await localSet({ [CACHE_KEY_TOKEN]: '', [CACHE_KEY_EXPIRY]: '' })
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getGcpToken(): Promise<string> {
  // Read from gst_settings (stored in local by useStorage hook)
  const settings = await localGet<{
    gst_settings?: {
      gcpAuthMode?: string
      gcpOauthClientId?: string
      geminiApiKey?: string
    }
  }>(['gst_settings'])
  const s = settings.gst_settings ?? {}

  const mode = s.gcpAuthMode ?? 'manual'

  if (mode === 'json') return getVertexToken()

  if (mode === 'oauth') {
    const clientId = s.gcpOauthClientId ?? ''
    if (!clientId) throw new Error('OAuth client ID not set. Add it in Settings → Gemini.')
    return launchOAuth(clientId)
  }

  // manual
  const token = s.geminiApiKey ?? ''
  if (token) return token
  throw new Error('No token configured. Add one in Settings → Gemini.')
}
