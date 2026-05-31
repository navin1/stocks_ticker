import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ArrowUp, ArrowDown, X, BarChart2 } from 'lucide-react'
import { hexRgba } from '../utils/colors'
import type { Quote, Period } from '../types'
import type { ColorMap } from '../utils/colors'
import type { PeriodQuoteMap } from '../hooks/useStockData'

const PERIOD_LABEL: Record<string, string> = {
  '1d': '1D', '5d': '5D', '1mo': '1M', '3mo': '3M',
  '6mo': '6M', '1y': '1Y', '2y': '2Y', '5y': '5Y',
}

interface Props {
  quotes: Quote[]
  colorMap: ColorMap
  onClickSymbol?: (symbol: string) => void
  onRefresh?: () => void
  isFetching?: boolean
  updatedAt?: number
  globalPeriod?: Period
  periodData?: PeriodQuoteMap
}

interface PopupState {
  symbol: string
  x: number
  y: number
}

function QuoteChip({
  q, color, isSelected, periodChange, periodChangePct, onClick,
}: {
  q: Quote
  color: string
  isSelected: boolean
  periodChange: number | null
  periodChangePct: number | null
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const effectiveChangePct = periodChangePct ?? q.changePct
  const up = (effectiveChangePct ?? 0) >= 0
  const hasIndicator = effectiveChangePct != null

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 h-full border-r border-border transition-all shrink-0 ${
        isSelected ? 'brightness-125' : 'hover:brightness-110'
      }`}
      style={{
        borderLeft: `3px solid ${color}`,
        background: hexRgba(color, isSelected ? 0.15 : 0.08),
      }}
    >
      <span className="font-bold text-xs" style={{ color }}>{q.symbol}</span>
      <span className="text-xs text-gray-300">
        {q.price != null ? `$${q.price.toFixed(2)}` : '—'}
      </span>
      {hasIndicator && (
        <span className={`flex items-center text-xs font-medium ${up ? 'text-green-700' : 'text-red-700'}`}>
          {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
        </span>
      )}
    </button>
  )
}

function fmtTime(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function TickerStrip({
  quotes, colorMap, onClickSymbol, onRefresh, isFetching, updatedAt, globalPeriod, periodData,
}: Props) {
  const [popup, setPopup] = useState<PopupState | null>(null)

  const dismissPopup = useCallback(() => setPopup(null), [])

  useEffect(() => {
    if (!popup) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') dismissPopup() }
    function onDocClick() { dismissPopup() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onDocClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onDocClick)
    }
  }, [popup, dismissPopup])

  function handleChipClick(symbol: string, e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    if (popup?.symbol === symbol) { setPopup(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setPopup({ symbol, x: rect.left, y: rect.bottom + 6 })
  }

  if (!quotes.length) return null

  const doubled = [...quotes, ...quotes]
  const duration = Math.max(8, quotes.length * 2.5)
  const periodLabel = PERIOD_LABEL[globalPeriod ?? '1d'] ?? globalPeriod ?? '1D'

  const popupQuote = popup ? quotes.find(q => q.symbol === popup.symbol) : null
  const popupStat = popup ? periodData?.[popup.symbol] : null
  const popupColor = popup ? (colorMap[popup.symbol] ?? '#6366f1') : '#6366f1'

  return (
    <>
      <div className="flex bg-card shrink-0 relative border-b border-border">
        <div className="ticker-row h-9 flex-1 overflow-hidden">
          <div className="ticker-track" style={{ '--ticker-duration': `${duration}s` } as React.CSSProperties}>
            {doubled.map((q, i) => {
              const stat = periodData?.[q.symbol]
              return (
                <QuoteChip
                  key={`${q.symbol}-${i}`}
                  q={q}
                  color={colorMap[q.symbol] ?? '#6366f1'}
                  isSelected={popup?.symbol === q.symbol}
                  periodChange={stat?.change ?? null}
                  periodChangePct={stat?.changePct ?? null}
                  onClick={(e) => handleChipClick(q.symbol, e)}
                />
              )
            })}
          </div>
        </div>

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

      {popup && popupQuote && (
        <div
          className="fixed z-50 bg-card border border-border rounded-lg shadow-xl p-3 min-w-[190px]"
          style={{ left: Math.min(popup.x, window.innerWidth - 210), top: popup.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-sm shrink-0" style={{ color: popupColor }}>{popupQuote.symbol}</span>
              {popupQuote.name && (
                <span className="text-[10px] text-gray-400 truncate">{popupQuote.name}</span>
              )}
            </div>
            <button onClick={dismissPopup} className="text-gray-500 hover:text-white p-0.5 ml-2 shrink-0">
              <X size={12} />
            </button>
          </div>

          <div className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wide">{periodLabel} performance</div>

          {popupStat?.change != null && popupStat?.changePct != null ? (
            <div className={`flex items-center gap-2 ${popupStat.changePct >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {popupStat.changePct >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              <span className="font-semibold text-sm">
                {popupStat.changePct >= 0 ? '+' : ''}{popupStat.change.toFixed(2)}
              </span>
              <span className="text-xs opacity-80">
                ({popupStat.changePct >= 0 ? '+' : ''}{popupStat.changePct.toFixed(2)}%)
              </span>
            </div>
          ) : (
            <div className="text-xs text-gray-500">No data available</div>
          )}

          <div className="text-[10px] text-gray-500 mt-1.5">
            Current: {popupQuote.price != null ? `$${popupQuote.price.toFixed(2)}` : '—'}
          </div>

          {onClickSymbol && (
            <button
              onClick={() => { onClickSymbol(popupQuote.symbol); dismissPopup() }}
              className="mt-2.5 flex items-center gap-1.5 w-full px-2 py-1.5 text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-md transition-colors"
            >
              <BarChart2 size={11} /> View Chart
            </button>
          )}
        </div>
      )}
    </>
  )
}
