import type { Candle, Quote, Fundamentals, NewsItem } from '../types'

const Q1 = 'https://query1.finance.yahoo.com'
const Q2 = 'https://query2.finance.yahoo.com'
const RSS = 'https://feeds.finance.yahoo.com'

const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
}

// Include browser cookies so Yahoo Finance session is shared (enables crumb auth)
const FETCH_OPTS: RequestInit = { headers: HEADERS, credentials: 'include' }

async function yfetch(url: string, asText = false) {
  const urls = [url, url.replace(Q1, Q2)]
  let lastErr: Error = new Error('fetch failed')
  for (const u of urls) {
    try {
      const res = await fetch(u, FETCH_OPTS)
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue }
      return asText ? res.text() : res.json()
    } catch (e) { lastErr = e as Error }
  }
  throw lastErr
}

// ── Crumb (enables v10/quoteSummary which has the richest fundamentals) ───────

let _crumb: string | null = null
let _crumbAt = 0

async function getCrumb(): Promise<string | null> {
  if (_crumb && Date.now() - _crumbAt < 30 * 60_000) return _crumb
  try {
    const res = await fetch(`${Q1}/v1/test/getcrumb`, FETCH_OPTS)
    if (!res.ok) return null
    const text = (await res.text()).trim()
    // A valid crumb is a short alphanumeric string, not JSON
    if (!text || text.length > 60 || text.startsWith('{')) return null
    _crumb = text
    _crumbAt = Date.now()
    return _crumb
  } catch {
    return null
  }
}

// ── Chart (quote + OHLCV) ─────────────────────────────────────────────────────

export async function fetchChart(
  symbol: string,
  range = '3mo',
  interval = '1d',
): Promise<{ quote: Quote; candles: Candle[] }> {
  const url = `${Q1}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`
  const json = await yfetch(url)
  const result = json.chart?.result?.[0]
  if (!result) throw new Error(`No data for ${symbol}`)

  const meta = result.meta
  const quote: Quote = {
    symbol: symbol.toUpperCase(),
    name: meta.longName || meta.shortName || symbol,
    price: meta.regularMarketPrice ?? null,
    prevClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
    change: meta.regularMarketPrice != null && (meta.chartPreviousClose ?? meta.previousClose) != null
      ? meta.regularMarketPrice - (meta.chartPreviousClose ?? meta.previousClose)
      : null,
    changePct: meta.regularMarketChangePercent ?? null,
    currency: meta.currency ?? 'USD',
    marketCap: meta.marketCap ?? null,
  }

  const timestamps: number[] = result.timestamp ?? []
  const ohlcv = result.indicators?.quote?.[0] ?? {}
  const intraday = ['1m', '5m', '15m', '60m'].includes(interval)
  const candles: Candle[] = timestamps.map((ts, i) => ({
    date: intraday
      ? new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      : new Date(ts * 1000).toISOString().slice(0, 10),
    open:   ohlcv.open?.[i]   ?? null,
    high:   ohlcv.high?.[i]   ?? null,
    low:    ohlcv.low?.[i]    ?? null,
    close:  ohlcv.close?.[i]  ?? null,
    volume: ohlcv.volume?.[i] ?? null,
  })).filter(c => c.close != null)

  return { quote, candles }
}

// ── Quick quotes for multiple symbols ─────────────────────────────────────────

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const results = await Promise.allSettled(
    symbols.map(s => fetchChart(s, '1d', '1d').then(r => r.quote))
  )
  return results
    .map((r, i) => r.status === 'fulfilled' ? r.value : {
      symbol: symbols[i].toUpperCase(),
      name: symbols[i].toUpperCase(),
      price: null, prevClose: null, change: null, changePct: null,
      currency: 'USD', marketCap: null,
    })
}

// ── Fundamentals ──────────────────────────────────────────────────────────────

