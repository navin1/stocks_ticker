import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { BarChart2, Newspaper, MessageSquare, Settings, Plus, GitMerge, Sun, Moon, X } from 'lucide-react'
import { TickerStrip } from './components/TickerStrip'
import { WidgetGrid } from './components/WidgetGrid'
import { ChatPanel } from './components/ChatPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { useStorage } from './hooks/useStorage'
import { useQuotes, usePeriodQuotes } from './hooks/useStockData'
import { buildColorMap } from './utils/colors'
import type { Widget, Tab, AppSettings, Period, WidgetKind } from './types'

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
  return true
}

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

const DEFAULT_SETTINGS: AppSettings = {
  symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX', 'AMD', 'INTC', 'JPM', 'HD'],
  geminiApiKey: '',
  autoRefresh: false,
  refreshInterval: 60,
  theme: 'dark',
  globalPeriod: '3mo',
}

const GLOBAL_PERIODS: { label: string; value: Period }[] = [
  { label: '1D',  value: '1d'  },
  { label: '5D',  value: '5d'  },
  { label: '1M',  value: '1mo' },
  { label: '3M',  value: '3mo' },
  { label: '6M',  value: '6mo' },
  { label: '1Y',  value: '1y'  },
  { label: '2Y',  value: '2y'  },
  { label: '5Y',  value: '5y'  },
]

function nanoid() {
  return Math.random().toString(36).slice(2, 10)
}

function makeWidget(
  kind: WidgetKind,
  opts: { symbol?: string; symbols?: string[]; title?: string; period?: Period; normalize?: boolean },
  index: number,
  globalPeriod?: Period,
): Widget {
  const id = nanoid()
  const col = (index % 4) * 3
  const row = Math.floor(index / 4) * 4
  const defaults: Record<WidgetKind, { w: number; h: number; minW: number; minH: number }> = {
    chart: { w: 3, h: 4, minW: 3, minH: 4 },
    combo: { w: 4, h: 4, minW: 4, minH: 4 },
    news:  { w: 3, h: 4, minW: 3, minH: 4 },
    kpi:   { w: 2, h: 4, minW: 2, minH: 4 },
  }
  const d = defaults[kind]
  return {
    id,
    kind,
    title: opts.title ?? opts.symbol ?? opts.symbols?.join('+') ?? kind,
    symbol: opts.symbol,
    symbols: opts.symbols,
    period: opts.period ?? globalPeriod ?? '3mo',
    interval: '1d',
    normalize: opts.normalize ?? false,
    layout: { i: id, x: col, y: row, w: d.w, h: d.h, minW: d.minW, minH: d.minH },
  }
}

// ── Tab bar ────────────────────────────────────────────────────────────────

