import React from 'react'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { hexRgba } from '../utils/colors'
import type { Quote } from '../types'
import type { ColorMap } from '../utils/colors'

interface Props {
  quotes: Quote[]
  colorMap: ColorMap
  onClickSymbol?: (symbol: string) => void
  onRefresh?: () => void
  isFetching?: boolean
  updatedAt?: number
}

function QuoteChip({ q, color, onClick }: { q: Quote; color: string; onClick?: () => void }) {
  const up = (q.changePct ?? 0) >= 0
  const hasChange = q.change != null && q.changePct != null

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 h-full border-r border-border hover:brightness-110 transition-all shrink-0"
      style={{ borderLeft: `3px solid ${color}`, background: hexRgba(color, 0.08) }}
      title={`${q.name || q.symbol} — click to open chart`}
    >
      <span className="font-bold text-xs" style={{ color }}>{q.symbol}</span>
      <span className="text-xs text-gray-300">
        {q.price != null ? `$${q.price.toFixed(2)}` : '—'}
      </span>
      {hasChange && (
        <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          <span>{up ? '+' : ''}{q.change!.toFixed(2)}</span>
          <span>({up ? '+' : ''}{q.changePct!.toFixed(2)}%)</span>
        </span>
      )}
    </button>
  )
}

function fmtTime(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function TickerStrip({ quotes, colorMap, onClickSymbol, onRefresh, isFetching, updatedAt }: Props) {
  if (!quotes.length) return null

  const doubled = [...quotes, ...quotes]
  // ~2.5s per symbol keeps a consistent per-chip scroll speed
  const duration = Math.max(8, quotes.length * 2.5)

  return (
    <div className="flex bg-card shrink-0 relative border-b border-border">
      <div className="ticker-row h-9 flex-1 overflow-hidden">
        <div className="ticker-track" style={{ '--ticker-duration': `${duration}s` } as React.CSSProperties}>
          {doubled.map((q, i) => (
            <QuoteChip
              key={`${q.symbol}-${i}`}
              q={q}
              color={colorMap[q.symbol] ?? '#6366f1'}
              onClick={() => onClickSymbol?.(q.symbol)}
            />
          ))}
        </div>
      </div>

      {/* Last updated timestamp */}
      {updatedAt ? (
        <div className="h-9 px-3 flex items-center shrink-0 border-l border-border text-[10px] text-white select-none font-medium">
          {isFetching ? 'Updating…' : fmtTime(updatedAt)}
        </div>
      ) : null}

      {onRefresh && (
        <button
          onClick={onRefresh}
          className="h-9 px-3 flex items-center shrink-0 text-gray-400 hover:text-white border-l border-border bg-card transition-colors z-10"
          title="Refresh quotes"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  )
}
