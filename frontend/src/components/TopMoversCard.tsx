import { ArrowUp, ArrowDown, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { tradingApi } from '@/api/trading'
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

export function TopMoversCard() {
  const { apiKey } = useAuthStore()
  const [gainers, setGainers] = useState<Mover[]>([])
  const [losers, setLosers] = useState<Mover[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // biome-ignore lint: this is intentional
  useEffect(() => {
    if (apiKey) {
      fetchTopMovers()
      // Auto-refresh every 5 seconds
      const interval = setInterval(fetchTopMovers, 5000)
      return () => clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  const fetchTopMovers = async () => {
    if (!apiKey) return
    setLoading(true)
    setError(null)
    try {
      const response = await tradingApi.getTopMovers(apiKey, 'NIFTY50', 5)
      if (response.status === 'success') {
        setGainers(response.data.gainers || [])
        setLosers(response.data.losers || [])
      } else {
        setError(response.message || 'Failed to fetch top movers')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch top movers')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <CardTitle>Top Movers</CardTitle>
          </div>
          <Link to="/topmovers">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin">Loading...</div>
          </div>
        )}
        {!loading && !error && (gainers.length > 0 || losers.length > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {/* Gainers */}
            <div>
              <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-green-600">
                <ArrowUp className="h-4 w-4" /> Top Gainers
              </h3>
              <div className="space-y-2">
                {gainers.map((mover) => (
                  <div
                    key={mover.symbol}
                    className="flex items-center justify-between rounded-md bg-green-50 p-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{mover.symbol}</p>
                      <p className="text-xs text-gray-500">
                        ₹{mover.ltp.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${mover.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {mover.change_percent > 0 ? '+' : ''}{mover.change_percent.toFixed(2)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {mover.change_amount > 0 ? '+' : ''}₹{mover.change_amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Losers */}
            <div>
              <h3 className="mb-3 flex items-center gap-1 text-sm font-semibold text-red-600">
                <ArrowDown className="h-4 w-4" /> Top Losers
              </h3>
              <div className="space-y-2">
                {losers.map((mover) => (
                  <div
                    key={mover.symbol}
                    className="flex items-center justify-between rounded-md bg-red-50 p-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{mover.symbol}</p>
                      <p className="text-xs text-gray-500">
                        ₹{mover.ltp.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${mover.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {mover.change_percent > 0 ? '+' : ''}{mover.change_percent.toFixed(2)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {mover.change_amount > 0 ? '+' : ''}₹{mover.change_amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {!loading && !error && gainers.length === 0 && losers.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-500">
            No data available
          </div>
        )}
      </CardContent>
    </Card>
  )
}
