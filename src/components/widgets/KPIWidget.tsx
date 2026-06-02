import { X, RefreshCw, TrendingUp, TrendingDown, Newspaper } from 'lucide-react'
import { useFundamentals } from '../../hooks/useStockData'
import { hexRgba } from '../../utils/colors'
import { TabMenu } from '../TabMenu'
import type { Widget } from '../../types'

interface TabOption { id: string; name: string; canAdd: boolean }

interface Props {
  widget: Widget
  onRemove: () => void
  symbolColor?: string
  otherTabs?: TabOption[]
  onCopyToTab?: (tabId: string) => void
  onMoveToTab?: (tabId: string) => void
  onAddNews?: () => void
}

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/4 rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}

export function fmtCap(v: number | null) {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`
  return `$${v.toLocaleString()}`
}

export function fmtNum(v: number | null, digits = 2, prefix = '') {
  if (v == null) return '—'
  return `${prefix}${v.toFixed(digits)}`
}

export function fmtVol(v: number | null) {
  if (v == null) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toString()
}

// Shareable KPI data grid — used standalone and embedded in ChartWidget toggle
export function KPICardGrid({ symbol }: { symbol: string }) {
  const { data: f, isLoading } = useFundamentals(symbol)

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <RefreshCw size={18} className="animate-spin text-indigo-400" />
    </div>
  )
  if (!f) return (
    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
      Failed to load fundamentals
    </div>
  )

  return (
    <div className="grid grid-cols-2 gap-2">
      <KPICard label="Market Cap" value={fmtCap(f.marketCap)} />
      <KPICard label="P/E Ratio"  value={fmtNum(f.pe, 1)} />
      <KPICard label="EPS (TTM)"  value={fmtNum(f.eps, 2, '$')} />
      <KPICard label="Beta"       value={fmtNum(f.beta, 2)} />
      <KPICard label="52w High"   value={fmtNum(f.high52, 2, '$')} />
      <KPICard label="52w Low"    value={fmtNum(f.low52, 2, '$')} />
      <KPICard label="Div Yield"  value={f.divYield ? `${f.divYield.toFixed(2)}%` : '—'} />
      <KPICard label="Avg Volume" value={fmtVol(f.avgVolume)} />
      {f.sector && (
        <div className="col-span-2">
          <KPICard label="Sector" value={f.sector} />
        </div>
      )}
    </div>
  )
}

export function KPIWidget({ widget, onRemove, symbolColor = '#6366f1', otherTabs = [], onCopyToTab, onMoveToTab, onAddNews }: Props) {
  const symbol = widget.symbol ?? ''
  const { data: f, isLoading, isFetching, refetch } = useFundamentals(symbol)
  const up = (f?.changePct ?? 0) >= 0

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      <div
        className="widget-drag-handle flex items-center justify-between px-3 py-2 border-b border-border shrink-0 cursor-move"
        style={{ background: hexRgba(symbolColor, 0.12), borderLeft: `4px solid ${symbolColor}` }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-white">{symbol}</span>
          {f && (
            <>
              <span className="text-sm text-gray-300">${f.price?.toFixed(2) ?? '—'}</span>
              {f.changePct != null && (
                <span className={`flex items-center gap-0.5 text-xs ${up ? 'text-green-400' : 'text-red-400'}`}>
                  {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {up ? '+' : ''}{f.changePct.toFixed(2)}%
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onAddNews && (
            <button onClick={onAddNews} className="p-1 text-gray-500 hover:text-amber-400 transition-colors" title="News feed">
              <Newspaper size={13} />
            </button>
          )}
          <TabMenu tabs={otherTabs} onCopy={onCopyToTab ?? (() => {})} onMove={onMoveToTab ?? (() => {})} />
          <button onClick={() => refetch()} className="p-1 text-gray-500 hover:text-white transition-colors">
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button onClick={onRemove} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw size={18} className="animate-spin text-indigo-400" />
          </div>
        ) : !f ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Failed to load fundamentals
          </div>
        ) : (
          <KPICardGrid symbol={symbol} />
        )}
      </div>
    </div>
  )
}
