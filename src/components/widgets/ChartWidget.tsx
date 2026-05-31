import { useState, useEffect } from 'react'
import { X, RefreshCw, TrendingUp, TrendingDown, GitMerge, BarChart2, LayoutGrid } from 'lucide-react'
import { useChart } from '../../hooks/useStockData'
import { SingleLineChart } from '../charts/MiniLineChart'
import { KPICardGrid } from './KPIWidget'
import { TabMenu } from '../TabMenu'
import { hexRgba } from '../../utils/colors'
import type { Widget, Period, Interval } from '../../types'

const PERIODS: { label: string; value: Period }[] = [
  { label: '1D', value: '1d'  },
  { label: '5D', value: '5d'  },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y'  },
  { label: '2Y', value: '2y'  },
  { label: '5Y', value: '5y'  },
]

const PERIOD_INTERVALS: Record<string, Interval> = {
  '1d': '5m', '5d': '15m', '1mo': '1d', '3mo': '1d',
  '6mo': '1d', '1y': '1d', '2y': '1wk', '5y': '1mo',
}

interface TabOption { id: string; name: string; canAdd: boolean }

interface Props {
  widget: Widget
  onRemove: () => void
  onConvertToCombo?: () => void
  onPeriodChange: (p: Period) => void
  globalPeriod?: Period
  symbolColor?: string
  otherTabs?: TabOption[]
  onCopyToTab?: (tabId: string) => void
  onMoveToTab?: (tabId: string) => void
}

export function ChartWidget({
  widget, onRemove, onConvertToCombo, onPeriodChange, globalPeriod,
  symbolColor = '#6366f1', otherTabs = [], onCopyToTab, onMoveToTab,
}: Props) {
  const symbol = widget.symbol ?? ''
  const [period, setPeriod] = useState<Period>(globalPeriod ?? widget.period)
  const [showKpi, setShowKpi] = useState(false)
  const interval = PERIOD_INTERVALS[period] ?? '1d'

  useEffect(() => {
    if (globalPeriod) { setPeriod(globalPeriod); onPeriodChange(globalPeriod) }
  }, [globalPeriod])  // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isFetching, refetch } = useChart(symbol, period, interval)

  const quote   = data?.quote
  const candles = data?.candles ?? []

  const firstClose     = candles[0]?.close ?? null
  const lastClose      = candles[candles.length - 1]?.close ?? quote?.price ?? null
  const periodChange   = firstClose && lastClose ? lastClose - firstClose : null
  const periodChangePct = firstClose && periodChange != null ? (periodChange / firstClose) * 100 : null
  const periodUp       = (periodChangePct ?? 0) >= 0
  const dailyUp        = (quote?.changePct ?? 0) >= 0
  const lineColor      = periodUp ? '#22c55e' : '#ef4444'

  function handlePeriod(p: Period) { setPeriod(p); onPeriodChange(p) }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div
        className="widget-drag-handle flex items-center justify-between px-3 py-2 border-b border-border shrink-0 cursor-move"
        style={{ background: hexRgba(symbolColor, 0.12), borderLeft: `4px solid ${symbolColor}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm" style={{ color: symbolColor }}>{symbol}</span>
          {quote && <span className="text-sm text-white shrink-0">${quote.price?.toFixed(2) ?? '—'}</span>}
          {quote?.changePct != null && (
            <span className={`flex items-center gap-0.5 text-xs shrink-0 ${dailyUp ? 'text-green-400' : 'text-red-400'}`}>
              {dailyUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {dailyUp ? '+' : ''}{quote.changePct.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onConvertToCombo && (
            <button onClick={onConvertToCombo} className="p-1 text-gray-500 hover:text-indigo-400 transition-colors" title="Combine with other stocks">
              <GitMerge size={13} />
            </button>
          )}
          {/* KPI toggle */}
          <button
            onClick={() => setShowKpi(v => !v)}
            className={`p-1 transition-colors ${showKpi ? 'text-indigo-400' : 'text-gray-500 hover:text-indigo-400'}`}
            title={showKpi ? 'Show chart' : 'Show KPI card'}
          >
            {showKpi ? <BarChart2 size={13} /> : <LayoutGrid size={13} />}
          </button>
          <TabMenu tabs={otherTabs} onCopy={onCopyToTab ?? (() => {})} onMove={onMoveToTab ?? (() => {})} />
          <button onClick={() => refetch()} className="p-1 text-gray-500 hover:text-white transition-colors">
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button onClick={onRemove} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {showKpi ? (
        /* KPI view */
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          <KPICardGrid symbol={symbol} />
        </div>
      ) : (
        <>
          {/* Period selector */}
          <div className="flex gap-0.5 px-3 py-1.5 border-b border-border shrink-0 flex-wrap">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => handlePeriod(p.value)}
                className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                  period === p.value ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={period === p.value ? { background: symbolColor } : {}}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className={`flex-1 min-h-0 relative transition-opacity ${isFetching && !isLoading ? 'opacity-60' : ''}`}>
            <div className="absolute inset-0 p-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw size={18} className="animate-spin" style={{ color: symbolColor }} />
                </div>
              ) : (
                <SingleLineChart data={candles} color={lineColor} basePrice={firstClose ?? undefined} />
              )}
            </div>
          </div>

          {/* Footer — period change */}
          <div className="px-3 py-1.5 border-t border-border text-xs flex items-center gap-2 shrink-0">
            {quote?.name && <span className="truncate text-gray-500">{quote.name}</span>}
            <span className="ml-auto shrink-0 flex items-center gap-2">
              {periodChange != null && (
                <span className={`font-medium ${periodUp ? 'text-green-600' : 'text-red-400'}`}>
                  {periodUp ? '+' : ''}${Math.abs(periodChange).toFixed(2)}
                </span>
              )}
              {periodChangePct != null && (
                <span className={`font-medium ${periodUp ? 'text-green-600' : 'text-red-400'}`}>
                  ({periodUp ? '+' : ''}{periodChangePct.toFixed(2)}%)
                </span>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
