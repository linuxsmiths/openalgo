import { ArrowUp, ArrowDown, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { tradingApi } from '@/api/trading'
import { InstrumentLink } from '@/components/trading'
import { useAuthStore } from '@/stores/authStore'

interface Mover {
  symbol: string
  exchange: string
  ltp: number
  prev_close: number
  change_percent: number
  change_amount: number
  volume: number
}

type SortKey = 'change_percent' | 'change_amount' | 'ltp' | 'symbol' | 'volume'
type SortOrder = 'asc' | 'desc'

export function TopMovers() {
  const { apiKey } = useAuthStore()
  const [gainers, setGainers] = useState<Mover[]>([])
  const [losers, setLosers] = useState<Mover[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState('NIFTY50')
  const [limit, setLimit] = useState(10)
  const [cached, setCached] = useState(false)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('change_percent')
  const [gainersSortOrder, setGainersSortOrder] = useState<SortOrder>('desc')
  const [losersSortOrder, setLosersSortOrder] = useState<SortOrder>('asc')

  useEffect(() => {
    if (apiKey) {
      fetchTopMovers()
    }
  }, [index, limit, apiKey])

  const fetchTopMovers = async () => {
    if (!apiKey) return
    setLoading(true)
    setError(null)
    try {
      const response = await tradingApi.getTopMovers(apiKey, index, limit)
      if (response.status === 'success') {
        const g = response.data.gainers || []
        const l = response.data.losers || []
        setGainers(sortMoversWithOrder(g, 'change_percent', 'desc'))
        setLosers(sortMoversWithOrder(l, 'change_percent', 'asc'))
        setCached(response.data.cached || false)
        setCachedAt(response.data.cached_at || null)
      } else {
        setError(response.message || 'Failed to fetch top movers')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch top movers')
    } finally {
      setLoading(false)
    }
  }

  const sortMoversWithOrder = (movers: Mover[], key: SortKey, order: SortOrder): Mover[] => {
    const sorted = [...movers].sort((a, b) => {
      let aVal: number | string = a[key as keyof Mover]
      let bVal: number | string = b[key as keyof Mover]

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
        return order === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal)
      }

      const diff = (aVal as number) - (bVal as number)
      return order === 'asc' ? diff : -diff
    })
    return sorted
  }

  const handleSort = (key: SortKey, isGainers: boolean = true) => {
    if (sortKey === key) {
      if (isGainers) {
        const newOrder = gainersSortOrder === 'asc' ? 'desc' : 'asc'
        setGainersSortOrder(newOrder)
        setGainers(sortMoversWithOrder(gainers, key, newOrder))
      } else {
        const newOrder = losersSortOrder === 'asc' ? 'desc' : 'asc'
        setLosersSortOrder(newOrder)
        setLosers(sortMoversWithOrder(losers, key, newOrder))
      }
    } else {
      setSortKey(key)
      if (isGainers) {
        setGainersSortOrder('desc')
        setGainers(sortMoversWithOrder(gainers, key, 'desc'))
      } else {
        setLosersSortOrder('asc')
        setLosers(sortMoversWithOrder(losers, key, 'asc'))
      }
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Top Movers</h1>
        <Button
          onClick={fetchTopMovers}
          disabled={loading}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Index</label>
            <Select value={index} onValueChange={setIndex}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NIFTY50">NIFTY 50</SelectItem>
                <SelectItem value="NIFTY100">NIFTY 100</SelectItem>
                <SelectItem value="BANKNIFTY">BANKNIFTY</SelectItem>
                <SelectItem value="NIFTY-AUTO">NIFTY Auto</SelectItem>
                <SelectItem value="NIFTY-IT">NIFTY IT</SelectItem>
                <SelectItem value="NIFTY-PHARMA">NIFTY Pharma</SelectItem>
                <SelectItem value="NIFTY-FINSVC">NIFTY FinSvc</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">
              Limit: {limit}
            </label>
            <input
              type="range"
              value={limit}
              onChange={(e) => setLimit(Number(e.currentTarget.value))}
              min={1}
              max={100}
              step={5}
              className="mt-2 w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cache Status */}
      {cached && cachedAt && (
        <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
          📊 Cached data (from {new Date(cachedAt).toLocaleTimeString()}). Results refresh every 5 minutes.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin">Loading...</div>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Gainers Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-green-600">
                <ArrowUp className="h-5 w-5" /> Top Gainers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gainers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-2 py-2 text-left font-semibold">
                          <button
                            onClick={() => handleSort('symbol', true)}
                            className="hover:text-blue-600"
                          >
                            Symbol{' '}
                            {sortKey === 'symbol' &&
                              (gainersSortOrder === 'asc' ? '↑' : '↓')}
                          </button>
                        </th>
                        <th className="px-2 py-2 text-right font-semibold">
                          <button
                            onClick={() => handleSort('ltp', true)}
                            className="hover:text-blue-600"
                          >
                            LTP{' '}
                            {sortKey === 'ltp' &&
                              (gainersSortOrder === 'asc' ? '↑' : '↓')}
                          </button>
                        </th>
                        <th className="px-2 py-2 text-right font-semibold">
                          <button
                            onClick={() => handleSort('change_percent', true)}
                            className="hover:text-blue-600"
                          >
                            % Change{' '}
                            {sortKey === 'change_percent' &&
                              (gainersSortOrder === 'asc' ? '↑' : '↓')}
                          </button>
                        </th>
                        <th className="px-2 py-2 text-right font-semibold">
                          <button
                            onClick={() => handleSort('change_amount', true)}
                            className="hover:text-blue-600"
                          >
                            Abs Change{' '}
                            {sortKey === 'change_amount' &&
                              (gainersSortOrder === 'asc' ? '↑' : '↓')}
                          </button>
                        </th>
                        <th className="px-2 py-2 text-right font-semibold">
                          <button
                            onClick={() => handleSort('volume', true)}
                            className="hover:text-blue-600"
                          >
                            Volume{' '}
                            {sortKey === 'volume' &&
                              (gainersSortOrder === 'asc' ? '↑' : '↓')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortMoversWithOrder(gainers, sortKey, gainersSortOrder).map((mover) => (
                        <tr key={mover.symbol} className="border-b hover:bg-green-50">
                          <td className="px-2 py-2 font-medium">
                            <InstrumentLink
                              symbol={mover.symbol}
                              exchange={mover.exchange}
                              className="font-medium"
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            ₹{mover.ltp.toFixed(2)}
                          </td>
                          <td className={`px-2 py-2 text-right font-semibold ${mover.change_percent >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {mover.change_percent > 0 ? '+' : ''}{mover.change_percent.toFixed(2)}%
                          </td>
                          <td className={`px-2 py-2 text-right ${mover.change_amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {mover.change_amount > 0 ? '+' : ''}₹{mover.change_amount.toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-500">
                            {(mover.volume / 1000000).toFixed(2)}M
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-4 text-gray-500">No gainers</p>
              )}
            </CardContent>
          </Card>

          {/* Losers Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-600">
                <ArrowDown className="h-5 w-5" /> Top Losers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {losers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-2 py-2 text-left font-semibold">
                          <button
                            onClick={() => handleSort('symbol', false)}
                            className="hover:text-blue-600"
                          >
                            Symbol{' '}
                            {sortKey === 'symbol' &&
                              (losersSortOrder === 'asc' ? '↑' : '↓')}
                          </button>
                        </th>
                        <th className="px-2 py-2 text-right font-semibold">
                          <button
                            onClick={() => handleSort('ltp', false)}
                            className="hover:text-blue-600"
                          >
                            LTP{' '}
                            {sortKey === 'ltp' &&
                              (losersSortOrder === 'asc' ? '↑' : '↓')}
                          </button>
                        </th>
                        <th className="px-2 py-2 text-right font-semibold">
                          <button
                            onClick={() => handleSort('change_percent', false)}
                            className="hover:text-blue-600"
                          >
                            % Change{' '}
                            {sortKey === 'change_percent' &&
                              (losersSortOrder === 'asc' ? '↑' : '↓')}
                          </button>
                        </th>
                        <th className="px-2 py-2 text-right font-semibold">
                          <button
                            onClick={() => handleSort('change_amount', false)}
                            className="hover:text-blue-600"
                          >
                            Abs Change{' '}
                            {sortKey === 'change_amount' &&
                              (losersSortOrder === 'asc' ? '↑' : '↓')}
                          </button>
                        </th>
                        <th className="px-2 py-2 text-right font-semibold">
                          <button
                            onClick={() => handleSort('volume', false)}
                            className="hover:text-blue-600"
                          >
                            Volume{' '}
                            {sortKey === 'volume' &&
                              (losersSortOrder === 'asc' ? '↑' : '↓')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortMoversWithOrder(losers, sortKey, losersSortOrder).map((mover) => (
                        <tr key={mover.symbol} className="border-b hover:bg-red-50">
                          <td className="px-2 py-2 font-medium">
                            <InstrumentLink
                              symbol={mover.symbol}
                              exchange={mover.exchange}
                              className="font-medium"
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            ₹{mover.ltp.toFixed(2)}
                          </td>
                          <td className={`px-2 py-2 text-right font-semibold ${mover.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {mover.change_percent > 0 ? '+' : ''}{mover.change_percent.toFixed(2)}%
                          </td>
                          <td className={`px-2 py-2 text-right ${mover.change_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {mover.change_amount > 0 ? '+' : ''}₹{mover.change_amount.toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right text-gray-500">
                            {(mover.volume / 1000000).toFixed(2)}M
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-4 text-gray-500">No losers</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
