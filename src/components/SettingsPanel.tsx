import { useState } from 'react'
import { X, Plus, Trash2, Key, RefreshCw } from 'lucide-react'
import type { AppSettings } from '../types'

interface Props {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}

export function SettingsPanel({ settings, onSave, onClose }: Props) {
  const [symbols, setSymbols] = useState([...settings.symbols])
  const [apiKey, setApiKey] = useState(settings.geminiApiKey)
  const [newSym, setNewSym] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(settings.autoRefresh)
  const [refreshInterval, setRefreshInterval] = useState(settings.refreshInterval)

  function addSymbol() {
    const s = newSym.trim().toUpperCase()
    if (!s || symbols.includes(s)) return
    setSymbols([...symbols, s])
    setNewSym('')
  }

  function removeSymbol(s: string) {
    setSymbols(symbols.filter(x => x !== s))
  }

  function save() {
    onSave({ ...settings, symbols, geminiApiKey: apiKey, autoRefresh, refreshInterval })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl p-6 w-[420px] shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Watchlist */}
        <section className="mb-5">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-2">
            Watchlist
          </label>
          <div className="flex gap-2 mb-2">
            <input
              value={newSym}
              onChange={e => setNewSym(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && addSymbol()}
              placeholder="Add ticker (e.g. NVDA)"
              maxLength={10}
              className="flex-1 bg-white/6 border border-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={addSymbol}
              className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {symbols.map(s => (
              <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-white/6 border border-border rounded-full text-xs text-gray-300">
                {s}
                <button onClick={() => removeSymbol(s)} className="text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={10} />
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Gemini API key */}
        <section className="mb-5">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Key size={11} /> Gemini API Key (for AI chat)
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full bg-white/6 border border-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <p className="text-[10px] text-gray-600 mt-1">
            Get a free key at aistudio.google.com. Stored locally in your browser.
          </p>
        </section>

        {/* Auto-refresh */}
        <section className="mb-5">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <RefreshCw size={11} /> Auto-refresh
          </label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="accent-indigo-600"
              />
              Enable
            </label>
            {autoRefresh && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                every
                <input
                  type="number"
                  value={refreshInterval}
                  onChange={e => setRefreshInterval(Number(e.target.value))}
                  min={10}
                  max={3600}
                  className="w-16 bg-white/6 border border-border rounded px-2 py-0.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                seconds
              </div>
            )}
          </div>
        </section>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button onClick={save} className="px-4 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