export async function fetchFundamentals(symbol: string): Promise<Fundamentals> {
  // Strategy 1: v10/quoteSummary with crumb — richest data (PE, EPS, beta, sector, div)
  // Requires a Yahoo Finance session cookie in the browser (very common)
  const crumb = await getCrumb()
  if (crumb) {
    try {
      const modules = 'summaryDetail,defaultKeyStatistics,price,financialData'
      const url = `${Q1}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`
      const json = await yfetch(url)
      const res = json.quoteSummary?.result?.[0]
      if (res) {
        const p  = res.price ?? {}
        const sd = res.summaryDetail ?? {}
        const ks = res.defaultKeyStatistics ?? {}
        return {
          symbol: symbol.toUpperCase(),
          name: p.longName?.raw ?? p.shortName?.raw ?? symbol,
          price: p.regularMarketPrice?.raw ?? null,
          changePct: p.regularMarketChangePercent?.raw ?? null,
          marketCap: p.marketCap?.raw ?? null,
          pe: sd.trailingPE?.raw ?? null,
          eps: ks.trailingEps?.raw ?? null,
          high52: sd.fiftyTwoWeekHigh?.raw ?? null,
          low52: sd.fiftyTwoWeekLow?.raw ?? null,
          beta: sd.beta?.raw ?? null,
          divYield: sd.dividendYield?.raw != null ? sd.dividendYield.raw * 100 : null,
          sector: p.sector?.raw ?? '',
          volume: p.regularMarketVolume?.raw ?? null,
          avgVolume: p.averageVolume?.raw ?? null,
        }
      }
    } catch { /* crumb might be stale — invalidate and fall through */ _crumb = null }
  }

  // Strategy 2: v7/finance/quote — no crumb needed, flat JSON format
  try {
    const url = `${Q1}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`
    const json = await yfetch(url)
    const r = json.quoteResponse?.result?.[0]
    if (r?.regularMarketPrice != null) {
      return {
        symbol: symbol.toUpperCase(),
        name: r.longName ?? r.shortName ?? symbol,
        price: r.regularMarketPrice ?? null,
        changePct: r.regularMarketChangePercent ?? null,
        marketCap: r.marketCap ?? null,
        pe: r.trailingPE ?? null,
        eps: r.epsTrailingTwelveMonths ?? null,
        high52: r.fiftyTwoWeekHigh ?? null,
        low52: r.fiftyTwoWeekLow ?? null,
        beta: r.beta ?? null,
        divYield: r.trailingAnnualDividendYield != null ? r.trailingAnnualDividendYield * 100 : null,
        sector: r.sector ?? '',
        volume: r.regularMarketVolume ?? null,
        avgVolume: r.averageDailyVolume3Month ?? null,
      }
    }
  } catch { /* fall through */ }

  // Strategy 3: v8/chart 1y — always works; compute 52w high/low from candle data
  const { quote, candles } = await fetchChart(symbol, '1y', '1d')
  const highs = candles.map(c => c.high).filter((v): v is number => v != null)
  const lows  = candles.map(c => c.low).filter((v): v is number => v != null)
  return {
    symbol: symbol.toUpperCase(),
    name: quote.name ?? symbol,
    price: quote.price,
    changePct: quote.changePct,
    marketCap: quote.marketCap,
    pe: null,
    eps: null,
    high52: highs.length ? Math.max(...highs) : null,
    low52:  lows.length  ? Math.min(...lows)  : null,
    beta: null,
    divYield: null,
    sector: '',
    volume: null,
    avgVolume: null,
  }
}

// ── News (RSS) ────────────────────────────────────────────────────────────────

function parseRSS(xml: string, symbol: string): NewsItem[] {
  const items: NewsItem[] = []
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const nodes = Array.from(doc.querySelectorAll('item'))
  for (const node of nodes) {
    const title = node.querySelector('title')?.textContent?.trim() ?? ''
    const description = node.querySelector('description')?.textContent?.trim() ?? ''
    const link = node.querySelector('link')?.textContent?.trim() ?? ''
    const pubDate = node.querySelector('pubDate')?.textContent?.trim() ?? ''
    const source = node.querySelector('source')?.textContent?.trim() ?? 'Yahoo Finance'
    if (!title) continue
    items.push({ title, summary: description, url: link, published: pubDate, source, symbol })
  }
  return items
}

export async function fetchNews(symbols: string[], count = 8): Promise<NewsItem[]> {
  const all: NewsItem[] = []
  const seen = new Set<string>()
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000  // 1 week

  await Promise.allSettled(symbols.map(async sym => {
    const url = `${RSS}/rss/2.0/headline?s=${encodeURIComponent(sym)}&region=US&lang=en-US`
    const text = await fetch(url).then(r => r.text()).catch(() => '')
    if (!text) return
    const items = parseRSS(text, sym.toUpperCase())
    for (const item of items.slice(0, count)) {
      if (seen.has(item.title)) continue
      const d = new Date(item.published).getTime()
      if (!isNaN(d) && d < cutoff) continue
      seen.add(item.title)
      all.push(item)
    }
  }))

  return all.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())
}

// ── Period-based quotes for the ticker strip ─────────────────────────────────

export type PeriodStat = { change: number | null; changePct: number | null }

export async function fetchPeriodQuotes(
  symbols: string[],
  period: string,
): Promise<Record<string, PeriodStat>> {
  const results = await Promise.allSettled(
    symbols.map(s => fetchChart(s, period, '1d'))
  )
  const out: Record<string, PeriodStat> = {}
  results.forEach((res, i) => {
    const sym = symbols[i].toUpperCase()
    if (res.status !== 'fulfilled') { out[sym] = { change: null, changePct: null }; return }
    const { quote, candles } = res.value
    const valid = candles.filter(c => c.close != null)
    if (!valid.length || quote.price == null) { out[sym] = { change: null, changePct: null }; return }
    const firstClose = valid[0].close!
    const change = quote.price - firstClose
    out[sym] = { change, changePct: (change / firstClose) * 100 }
  })
  return out
}

// ── Multi-symbol history (long format) ───────────────────────────────────────

export interface MultiCandle {
  date: string
  symbol: string
  close: number
  pctChange?: number
}

export async function fetchMultiHistory(
  symbols: string[],
  range = '3mo',
  interval = '1d',
  normalize = false,
): Promise<MultiCandle[]> {
  const results = await Promise.allSettled(
    symbols.map(s => fetchChart(s, range, interval))
  )

  const rows: MultiCandle[] = []
  results.forEach((res, i) => {
    if (res.status !== 'fulfilled') return
    const sym = symbols[i].toUpperCase()
    const candles = res.value.candles.filter(c => c.close != null)
    const base = candles[0]?.close ?? null
    candles.forEach(c => {
      const entry: MultiCandle = { date: c.date, symbol: sym, close: c.close! }
      if (normalize && base) entry.pctChange = ((c.close! - base) / base) * 100
      rows.push(entry)
    })
  })

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}
