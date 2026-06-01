import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Key, RefreshCw, LogIn } from 'lucide-react'
import { googleLogin, testConnection } from '../api/gemini'
import { launchOAuth } from '../api/auth'
import { saveServiceAccount, loadServiceAccount, getVertexToken } from '../api/jwtAuth'
import type { AppSettings } from '../types'

const GCP_REGIONS = [
  'us-central1', 'us-east1', 'us-east4', 'us-west1',
  'europe-west1', 'europe-west2', 'europe-west4',
  'asia-east1', 'asia-northeast1', 'asia-southeast1',
]

interface Props {
  settings: AppSettings
  onSave: (s: AppSettings) => void
  onClose: () => void
}

export function SettingsPanel({ settings, onSave, onClose }: Props) {
  const [symbols, setSymbols]           = useState([...settings.symbols])
  const [newSym, setNewSym]             = useState('')
  const [autoRefresh, setAutoRefresh]   = useState(settings.autoRefresh)
  const [refreshInterval, setRefreshInterval] = useState(settings.refreshInterval)

  // GCP / Gemini settings
  const [authMode, setAuthMode]         = useState<'manual' | 'oauth' | 'json'>(settings.gcpAuthMode ?? 'manual')
  const [manualToken, setManualToken]   = useState(settings.geminiApiKey)
  const [projectId, setProjectId]       = useState(settings.gcpProjectId)
  const [region, setRegion]             = useState(settings.gcpRegion ?? 'us-central1')
  const [oauthClientId, setOauthClientId] = useState(settings.gcpOauthClientId)
  const [saJson, setSaJson]             = useState('')
  const [saEmail, setSaEmail]           = useState('')
  const [testState, setTestState]       = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [testError, setTestError]       = useState('')
  const [oauthState, setOauthState]     = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [oauthError, setOauthError]     = useState('')
  const [gloginState, setGloginState]   = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [gloginError, setGloginError]   = useState('')
  const [tokenMethod, setTokenMethod]   = useState<'adc' | 'user'>('adc')

  useEffect(() => {
    loadServiceAccount().then(sa => { if (sa) setSaEmail(sa.client_email) })
  }, [])

  function addSymbol() {
    const s = newSym.trim().toUpperCase()
    if (!s || symbols.includes(s)) return
    setSymbols([...symbols, s])
    setNewSym('')
  }

  function removeSymbol(s: string) {
    setSymbols(symbols.filter(x => x !== s))
  }

  async function handleSaUpload(text: string) {
    setSaJson(text)
    try {
      const parsed = JSON.parse(text)
      await saveServiceAccount(text)
      setSaEmail(parsed.client_email ?? '')
      if (!projectId && parsed.project_id) setProjectId(parsed.project_id)
    } catch { /* invalid json, ignore */ }
  }

  async function handleTest() {
    setTestState('loading'); setTestError('')
    try {
      let token = ''
      if (authMode === 'manual') token = manualToken
      else if (authMode === 'oauth') token = await launchOAuth(oauthClientId)
      else token = await getVertexToken()
      await testConnection(token, projectId, region)
      setTestState('ok')
    } catch (e) {
      setTestError((e as Error).message)
      setTestState('error')
    }
  }

  async function handleOAuthLogin() {
    if (!oauthClientId) { setOauthError('Enter an OAuth Client ID first.'); setOauthState('error'); return }
    setOauthState('loading'); setOauthError('')
    try {
      await launchOAuth(oauthClientId)
      setOauthState('ok')
    } catch (e) { setOauthError((e as Error).message); setOauthState('error') }
  }

  async function handleGoogleLogin() {
    setGloginState('loading'); setGloginError('')
    try {
      const token = await googleLogin()
      setManualToken(token)
      setAuthMode('manual')
      setGloginState('ok')
    } catch (e) { setGloginError((e as Error).message); setGloginState('error') }
  }

  function save() {
    onSave({
      ...settings,
      symbols,
      geminiApiKey: manualToken,
      gcpProjectId: projectId,
      gcpRegion: region,
      gcpAuthMode: authMode,
      gcpOauthClientId: oauthClientId,
      autoRefresh,
      refreshInterval,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl p-6 w-[440px] shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition-colors"><X size={14} /></button>
        </div>

        {/* Watchlist */}
        <section className="mb-5">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-2">Watchlist</label>
          <div className="flex gap-2 mb-2">
            <input
              value={newSym}
              onChange={e => setNewSym(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && addSymbol()}
              placeholder="Add ticker (e.g. NVDA)"
              maxLength={10}
              className="flex-1 bg-white/6 border border-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button onClick={addSymbol} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
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

        {/* Gemini / Vertex AI */}
        <section className="mb-5">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-3">
            <Key size={11} /> Gemini (Vertex AI)
          </label>

          {/* Project + Region */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <p className="text-[10px] text-gray-500 mb-1">GCP Project ID</p>
              <input
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                placeholder="my-gcp-project"
                className="w-full bg-white/6 border border-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 mb-1">Region</p>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="bg-white/6 border border-border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {GCP_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Auth mode selector */}
          <div className="flex mb-3 bg-white/4 rounded-lg p-0.5 border border-border">
            {(['manual', 'oauth', 'json'] as const).map(m => (
              <button
                key={m}
                onClick={() => setAuthMode(m)}
                className={`flex-1 py-1 text-[11px] rounded-md transition-colors capitalize ${authMode === m ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {m === 'manual' ? 'Manual Token' : m === 'oauth' ? 'OAuth' : 'Service Account'}
              </button>
            ))}
          </div>

          {/* Manual token */}
          {authMode === 'manual' && (
            <div className="space-y-2">
              <button
                onClick={handleGoogleLogin}
                disabled={gloginState === 'loading'}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs border border-border rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
              >
                <LogIn size={12} className="text-indigo-400 shrink-0" />
                {gloginState === 'loading' ? 'Signing in…' : gloginState === 'ok' ? '✓ Token captured' : 'Login with Google (browser)'}
              </button>
              {gloginState === 'error' && <p className="text-[10px] text-red-400">{gloginError}</p>}

              <input
                type="password"
                value={manualToken}
                onChange={e => { setManualToken(e.target.value); setGloginState('idle') }}
                placeholder="Paste token from gcloud"
                className="w-full bg-white/6 border border-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />

              <div className="flex mb-1 bg-white/4 rounded-lg p-0.5 border border-border">
                {(['adc', 'user'] as const).map(m => (
                  <button key={m} onClick={() => setTokenMethod(m)}
                    className={`flex-1 py-0.5 text-[10px] rounded-md transition-colors ${tokenMethod === m ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
                  >
                    {m === 'adc' ? 'Application Default' : 'User Credentials'}
                  </button>
                ))}
              </div>
              <div className="p-2 bg-white/4 rounded-md border border-border space-y-1.5">
                <p className="text-[10px] font-mono text-green-400 select-all">
                  {tokenMethod === 'adc' ? 'gcloud auth application-default print-access-token' : 'gcloud auth print-access-token'}
                </p>
                <p className="text-[10px] text-gray-600">Expires in ~1 hour. Uses <span className="text-gray-400">cloud-platform</span> scope (no re-auth needed).</p>
              </div>
            </div>
          )}

          {/* OAuth */}
          {authMode === 'oauth' && (
            <div className="space-y-2">
              <input
                value={oauthClientId}
                onChange={e => setOauthClientId(e.target.value)}
                placeholder="OAuth 2.0 Client ID (Web Application type)"
                className="w-full bg-white/6 border border-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={handleOAuthLogin}
                disabled={oauthState === 'loading'}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs border border-border rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
              >
                <LogIn size={12} className="text-indigo-400 shrink-0" />
                {oauthState === 'loading' ? 'Authorising…' : oauthState === 'ok' ? '✓ Authorised' : 'Authorise with Google'}
              </button>
              {oauthState === 'error' && <p className="text-[10px] text-red-400">{oauthError}</p>}
              <p className="text-[10px] text-gray-600">
                Add <span className="text-gray-400 font-mono select-all">{typeof chrome !== 'undefined' ? chrome.identity?.getRedirectURL?.() ?? '…' : '…'}</span> as an authorised redirect URI in your OAuth client.
              </p>
            </div>
          )}

          {/* Service Account JSON */}
          {authMode === 'json' && (
            <div className="space-y-2">
              {saEmail && (
                <p className="text-[10px] text-green-400">✓ Loaded: {saEmail}</p>
              )}
              <textarea
                value={saJson}
                onChange={e => handleSaUpload(e.target.value)}
                placeholder='Paste service account JSON key ({"type":"service_account",...})'
                rows={5}
                className="w-full bg-white/6 border border-border rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 font-mono resize-none focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-[10px] text-gray-600">Stored locally in the browser. Auto-refreshes every hour — no manual token needed.</p>
            </div>
          )}
        </section>

        {/* Auto-refresh */}
        <section className="mb-5">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <RefreshCw size={11} /> Auto-refresh
          </label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="accent-indigo-600" />
              Enable
            </label>
            {autoRefresh && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                every
                <input
                  type="number" value={refreshInterval}
                  onChange={e => setRefreshInterval(Number(e.target.value))}
                  min={10} max={3600}
                  className="w-16 bg-white/6 border border-border rounded px-2 py-0.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                seconds
              </div>
            )}
          </div>
        </section>

        {/* Test connection */}
        <div className="mb-4">
          <button
            onClick={handleTest}
            disabled={testState === 'loading'}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs border border-border rounded-lg text-gray-300 hover:text-white hover:border-indigo-500 transition-colors disabled:opacity-50"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              testState === 'ok'      ? 'bg-green-400' :
              testState === 'error'   ? 'bg-red-400' :
              testState === 'loading' ? 'bg-yellow-400 animate-pulse' :
              'bg-gray-600'
            }`} />
            {testState === 'loading' ? 'Testing connection…' :
             testState === 'ok'      ? '✓ Connected — token accepted' :
             testState === 'error'   ? 'Connection failed' :
             'Test Connection'}
          </button>
          {testState === 'error' && (
            <p className="mt-1 text-[10px] text-red-400 break-words">{testError}</p>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} className="px-4 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">Save</button>
        </div>
      </div>
    </div>
  )
}
