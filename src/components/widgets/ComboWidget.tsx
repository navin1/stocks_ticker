import { useState, useEffect } from 'react'
import { X, RefreshCw, GitMerge, Unlink } from 'lucide-react'
import { useMultiChart } from '../../hooks/useStockData'
import { MultiLineChart } from '../charts/MiniLineChart'
import { TabMenu } from '../TabMenu'
import { hexRgba } from '../../utils/colors'
import type { Widget, Period, Interval } from '../../types'

interface TabOption { id: string; name: string; canAdd: boolean }

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

interface Props {
  widget: Widget
  onRemove: () => void
  onSplit: () => void
  onPeriodChange: (p: Period) => void
  onNormalizeToggle: () => void
  globalPeriod?: Period
  symbolColor?: string
  otherTabs?: TabOption[]
  onCopyToTab?: (tabId: string) => void
  onMoveToTab?: (tabId: string) => void
}

export function ComboWidget({ widget, onRemove, onSplit, onPeriodChange, onNormalizeToggle, globalPeriod, symbolColor = '#6366f1', otherTabs = [], onCopyToTab, onMoveToTab }: Props) {
  const symbols = widget.symbols ?? []
  const [period, setPeriod] = useState<Period>(globalPeriod ?? widget.period)
  const normalize = widget.normalize ?? false

  useEffect(() => {
    if (globalPeriod) {
      setPeriod(globalPeriod)
      onPeriodChange(globalPeriod)
    }
  }, [globalPeriod])  // eslint-disable-line react-hooks/exhaustive-deps

  const interval = PERIOD_INTERVALS[period] ?? '1d'
  const { data = [], isLoading, isFetching, refetch } = useMultiChart(symbols, period, interval, normalize)

  function handlePeriod(p: Period) {
    setPeriod(p)
    onPeriodChange(p)
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      <div
        className="widget-drag-handle flex items-center justify-between px-3 py-2 border-b border-border shrink-0 cursor-move"
        style={{ background: hexRgba(symbolColor, 0.12), borderLeft: `4px solid ${symbolColor}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GitMerge size={13} style={{ color: symbolColor }} className="shrink-0" />
          <span className="font-semibold text-sm text-white truncate">{symbols.join(' · ')}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onSplit} className="p-1 text-gray-500 hover:text-amber-400 transition-colors" title="Split into individual charts">
            <Unlink size={13} />
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

      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0 flex-wrap">
        <div className="flex gap-0.5">
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
        <button
          onClick={onNormalizeToggle}
          className={`ml-auto px-2 py-0.5 text-xs rounded border transition-colors ${
            normalize
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
              : 'border-border text-gray-500 hover:border-gray-400 hover:text-gray-300'
          }`}
        >
          % return
        </button>
      </div>

      <div className={`flex-1 min-h-0 relative transition-opacity ${isFetching && !isLoading ? 'opacity-60' : ''}`}>
        <div className="absolute inset-0 p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw size={18} className="animate-spin text-indigo-400" />
            </div>
          ) : (
            <MultiLineChart data={data} valueKey={normalize ? 'pctChange' : 'close'} />
          )}
        </div>
      </div>
    </div>
  )
}
