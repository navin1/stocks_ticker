export type WidgetKind = 'chart' | 'news' | 'kpi' | 'combo'

export type Period = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | 'ytd' | 'max'
export type Interval = '1m' | '5m' | '15m' | '60m' | '1d' | '1wk' | '1mo'

export interface GridLayout {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export interface Widget {
  id: string
  kind: WidgetKind
  title: string
  symbol?: string        // single-symbol widgets
  symbols?: string[]     // combo charts
  period: Period
  interval: Interval
  normalize?: boolean    // combo: show % return from period start
  layout: GridLayout
}

export interface Candle {
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number | null
}

export interface Quote {
  symbol: string
  price: number | null
  prevClose: number | null
  change: number | null
  changePct: number | null
  currency: string
  marketCap: number | null
  name: string
}

export interface Fundamentals {
  symbol: string
  name: string
  price: number | null
  changePct: number | null
  marketCap: number | null
  pe: number | null
  eps: number | null
  high52: number | null
  low52: number | null
  beta: number | null
  divYield: number | null
  sector: string
  volume: number | null
  avgVolume: number | null
}

export interface NewsItem {
  title: string
  summary: string
  url: string
  published: string
  source: string
  symbol: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface Tab {
  id: string
  name: string
  widgets: Widget[]
}

export interface AppSettings {
  symbols: string[]
  geminiApiKey: string        // manual GCP token
  gcpProjectId: string
  gcpRegion: string
  gcpAuthMode: 'manual' | 'oauth' | 'json'
  gcpOauthClientId: string
  autoRefresh: boolean
  refreshInterval: number  // seconds
  theme: 'dark' | 'light'
  globalPeriod: Period
  activeTabId?: string
}
