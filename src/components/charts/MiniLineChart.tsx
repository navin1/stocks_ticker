import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, Legend,
} from 'recharts'

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a78bfa']

interface SingleProps {
  data: { date: string; close: number | null }[]
  color?: string
  basePrice?: number
}

export function SingleLineChart({ data, color = '#6366f1', basePrice }: SingleProps) {
  const prices = data.map(d => d.close).filter((v): v is number => v != null)
  if (!prices.length) return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No data</div>

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const pad = (max - min) * 0.08 || max * 0.02 || 1
  const domain: [number, number] = [min - pad, max + pad]

  const fmt = (v: number) =>
    v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(2)}`

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={80}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => v.slice(5)}
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
    </ResponsiveContainer>
  )
}

interface MultiProps {
  data: { date: string; symbol: string; close?: number; pctChange?: number }[]
  valueKey?: 'close' | 'pctChange'
}

export function MultiLineChart({ data, valueKey = 'close' }: MultiProps) {
  const symbols = [...new Set(data.map(d => d.symbol))]
  if (!symbols.length) return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No data</div>

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

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={80}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#6b7280' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => v.slice(5)}
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
    </ResponsiveContainer>
  )
}
