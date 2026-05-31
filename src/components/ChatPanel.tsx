import { useState, useRef, useEffect } from 'react'
import { Send, X, MessageSquare, Loader } from 'lucide-react'
import { geminiChat, buildStockSystemPrompt, parseWidgetAction } from '../api/gemini'
import type { ChatMessage, Widget } from '../types'

interface Props {
  symbols: string[]
  apiKey: string
  onAddWidget?: (widget: Partial<Widget>) => void
  onClose: () => void
}

export function ChatPanel({ symbols, apiKey, onAddWidget, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your stock analyst assistant. I can help you analyze **${symbols.join(', ')}** and any other tickers.\n\nAsk me about price trends, news analysis, fundamentals, or say "add a chart for NVDA" to create widgets.`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setLoading(true)

    try {
      const reply = await geminiChat(next, apiKey, buildStockSystemPrompt(symbols))
      const action = parseWidgetAction(reply)
      const cleanReply = reply.replace(/<action>[\s\S]*?<\/action>/g, '').trim()

      setMessages(prev => [...prev, { role: 'assistant', content: cleanReply }])

      if (action && onAddWidget) {
        onAddWidget(action as Partial<Widget>)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-card border-l border-border w-80 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-indigo-400" />
          <span className="text-sm font-semibold text-white">AI Analyst</span>
        </div>
        <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-white/6 text-gray-200 rounded-bl-sm'
              }`}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/6 rounded-lg rounded-bl-sm px-3 py-2">
              <Loader size={12} className="animate-spin text-indigo-400" />
            </div>
          </div>
        )}
        {error && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            placeholder="Ask about stocks or say 'add chart for NVDA'…"
            rows={2}
            className="flex-1 bg-white/6 border border-border rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
