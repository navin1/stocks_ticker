import { X, RefreshCw, ExternalLink } from 'lucide-react'
import { useNews } from '../../hooks/useStockData'
import { TabMenu } from '../TabMenu'
import { hexRgba } from '../../utils/colors'
import type { Widget } from '../../types'

interface TabOption { id: string; name: string; canAdd: boolean }

interface Props {
  widget: Widget
  onRemove: () => void
  symbolColor?: string
  otherTabs?: TabOption[]
  onCopyToTab?: (tabId: string) => void
  onMoveToTab?: (tabId: string) => void
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return `${Math.floor(ms / 60_000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function NewsWidget({ widget, onRemove, symbolColor = '#6366f1', otherTabs = [], onCopyToTab, onMoveToTab }: Props) {
  const symbols = widget.symbols ?? (widget.symbol ? [widget.symbol] : [])
  const { data: news = [], isLoading, isFetching, refetch } = useNews(symbols)

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div
        className="widget-drag-handle flex items-center justify-between px-3 py-2 border-b border-border shrink-0 cursor-move"
        style={{ background: hexRgba(symbolColor, 0.12), borderLeft: `4px solid ${symbolColor}` }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-white">News</span>
          <span className="text-xs text-gray-500">{symbols.join(', ')}</span>
        </div>
        <div className="flex items-center gap-1">
          <TabMenu tabs={otherTabs} onCopy={onCopyToTab ?? (() => {})} onMove={onMoveToTab ?? (() => {})} />
          <button onClick={() => refetch()} className="p-1 text-gray-500 hover:text-white transition-colors">
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          </button>
          <button onClick={onRemove} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* News list */}
      <div className={`flex-1 min-h-0 overflow-y-auto divide-y divide-border transition-opacity ${isFetching && !isLoading ? 'opacity-60' : ''}`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw size={18} className="animate-spin text-indigo-400" />
          </div>
        ) : news.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm p-4">
            No recent news found
          </div>
        ) : (
          news.map((item, i) => (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2.5 hover:bg-white/4 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-gray-200 line-clamp-2 leading-relaxed group-hover:text-white transition-colors">
                  {item.title}
                </p>
                <ExternalLink size={11} className="text-gray-600 shrink-0 mt-0.5 group-hover:text-indigo-400" />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-1.5 py-0.5 bg-indigo-900/40 text-indigo-400 rounded">
                  {item.symbol}
                </span>
                <span className="text-[10px] text-gray-500">{item.source}</span>
                <span className="text-[10px] text-gray-600 ml-auto">{timeAgo(item.published)}</span>
              </div>
              {item.summary && (
                <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>
              )}
            </a>
          ))
        )}
      </div>
    </div>
  )
}
