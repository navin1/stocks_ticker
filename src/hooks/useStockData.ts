import { useQuery } from '@tanstack/react-query'
import { fetchChart, fetchQuotes, fetchFundamentals, fetchNews, fetchMultiHistory } from '../api/yahoo'
import type { Period, Interval } from '../types'

// Short periods need frequent refresh; long periods only need occasional updates
function periodRefetch(period: Period): number {
  if (period === '1d') return 30_000          // 30 s — intraday
  if (period === '5d') return 60_000          // 1 min
  return 5 * 60_000                           // 5 min for weekly/monthly/yearly
}

export function useQuotes(symbols: string[]) {
  return useQuery({
    queryKey: ['quotes', symbols.join(',')],
    queryFn: () => fetchQuotes(symbols),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: symbols.length > 0,
  })
}

export function useChart(symbol: string, period: Period, interval: Interval) {
  const ri = periodRefetch(period)
  return useQuery({
    queryKey: ['chart', symbol, period, interval],
    queryFn: () => fetchChart(symbol, period, interval),
    staleTime: ri,
    refetchInterval: ri,
    enabled: !!symbol,
  })
}

export function useMultiChart(symbols: string[], period: Period, interval: Interval, normalize: boolean) {
  const ri = periodRefetch(period)
  return useQuery({
    queryKey: ['multi-chart', symbols.join(','), period, interval, normalize],
    queryFn: () => fetchMultiHistory(symbols, period, interval, normalize),
    staleTime: ri,
    refetchInterval: ri,
    enabled: symbols.length > 0,
  })
}

export function useFundamentals(symbol: string) {
  return useQuery({
    queryKey: ['fundamentals', symbol],
    queryFn: () => fetchFundamentals(symbol),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    enabled: !!symbol,
  })
}

export function useNews(symbols: string[]) {
  return useQuery({
    queryKey: ['news', symbols.join(',')],
    queryFn: () => fetchNews(symbols),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    enabled: symbols.length > 0,
  })
}
