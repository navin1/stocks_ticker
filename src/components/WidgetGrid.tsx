import { useState, useCallback } from 'react'
import { ReactGridLayout, WidthProvider, type Layout } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { ChartWidget } from './widgets/ChartWidget'
import { ComboWidget } from './widgets/ComboWidget'
import { NewsWidget } from './widgets/NewsWidget'
import { KPIWidget } from './widgets/KPIWidget'
import type { Widget, GridLayout, Period, Tab } from '../types'
import type { ColorMap } from '../utils/colors'

const RGL = WidthProvider(ReactGridLayout)

interface Props {
  widgets: Widget[]
  onWidgetsChange: (widgets: Widget[]) => void
  watchedSymbols: string[]
  globalPeriod?: Period
  colorMap?: ColorMap
  allTabs?: Tab[]
  activeTabId?: string
  onCopyWidget?: (widgetId: string, targetTabId: string) => void
  onMoveWidget?: (widgetId: string, targetTabId: string) => void
}

function canAddWidgetToTab(widget: Widget, targetWidgets: Widget[]): boolean {
  if (widget.kind === 'chart' || widget.kind === 'kpi') {
    return !targetWidgets.some(w => (w.kind === 'chart' || w.kind === 'kpi') && w.symbol === widget.symbol)
  }
  if (widget.kind === 'combo') {
    const srcKey = [...(widget.symbols ?? [])].sort().join(',')
    return !targetWidgets.some(w =>
      w.kind === 'combo' && [...(w.symbols ?? [])].sort().join(',') === srcKey
    )
  }
  return true // news: allow multiples
}

export function WidgetGrid({ widgets, onWidgetsChange, watchedSymbols, globalPeriod, colorMap = {}, allTabs = [], activeTabId, onCopyWidget, onMoveWidget }: Props) {
  const [combineModal, setCombineModal] = useState<string | null>(null)

  const updateWidget = useCallback((id: string, patch: Partial<Widget>) => {
    onWidgetsChange(widgets.map(w => w.id === id ? { ...w, ...patch } : w))
  }, [widgets, onWidgetsChange])

  const removeWidget = useCallback((id: string) => {
    onWidgetsChange(widgets.filter(w => w.id !== id))
  }, [widgets, onWidgetsChange])

  function onLayoutChange(layout: Layout) {
    onWidgetsChange(widgets.map(w => {
      const l = layout.find(x => x.i === w.id)
      return l ? { ...w, layout: { ...w.layout, x: l.x, y: l.y, w: l.w, h: l.h } as GridLayout } : w
    }))
  }

  function handleConvertToCombo(id: string) {
    setCombineModal(id)
  }

  function handleCombineWith(sourceId: string, additionalSymbols: string[]) {
    const source = widgets.find(w => w.id === sourceId)
    if (!source) return
    const baseSymbols = source.symbols ?? (source.symbol ? [source.symbol] : [])
    const allSymbols = [...new Set([...baseSymbols, ...additionalSymbols])]
    const mergedSet = new Set(additionalSymbols)
    // Remove individual chart widgets whose symbols are being merged in
    const kept = widgets.filter(w =>
      w.id === sourceId || !(w.kind === 'chart' && w.symbol && mergedSet.has(w.symbol))
    )
    onWidgetsChange(kept.map(w =>
      w.id === sourceId
        ? { ...w, kind: 'combo', symbols: allSymbols, symbol: undefined, title: allSymbols.join(' + ') }
        : w
    ))
    setCombineModal(null)
  }

  function handleSplit(id: string) {
    const source = widgets.find(w => w.id === id)
    if (!source || !source.symbols?.length) return

    const remaining = widgets.filter(w => w.id !== id)
    const existingSymbols = new Set(remaining.filter(w => w.kind === 'chart').map(w => w.symbol))

    const { x, y, w: srcW } = source.layout
    // Only create charts for symbols not already on the tab
    const newSymbols = source.symbols.filter(sym => !existingSymbols.has(sym))
    const newWidgets = newSymbols.map((sym, i) => ({
      id: Math.random().toString(36).slice(2, 10),
      kind: 'chart' as const,
      title: sym,
      symbol: sym,
      period: source.period,
      interval: '1d' as const,
      normalize: false,
      layout: {
        i: '',
        x: (x + i * 3) % 12,
        y: y,
        w: 3,
        h: source.layout.h,
        minW: 3,
        minH: 4,
      },
    })).map(w => ({ ...w, layout: { ...w.layout, i: w.id } }))

    onWidgetsChange([...remaining, ...newWidgets])
  }

  if (!widgets.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Click a stock in the ticker strip or use + Add to create widgets
      </div>
    )
  }

  const layout = widgets.map(w => ({
    i: w.id, x: w.layout.x, y: w.layout.y, w: w.layout.w, h: w.layout.h,
    minW: w.layout.minW ?? 2, minH: w.layout.minH ?? 3,
  }))

  return (
    <>
      <RGL
        layout={layout}
        cols={12}
        rowHeight={60}
        margin={[8, 8]}
        containerPadding={[8, 8]}
        draggableHandle=".widget-drag-handle"
        onLayoutChange={onLayoutChange}
        resizeHandles={['se']}
      >
        {widgets.map(w => {
          const primarySym = w.symbol ?? w.symbols?.[0] ?? ''
          const symbolColor = colorMap[primarySym] ?? '#6366f1'
          const otherTabs = allTabs
            .filter(t => t.id !== activeTabId)
            .map(t => ({ id: t.id, name: t.name, canAdd: canAddWidgetToTab(w, t.widgets) }))
          const copyToTab = onCopyWidget ? (tabId: string) => onCopyWidget(w.id, tabId) : undefined
          const moveToTab = onMoveWidget ? (tabId: string) => onMoveWidget(w.id, tabId) : undefined
          return (
            <div key={w.id}>
              {w.kind === 'chart' && (
                <ChartWidget
                  widget={w}
                  globalPeriod={globalPeriod}
                  symbolColor={symbolColor}
                  onRemove={() => removeWidget(w.id)}
                  onConvertToCombo={() => handleConvertToCombo(w.id)}
                  onPeriodChange={(p: Period) => updateWidget(w.id, { period: p })}
                  otherTabs={otherTabs}
                  onCopyToTab={copyToTab}
                  onMoveToTab={moveToTab}
                />
              )}
              {w.kind === 'combo' && (
                <ComboWidget
                  widget={w}
                  globalPeriod={globalPeriod}
                  symbolColor={symbolColor}
                  onRemove={() => removeWidget(w.id)}
                  onSplit={() => handleSplit(w.id)}
                  onPeriodChange={(p: Period) => updateWidget(w.id, { period: p })}
                  onNormalizeToggle={() => updateWidget(w.id, { normalize: !w.normalize })}
                  otherTabs={otherTabs}
                  onCopyToTab={copyToTab}
                  onMoveToTab={moveToTab}
                />
              )}
              {w.kind === 'news' && (
                <NewsWidget
                  widget={w}
                  symbolColor={symbolColor}
                  onRemove={() => removeWidget(w.id)}
                  otherTabs={otherTabs}
                  onCopyToTab={copyToTab}
                  onMoveToTab={moveToTab}
                />
              )}
              {w.kind === 'kpi' && (
                <KPIWidget
                  widget={w}
                  symbolColor={symbolColor}
                  onRemove={() => removeWidget(w.id)}
                  otherTabs={otherTabs}
                  onCopyToTab={copyToTab}
                  onMoveToTab={moveToTab}
                />
              )}
            </div>
          )
        })}
      </RGL>

      {combineModal && (
        <CombineModal
          sourceWidget={widgets.find(w => w.id === combineModal)!}
          availableSymbols={watchedSymbols}
          onConfirm={(syms) => handleCombineWith(combineModal, syms)}
          onClose={() => setCombineModal(null)}
        />
      )}
    </>
  )
}

