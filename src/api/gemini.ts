import type { ChatMessage } from '../types'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export async function geminiChat(
  messages: ChatMessage[],
  apiKey: string,
  systemPrompt?: string,
): Promise<string> {
  if (!apiKey) throw new Error('Gemini API key not set. Add it in Settings.')

  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))

  const body: Record<string, unknown> = { contents }
  if (systemPrompt) {
    body.system_instruction = { parts: [{ text: systemPrompt }] }
  }

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Gemini error: HTTP ${res.status}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

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
