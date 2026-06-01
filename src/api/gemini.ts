import type { ChatMessage } from '../types'
import { getGcpToken, invalidateCachedToken } from './auth'

// ── Model (change this one line to switch models) ─────────────────────────────
const MODEL = 'gemini-2.5-flash'

// ── Settings loader ───────────────────────────────────────────────────────────

async function loadGcpConfig(): Promise<{ projectId: string; region: string }> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return { projectId: '', region: 'us-central1' }
  }
  return new Promise(r =>
    chrome.storage.local.get('gst_settings', v => {
      const s = (v.gst_settings ?? {}) as Record<string, string>
      r({ projectId: s.gcpProjectId ?? '', region: s.gcpRegion ?? 'us-central1' })
    }),
  )
}

// ── Google login via chrome.identity (requires oauth2 in manifest) ─────────────

export function googleLogin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!chrome?.identity?.getAuthToken) {
      reject(new Error('chrome.identity not available'))
      return
    }
    chrome.identity.getAuthToken(
      { interactive: true, scopes: ['https://www.googleapis.com/auth/cloud-platform'] },
      (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message ?? 'Auth failed'))
          return
        }
        const token = typeof result === 'string' ? result : result?.token
        if (token) resolve(token)
        else reject(new Error('No token returned — make sure oauth2.client_id is set in manifest.json'))
      },
    )
  })
}

// ── Connection test ───────────────────────────────────────────────────────────

export async function testConnection(
  token: string,
  projectId: string,
  region: string,
): Promise<void> {
  if (!token)     throw new Error('No token provided.')
  if (!projectId) throw new Error('GCP Project ID is required.')

  const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${MODEL}:generateContent`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function geminiChat(
  messages: ChatMessage[],
  systemPrompt?: string,
): Promise<string> {
  const [token, { projectId, region }] = await Promise.all([getGcpToken(), loadGcpConfig()])

  if (!projectId) throw new Error('GCP Project ID not set. Add it in Settings → Gemini.')

  const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${MODEL}:generateContent`

  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))

  const body: Record<string, unknown> = { contents }
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    if (res.status === 401) await invalidateCachedToken()
    const err = await res.json().catch(() => ({}))
    const msg: string = err?.error?.message ?? `Vertex AI error: HTTP ${res.status}`
    throw new Error(msg)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── System prompt + action parsing ───────────────────────────────────────────

export function buildStockSystemPrompt(symbols: string[]): string {
  return `You are an expert stock market analyst assistant. The user is watching: ${symbols.join(', ')}.

Help them understand market trends, interpret news, analyze chart patterns, and make informed decisions. When asked about a specific stock, provide:
- Current price context and momentum
- Key support/resistance levels based on 52-week range
- News-driven catalysts (positive or negative)
- Comparison with sector peers when relevant
- Risk factors to consider

Be concise and data-driven. When the user asks to create or modify a widget (chart, news, KPI), output a JSON action at the end of your response in this exact format:
<action>
{
  "type": "add_widget",
  "kind": "chart|news|kpi|combo",
  "symbol": "TICKER",
  "symbols": ["TICKER1","TICKER2"],
  "title": "Widget title",
  "period": "3mo",
  "normalize": false
}
</action>

Only include the action block when the user explicitly asks to create, show, or add a widget/chart.`
}

export function parseWidgetAction(text: string): Record<string, unknown> | null {
  const m = text.match(/<action>\s*([\s\S]*?)\s*<\/action>/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}