function CombineModal({
  sourceWidget, availableSymbols, onConfirm, onClose,
}: {
  sourceWidget: Widget
  availableSymbols: string[]
  onConfirm: (symbols: string[]) => void
  onClose: () => void
}) {
  const existing = sourceWidget.symbols ?? (sourceWidget.symbol ? [sourceWidget.symbol] : [])
  const options = availableSymbols.filter(s => !existing.includes(s))
  const [selected, setSelected] = useState<string[]>([])
  const [custom, setCustom] = useState('')

  function toggle(sym: string) {
    setSelected(prev => prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym])
  }

  function addCustom() {
    const s = custom.trim().toUpperCase()
    if (!s || selected.includes(s) || existing.includes(s)) return
    setSelected(prev => [...prev, s])
    setCustom('')
  }

  const allSelected = [...selected]

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-5 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-white mb-1">Combine into Multi-Line Chart</h3>
        <p className="text-xs text-gray-500 mb-3">
          Base: <span className="text-indigo-400">{existing.join(', ')}</span>
        </p>

        {options.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {options.map(sym => (
              <button
                key={sym}
                onClick={() => toggle(sym)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  selected.includes(sym)
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-border text-gray-400 hover:border-gray-400'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <input
            value={custom}
            onChange={e => setCustom(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            placeholder="Add any ticker…"
            maxLength={10}
            className="flex-1 bg-white/6 border border-border rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
          <button onClick={addCustom} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-500">
            Add
          </button>
        </div>

        {allSelected.length > 0 && (
          <p className="text-xs text-gray-400 mb-3">
            Adding: <span className="text-indigo-400">{allSelected.join(', ')}</span>
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
          <button
            onClick={() => onConfirm(allSelected)}
            disabled={allSelected.length === 0}
            className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Combine
          </button>
        </div>
      </div>
    </div>
  )
}
