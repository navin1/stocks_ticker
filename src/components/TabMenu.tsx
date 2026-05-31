import { useState } from 'react'
import { Share2 } from 'lucide-react'

interface TabOption {
  id: string
  name: string
  canAdd: boolean
}

interface Props {
  tabs: TabOption[]
  onCopy: (tabId: string) => void
  onMove: (tabId: string) => void
}

export function TabMenu({ tabs, onCopy, onMove }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1 text-gray-500 hover:text-indigo-400 transition-colors"
        title="Copy / Move to another tab"
      >
        <Share2 size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-50 py-1.5 min-w-[150px]">
            {tabs.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">No other tabs</div>
            ) : (
              <>
                <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wide">Copy to</div>
                {tabs.map(t => (
                  <button
                    key={`c-${t.id}`}
                    disabled={!t.canAdd}
                    onClick={() => { onCopy(t.id); setOpen(false) }}
                    className="flex w-full px-3 py-1.5 text-xs text-left transition-colors
                      disabled:text-gray-600 disabled:cursor-not-allowed
                      enabled:text-gray-300 enabled:hover:text-white enabled:hover:bg-white/5"
                  >
                    {t.name}
                  </button>
                ))}
                <div className="border-t border-border my-1" />
                <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wide">Move to</div>
                {tabs.map(t => (
                  <button
                    key={`m-${t.id}`}
                    disabled={!t.canAdd}
                    onClick={() => { onMove(t.id); setOpen(false) }}
                    className="flex w-full px-3 py-1.5 text-xs text-left transition-colors
                      disabled:text-gray-600 disabled:cursor-not-allowed
                      enabled:text-gray-300 enabled:hover:text-white enabled:hover:bg-white/5"
                  >
                    {t.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