function TabBar({
  tabs, activeTabId, onSwitch, onAdd, onRename, onClose,
}: {
  tabs: Tab[]
  activeTabId: string
  onSwitch: (id: string) => void
  onAdd: () => void
  onRename: (id: string, name: string) => void
  onClose: (id: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(tab: Tab) {
    setEditing(tab.id)
    setDraft(tab.name)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    if (editing && draft.trim()) onRename(editing, draft.trim())
    setEditing(null)
  }

  return (
    <div className="flex items-center gap-1 px-3 py-1 bg-surface border-b border-border shrink-0 overflow-x-auto">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`group flex items-center gap-1 shrink-0 px-3 py-1 rounded-md text-xs transition-colors cursor-pointer select-none ${
            tab.id === activeTabId
              ? 'bg-indigo-600/20 text-white border border-indigo-500/40'
              : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          onClick={() => onSwitch(tab.id)}
          onDoubleClick={() => startEdit(tab)}
        >
          {editing === tab.id ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null) }}
              className="bg-transparent outline-none w-20 text-white text-xs"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span>{tab.name}</span>
          )}
          {tabs.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); onClose(tab.id) }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-all"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-white hover:bg-white/5 rounded-md transition-colors"
        title="Add tab"
      >
        <Plus size={11} /> Tab
      </button>
    </div>
  )
}

// ── Main app ───────────────────────────────────────────────────────────────

function AppInner() {
  const [settings, saveSettings, settingsLoaded] = useStorage<AppSettings>('gst_settings', DEFAULT_SETTINGS)
  const [tabs, saveTabs] = useStorage<Tab[]>('gst_tabs', [])
  const [showChat, setShowChat] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const theme = settings.theme ?? 'dark'
  const globalPeriod = settings.globalPeriod ?? '3mo'
  const watchlistSymbols = settings.symbols

  // Resolve active tab
  const activeTabId = settings.activeTabId ?? tabs[0]?.id ?? ''
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0]
  const widgets = activeTab?.widgets ?? []

  function saveWidgets(ws: Widget[]) {
    saveTabs(tabs.map(t => t.id === activeTab?.id ? { ...t, widgets: ws } : t))
  }

  // All unique symbols across ALL tabs (for ticker + color map)
  const allSymbols = useMemo(() => {
    const set = new Set(watchlistSymbols)
    for (const tab of tabs) {
      for (const w of tab.widgets) {
        if (w.symbol) set.add(w.symbol)
        if (w.symbols) w.symbols.forEach(s => set.add(s))
      }
    }
    return [...set]
  }, [watchlistSymbols, tabs])

  const queryClient = useQueryClient()
  const { data: quotes = [], isFetching: quotesFetching, dataUpdatedAt } = useQuotes(allSymbols)
  const { data: periodData } = usePeriodQuotes(allSymbols, globalPeriod)

  function refetchAll() {
    queryClient.refetchQueries()
  }
  const colorMap = useMemo(() => buildColorMap(allSymbols), [allSymbols])

  // Apply theme class to root element
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    root.classList.toggle('light', theme === 'light')
    root.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Auto-refresh
  useEffect(() => {
    if (!settings.autoRefresh) return
    const id = setInterval(() => refetchAll(), settings.refreshInterval * 1000)
    return () => clearInterval(id)
  }, [settings.autoRefresh, settings.refreshInterval])

  // Seed initial tab on first load
  useEffect(() => {
    if (!settingsLoaded) return
    if (tabs.length === 0 && watchlistSymbols.length > 0) {
      const id = nanoid()
      const seedWidgets = watchlistSymbols.map((sym, i) => makeWidget('chart', { symbol: sym }, i, globalPeriod))
      saveTabs([{ id, name: 'Dashboard', widgets: seedWidgets }])
      saveSettings({ ...settings, activeTabId: id })
    }
  }, [settingsLoaded])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab management ────────────────────────────────────────────────────

  function switchTab(id: string) {
    saveSettings({ ...settings, activeTabId: id })
  }

  function addTab() {
    const id = nanoid()
    const newTab: Tab = { id, name: `Tab ${tabs.length + 1}`, widgets: [] }
    saveTabs([...tabs, newTab])
    saveSettings({ ...settings, activeTabId: id })
  }

  function renameTab(id: string, name: string) {
    saveTabs(tabs.map(t => t.id === id ? { ...t, name } : t))
  }

  function copyWidgetToTab(widgetId: string, targetTabId: string) {
    const widget = widgets.find(w => w.id === widgetId)
    const targetTab = tabs.find(t => t.id === targetTabId)
    if (!widget || !targetTab || !canAddWidgetToTab(widget, targetTab.widgets)) return
    const newId = nanoid()
    saveTabs(tabs.map(t =>
      t.id === targetTabId
        ? { ...t, widgets: [...t.widgets, { ...widget, id: newId, layout: { ...widget.layout, i: newId } }] }
        : t
    ))
  }

  function moveWidgetToTab(widgetId: string, targetTabId: string) {
    const widget = widgets.find(w => w.id === widgetId)
    const targetTab = tabs.find(t => t.id === targetTabId)
    if (!widget || !targetTab || !canAddWidgetToTab(widget, targetTab.widgets)) return
    const newId = nanoid()
    saveTabs(tabs.map(t => {
      if (t.id === activeTab?.id) return { ...t, widgets: t.widgets.filter(w => w.id !== widgetId) }
      if (t.id === targetTabId) return { ...t, widgets: [...t.widgets, { ...widget, id: newId, layout: { ...widget.layout, i: newId } }] }
      return t
    }))
  }

  function closeTab(id: string) {
    const remaining = tabs.filter(t => t.id !== id)
    saveTabs(remaining)
    if (activeTabId === id) {
      saveSettings({ ...settings, activeTabId: remaining[0]?.id })
    }
  }

  // ── Global period — applies to active tab only ────────────────────────

  function applyGlobalPeriod(p: Period) {
    saveSettings({ ...settings, globalPeriod: p })
    saveWidgets(widgets.map(w =>
      (w.kind === 'chart' || w.kind === 'combo') ? { ...w, period: p } : w
    ))
  }

  function toggleTheme() {
    saveSettings({ ...settings, theme: theme === 'dark' ? 'light' : 'dark' })
  }

  const handleWidgetsChange = useCallback((ws: Widget[]) => {
    saveWidgets(ws)
  }, [tabs, activeTab])  // eslint-disable-line react-hooks/exhaustive-deps

  function addChartWidget(symbol: string) {
    const existing = widgets.find(w => w.kind === 'chart' && w.symbol === symbol)
    if (existing) return
    saveWidgets([...widgets, makeWidget('chart', { symbol }, widgets.length, globalPeriod)])
  }

  function addWidget(kind: WidgetKind, opts: { symbol?: string; symbols?: string[]; title?: string; period?: Period; normalize?: boolean }) {
    if (kind === 'chart' && opts.symbol) {
      const dupe = widgets.find(w => w.kind === 'chart' && w.symbol === opts.symbol)
      if (dupe) { setAddMenuOpen(false); return }
    }
    saveWidgets([...widgets, makeWidget(kind, opts, widgets.length, globalPeriod)])
    setAddMenuOpen(false)
  }

  function handleChatAddWidget(action: Partial<Widget>) {
    const kind = (action.kind as WidgetKind) ?? 'chart'
    const syms = (action.symbols as string[]) ?? []
    const sym = (action.symbol as string) ?? ''
    const period = (action.period as Period) ?? globalPeriod
    const normalize = Boolean(action.normalize)

    if (kind === 'combo' && syms.length > 0) addWidget('combo', { symbols: syms, period, normalize })
    else if (kind === 'news') addWidget('news', { symbols: syms.length ? syms : sym ? [sym] : watchlistSymbols })
    else if (kind === 'kpi' && sym) addWidget('kpi', { symbol: sym })
    else if (sym) addWidget('chart', { symbol: sym, period })
  }

  if (!settingsLoaded) {
    return <div className="flex-1 flex items-center justify-center"><div className="text-gray-600 text-sm">Loading…</div></div>
  }

  return (
    <div className={`flex flex-col h-screen ${theme === 'light' ? 'light' : ''}`}>
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <BarChart2 size={16} className="text-indigo-400" />
          <span className="text-xl font-bold text-white tracking-tight">Stock Ticker</span>
        </div>

        {/* Global period selector */}
        <div className="flex items-center gap-0.5 ml-4 bg-white/4 rounded-lg p-0.5">
          {GLOBAL_PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => applyGlobalPeriod(p.value)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                globalPeriod === p.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              title={`Set active tab charts to ${p.label}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Add widget menu */}
        <div className="relative">
          <button
            onClick={() => setAddMenuOpen(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-white border border-border hover:border-gray-500 rounded-lg transition-colors"
          >
            <Plus size={12} /> Add
          </button>
          {addMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-40 py-1 min-w-[160px]">
              {[
                { icon: BarChart2, label: 'Price Chart', action: () => {
                  const sym = prompt('Ticker symbol (e.g. NVDA):')?.trim().toUpperCase()
                  if (sym) addWidget('chart', { symbol: sym })
                }},
                { icon: GitMerge, label: 'Combined Chart', action: () => {
                  const raw = prompt('Comma-separated tickers (e.g. AAPL,MSFT,GOOGL):')
                  const syms = raw?.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) ?? []
                  if (syms.length > 1) addWidget('combo', { symbols: syms })
                }},
                { icon: Newspaper, label: 'News Feed', action: () => {
                  const sym = prompt('Ticker (blank for all watched):')?.trim().toUpperCase()
                  addWidget('news', { symbols: sym ? [sym] : watchlistSymbols })
                }},
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { item.action(); setAddMenuOpen(false) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <item.icon size={12} className="text-indigo-400" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowChat(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
            showChat
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
              : 'border-border text-gray-400 hover:text-white hover:border-gray-500'
          }`}
        >
          <MessageSquare size={12} /> Chat
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 text-gray-400 hover:text-white transition-colors"
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <button onClick={() => setShowSettings(true)} className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Settings">
          <Settings size={15} />
        </button>
      </header>

      {/* Tab bar */}
      {tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitch={switchTab}
          onAdd={addTab}
          onRename={renameTab}
          onClose={closeTab}
        />
      )}

      {/* Ticker strip */}
      <TickerStrip
        quotes={quotes}
        colorMap={colorMap}
        onClickSymbol={addChartWidget}
        onRefresh={refetchAll}
        isFetching={quotesFetching}
        updatedAt={dataUpdatedAt}
        globalPeriod={globalPeriod}
        periodData={periodData}
      />

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto min-h-0">
          <WidgetGrid
            widgets={widgets}
            onWidgetsChange={handleWidgetsChange}
            watchedSymbols={allSymbols}
            globalPeriod={globalPeriod}
            colorMap={colorMap}
            allTabs={tabs}
            activeTabId={activeTabId}
            onCopyWidget={copyWidgetToTab}
            onMoveWidget={moveWidgetToTab}
          />
        </div>

        {showChat && (
          <ChatPanel
            symbols={watchlistSymbols}
            apiKey={settings.geminiApiKey}
            onAddWidget={handleChatAddWidget}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {addMenuOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setAddMenuOpen(false)} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AppInner />
    </QueryClientProvider>
  )
}
