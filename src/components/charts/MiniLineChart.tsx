import { useRef, useState, useLayoutEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, Legend,
} from 'recharts'

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa']

// Measures a container div and re-measures whenever it resizes.
function useChartSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return [ref, size] as const
}

interface SingleProps {
  data: { date: string; close: number | null }[]
  color?: string
  basePrice?: number
}

export function SingleLineChart({ data, color = '#6366f1', basePrice }: SingleProps) {
  const [containerRef, { width, height }] = useChartSize()

  const prices = data.map(d => d.close).filter((v): v is number => v != null)
  const noData = !prices.length

  const min = noData ? 0 : Math.min(...prices)
  const max = noData ? 1 : Math.max(...prices)
  const pad = (max - min) * 0.08 || max * 0.02 || 1
  const domain: [number, number] = [min - pad, max + pad]

  const fmt = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`

  // 'HH:MM' = intraday (length ≤ 5), 'YYYY-MM-DD' = daily+
  const fmtTick = (v: string) => v.length <= 5 ? v : v.slice(5, 10)

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 80 }}>
      {noData ? (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">No data</div>
      ) : width > 0 && height > 0 ? (
        <LineChart data={data} width={width} height={height} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtTick}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={fmt}
          />
          <Tooltip
            contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 6 }}
            labelStyle={{ color: '#94a3b8', fontSize: 11 }}
            itemStyle={{ color, fontSize: 12 }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Close']}
          />
          {basePrice != null && (
            <ReferenceLine y={basePrice} stroke="#4b5563" strokeDasharray="4 2" />
          )}
          <Line
            type="monotone"
            dataKey="close"
            dot={false}
            stroke={color}
            strokeWidth={2}
            activeDot={{ r: 4, strokeWidth: 0 }}
            connectNulls
          />
        </LineChart>
      ) : null}
    </div>
  )
}

interface MultiProps {
  data: { date: string; symbol: string; close?: number; pctChange?: number }[]
  valueKey?: 'close' | 'pctChange'
}

export function MultiLineChart({ data, valueKey = 'close' }: MultiProps) {
  const [containerRef, { width, height }] = useChartSize()

  const symbols = [...new Set(data.map(d => d.symbol))]
  const noData = !symbols.length

  // Pivot: [{date, AAPL: 150, MSFT: 420, ...}]
  const byDate = new Map<string, Record<string, number>>()
  for (const row of data) {
    if (!byDate.has(row.date)) byDate.set(row.date, { date: row.date as unknown as number } as Record<string, number>)
    const val = valueKey === 'pctChange' ? row.pctChange : row.close
    if (val != null) byDate.get(row.date)![row.symbol] = val
  }
  const chartData = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))

  const fmt = valueKey === 'pctChange'
    ? (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
    : (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`

  const fmtTick = (v: string) => v.length <= 5 ? v : v.slice(5, 10)

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 80 }}>
      {noData ? (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">No data</div>
      ) : width > 0 && height > 0 ? (
        <LineChart data={chartData} width={width} height={height} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtTick}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={fmt}
          />
          <Tooltip
            contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: 6 }}
            labelStyle={{ color: '#94a3b8', fontSize: 11 }}
            itemStyle={{ fontSize: 12 }}
            formatter={(v, name) => [fmt(Number(v)), String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
          {valueKey === 'pctChange' && <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="4 2" />}
          {symbols.map((sym, i) => (
            <Line
              key={sym}
              type="monotone"
              dataKey={sym}
              dot={false}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          ))}
        </LineChart>
      ) : null}
    </div>
  )
}
