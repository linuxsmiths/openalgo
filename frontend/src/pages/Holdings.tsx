import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Pause,
  Radio,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOrderEventRefresh } from '@/hooks/useOrderEventRefresh'
import { tradingApi } from '@/api/trading'
import { InstrumentLink } from '@/components/trading'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLivePrice, calculateLiveStats } from '@/hooks/useLivePrice'
import { usePageVisibility } from '@/hooks/usePageVisibility'
import { cn, makeFormatCurrency, sanitizeCSV } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { onModeChange } from '@/stores/themeStore'
import type { Holding, HoldingsStats } from '@/types/trading'
import type { MultiQuotesSymbol } from '@/api/trading'
import { showToast } from '@/utils/toast'

type SortKey = 'symbol' | 'quantity' | 'avg_price' | 'ltp' | 'pnl' | 'pnl_percent' | 'day_pnl' | 'day_pnl_percent'
type SortOrder = 'asc' | 'desc'

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function getSortIcon(columnKey: SortKey, sortKey: SortKey | null, sortOrder: SortOrder) {
  if (columnKey !== sortKey) return null
  return sortOrder === 'asc' ? (
    <ChevronUp className="h-4 w-4 inline ml-1" />
  ) : (
    <ChevronDown className="h-4 w-4 inline ml-1" />
  )
}

export default function Holdings() {
  const { apiKey, user } = useAuthStore()
  const formatCurrency = useMemo(() => makeFormatCurrency(user?.broker), [user?.broker])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [stats, setStats] = useState<HoldingsStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStaleWarning, setShowStaleWarning] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Page visibility tracking for resource optimization
  const { isVisible, wasHidden, timeSinceHidden } = usePageVisibility()
  const lastFetchRef = useRef<number>(Date.now())

  // Centralized real-time price hook with WebSocket + MultiQuotes fallback
  // Automatically pauses when tab is hidden
  const { data: enhancedHoldings, isLive, isPaused } = useLivePrice(holdings, {
    enabled: holdings.length > 0,
    useMultiQuotesFallback: true,
    staleThreshold: 5000,
    multiQuotesRefreshInterval: 30000,
    pauseWhenHidden: true,
  })

  // Calculate enhanced stats based on real-time data
  const enhancedStats = useMemo(() => {
    if (!stats) return stats

    // Check if any holding has live data
    const hasAnyLiveData = enhancedHoldings.some(
      (h) => (h as Holding & { _dataSource?: string })._dataSource !== 'rest'
    )

    // If no live data, return original REST stats
    if (!hasAnyLiveData) return stats

    // Recalculate stats with real-time data
    return calculateLiveStats(enhancedHoldings, stats)
  }, [stats, enhancedHoldings])

  // Calculate 1D stats
  const dayStats = useMemo(() => {
    let totalDayPnL = 0
    let totalDayPnLPercent = 0

    enhancedHoldings.forEach((h) => {
      if (h.day_pnl) totalDayPnL += h.day_pnl
    })

    // Calculate weighted average 1D return %
    const totalInvValue = enhancedStats?.totalinvvalue || 0
    if (totalInvValue > 0) {
      totalDayPnLPercent = (totalDayPnL / totalInvValue) * 100
    }

    return { totalDayPnL, totalDayPnLPercent }
  }, [enhancedHoldings, enhancedStats])

  // Sorted holdings
  const sortedHoldings = useMemo(() => {
    if (!sortKey) return enhancedHoldings

    const sorted = [...enhancedHoldings].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortKey) {
        case 'symbol':
          aVal = a.symbol
          bVal = b.symbol
          break
        case 'quantity':
          aVal = a.quantity
          bVal = b.quantity
          break
        case 'avg_price':
          aVal = a.average_price || 0
          bVal = b.average_price || 0
          break
        case 'ltp':
          aVal = a.ltp || 0
          bVal = b.ltp || 0
          break
        case 'pnl':
          aVal = a.pnl
          bVal = b.pnl
          break
        case 'pnl_percent':
          aVal = a.pnlpercent
          bVal = b.pnlpercent
          break
        case 'day_pnl':
          aVal = a.day_pnl || 0
          bVal = b.day_pnl || 0
          break
        case 'day_pnl_percent':
          aVal = a.day_pnl_percent || 0
          bVal = b.day_pnl_percent || 0
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }

      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

    return sorted
  }, [enhancedHoldings, sortKey, sortOrder])

  const fetchHoldings = useCallback(
    async (showRefresh = false) => {
      if (!apiKey) {
        setIsLoading(false)
        return
      }

      if (showRefresh) setIsRefreshing(true)

      try {
        const response = await tradingApi.getHoldings(apiKey)
        if (response.status === 'success' && response.data) {
          let holdingsData = response.data.holdings || []

          // Fetch quotes to calculate 1D P&L
          if (holdingsData.length > 0) {
            const symbols: MultiQuotesSymbol[] = holdingsData.map((h) => ({
              symbol: h.symbol,
              exchange: h.exchange,
            }))

            try {
              const quotesResponse = await tradingApi.getMultiQuotes(apiKey, symbols)
              if (quotesResponse.status === 'success' && quotesResponse.results) {
                const quoteMap = new Map(
                  quotesResponse.results.map((q) => [
                    `${q.exchange}:${q.symbol}`,
                    { prev_close: q.data.prev_close, ltp: q.data.ltp },
                  ])
                )

                // Enrich holdings with 1D P&L
                holdingsData = holdingsData.map((h) => {
                  const quote = quoteMap.get(`${h.exchange}:${h.symbol}`)
                  if (quote && quote.prev_close && quote.ltp) {
                    const day_pnl = (quote.ltp - quote.prev_close) * h.quantity
                    const day_pnl_percent =
                      ((quote.ltp - quote.prev_close) / quote.prev_close) * 100

                    return {
                      ...h,
                      prev_close: quote.prev_close,
                      day_pnl,
                      day_pnl_percent,
                    }
                  }
                  return h
                })
              }
            } catch {
              // Continue with holdings data if quotes fetch fails
            }
          }

          setHoldings(holdingsData)
          setStats(response.data.statistics)
          setError(null)
        } else {
          setError(response.message || 'Failed to fetch holdings')
        }
      } catch {
        setError('Failed to fetch holdings')
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [apiKey]
  )

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('desc')
    }
  }

  // Initial fetch and visibility-aware polling
  // Pauses polling when tab is hidden to save resources
  useEffect(() => {
    // Don't poll when tab is hidden or API key not available yet
    if (!isVisible || !apiKey) return

    fetchHoldings()
    lastFetchRef.current = Date.now()
  }, [fetchHoldings, isVisible])

  // Refresh on order events instead of polling
  useOrderEventRefresh(fetchHoldings, {
    events: ['order_event', 'analyzer_update'],
  })

  // Refresh data when tab becomes visible after being hidden
  useEffect(() => {
    if (!wasHidden || !isVisible) return

    const timeSinceLastFetch = Date.now() - lastFetchRef.current

    // If hidden for more than 30 seconds, show stale warning and refresh
    if (timeSinceHidden > 30000 || timeSinceLastFetch > 30000) {
      setShowStaleWarning(true)
      fetchHoldings()
      lastFetchRef.current = Date.now()
    }
  }, [wasHidden, isVisible, timeSinceHidden, fetchHoldings])

  // Auto-dismiss stale data warning after 5 seconds
  useEffect(() => {
    if (!showStaleWarning) return
    const timeout = setTimeout(() => setShowStaleWarning(false), 5000)
    return () => clearTimeout(timeout)
  }, [showStaleWarning])

  // Listen for mode changes (live/analyze) and refresh data
  useEffect(() => {
    const unsubscribe = onModeChange(() => {
      fetchHoldings()
    })
    return () => unsubscribe()
  }, [fetchHoldings])

  const exportToCSV = () => {
    if (enhancedHoldings.length === 0) {
      showToast.error('No data to export', 'system')
      return
    }

    try {
      const headers = [
        'Symbol',
        'Exchange',
        'Quantity',
        'Avg Price',
        'LTP',
        'Product',
        'P&L (Overall)',
        'P&L % (Overall)',
        'P&L (1D)',
        'P&L % (1D)',
      ]
      const rows = enhancedHoldings.map((h) => [
        sanitizeCSV(h.symbol),
        sanitizeCSV(h.exchange),
        sanitizeCSV(h.quantity),
        sanitizeCSV(h.average_price),
        sanitizeCSV(h.ltp),
        sanitizeCSV(h.product),
        sanitizeCSV(h.pnl),
        sanitizeCSV(h.pnlpercent),
        sanitizeCSV(h.day_pnl || 0),
        sanitizeCSV(h.day_pnl_percent || 0),
      ])

      const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = `holdings_${new Date().toISOString().split('T')[0]}.csv`
      a.download = filename
      a.click()
      // Revoke the object URL to free memory
      URL.revokeObjectURL(url)
      showToast.success(`Downloaded ${filename}`, 'clipboard')
    } catch {
      showToast.error('Failed to export CSV', 'system')
    }
  }

  const isProfit = (value: number) => value >= 0

  return (
    <div className="space-y-6">
      {/* Stale Data Warning */}
      {showStaleWarning && (
        <Alert variant="default" className="bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Data is being refreshed after tab was inactive...
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Investor Summary</h1>
            {isPaused ? (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1"
              >
                <Pause className="h-3 w-3" />
                Paused
              </Badge>
            ) : isLive ? (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1"
              >
                <Radio className="h-3 w-3 animate-pulse" />
                Live
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground">View your holdings portfolio</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchHoldings(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Holding Value</CardDescription>
            <CardTitle className="text-2xl text-primary">
              {enhancedStats ? formatCurrency(enhancedStats.totalholdingvalue) : '---'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Invested</CardDescription>
            <CardTitle className="text-2xl">
              {enhancedStats ? formatCurrency(enhancedStats.totalinvvalue) : '---'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total P&L</CardDescription>
            <CardTitle
              className={cn(
                'text-lg',
                enhancedStats && isProfit(enhancedStats.totalprofitandloss)
                  ? 'text-green-600'
                  : 'text-red-600'
              )}
            >
              {enhancedStats ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    {isProfit(enhancedStats.totalprofitandloss) ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {formatCurrency(enhancedStats.totalprofitandloss)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatPercent(enhancedStats.totalpnlpercentage)}
                  </div>
                </div>
              ) : (
                '---'
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>1D Returns</CardDescription>
            <CardTitle
              className={cn(
                'text-lg',
                dayStats && isProfit(dayStats.totalDayPnL)
                  ? 'text-green-600'
                  : 'text-red-600'
              )}
            >
              {enhancedStats ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    {isProfit(dayStats.totalDayPnL) ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {formatCurrency(dayStats.totalDayPnL)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatPercent(dayStats.totalDayPnLPercent)}
                  </div>
                </div>
              ) : (
                '---'
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Holdings Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-muted-foreground">{error}</div>
          ) : sortedHoldings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No holdings found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">
                      <button
                        onClick={() => handleSort('symbol')}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Symbol
                        {getSortIcon('symbol', sortKey, sortOrder)}
                      </button>
                    </TableHead>
                    <TableHead className="w-20 text-right">
                      <button
                        onClick={() => handleSort('quantity')}
                        className="flex items-center gap-1 hover:text-foreground justify-end w-full"
                      >
                        Qty
                        {getSortIcon('quantity', sortKey, sortOrder)}
                      </button>
                    </TableHead>
                    <TableHead className="w-28 text-right">
                      <button
                        onClick={() => handleSort('avg_price')}
                        className="flex items-center gap-1 hover:text-foreground justify-end w-full"
                      >
                        Avg Price
                        {getSortIcon('avg_price', sortKey, sortOrder)}
                      </button>
                    </TableHead>
                    <TableHead className="w-24 text-right">
                      <button
                        onClick={() => handleSort('ltp')}
                        className="flex items-center gap-1 hover:text-foreground justify-end w-full"
                      >
                        LTP
                        {getSortIcon('ltp', sortKey, sortOrder)}
                      </button>
                    </TableHead>
                    <TableHead className="w-32 text-right">
                      <button
                        onClick={() => handleSort('pnl_percent')}
                        className="flex items-center gap-1 hover:text-foreground justify-end w-full"
                      >
                        % Chg (Overall)
                        {getSortIcon('pnl_percent', sortKey, sortOrder)}
                      </button>
                    </TableHead>
                    <TableHead className="w-32 text-right">
                      <button
                        onClick={() => handleSort('pnl')}
                        className="flex items-center gap-1 hover:text-foreground justify-end w-full"
                      >
                        P&L (Overall)
                        {getSortIcon('pnl', sortKey, sortOrder)}
                      </button>
                    </TableHead>
                    <TableHead className="w-28 text-right">
                      <button
                        onClick={() => handleSort('day_pnl_percent')}
                        className="flex items-center gap-1 hover:text-foreground justify-end w-full"
                      >
                        % Chg (1D)
                        {getSortIcon('day_pnl_percent', sortKey, sortOrder)}
                      </button>
                    </TableHead>
                    <TableHead className="w-28 text-right">
                      <button
                        onClick={() => handleSort('day_pnl')}
                        className="flex items-center gap-1 hover:text-foreground justify-end w-full"
                      >
                        P&L (1D)
                        {getSortIcon('day_pnl', sortKey, sortOrder)}
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHoldings.map((holding, index) => (
                    <TableRow key={`${holding.symbol}-${holding.exchange}-${index}`}>
                      <TableCell className="w-24 font-medium">
                        <InstrumentLink
                          symbol={holding.symbol}
                          exchange={holding.exchange}
                          className="font-medium"
                        />
                      </TableCell>
                      <TableCell className="w-20 text-right font-mono">{holding.quantity}</TableCell>
                      <TableCell className="w-28 text-right font-mono">
                        {holding.average_price !== undefined
                          ? formatCurrency(holding.average_price)
                          : '-'}
                      </TableCell>
                      <TableCell className="w-24 text-right font-mono">
                        {holding.ltp !== undefined ? formatCurrency(holding.ltp) : '-'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'w-32 text-right font-medium',
                          isProfit(holding.pnlpercent) ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {formatPercent(holding.pnlpercent)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'w-32 text-right font-medium',
                          isProfit(holding.pnl) ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {isProfit(holding.pnl) ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {formatCurrency(holding.pnl)}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'w-28 text-right font-medium',
                          holding.day_pnl_percent !== undefined && isProfit(holding.day_pnl_percent)
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {holding.day_pnl_percent !== undefined
                          ? formatPercent(holding.day_pnl_percent)
                          : '-'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'w-28 text-right font-medium',
                          holding.day_pnl !== undefined && isProfit(holding.day_pnl)
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {holding.day_pnl !== undefined
                          ? formatCurrency(holding.day_pnl)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="text-right text-muted-foreground">
                      Total:
                    </TableCell>
                    <TableCell
                      className={cn(
                        'w-32 text-right font-bold',
                        enhancedStats && isProfit(enhancedStats.totalpnlpercentage)
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}
                    >
                      {enhancedStats ? formatPercent(enhancedStats.totalpnlpercentage) : '-'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'w-32 text-right font-bold',
                        enhancedStats && isProfit(enhancedStats.totalprofitandloss)
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}
                    >
                      {enhancedStats
                        ? `${enhancedStats.totalprofitandloss >= 0 ? '+' : ''}${formatCurrency(enhancedStats.totalprofitandloss)}`
                        : '-'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'w-28 text-right font-bold',
                        dayStats && isProfit(dayStats.totalDayPnLPercent)
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}
                    >
                      {enhancedStats ? formatPercent(dayStats.totalDayPnLPercent) : '-'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'w-28 text-right font-bold',
                        dayStats && isProfit(dayStats.totalDayPnL)
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}
                    >
                      {enhancedStats
                        ? `${dayStats.totalDayPnL >= 0 ? '+' : ''}${formatCurrency(dayStats.totalDayPnL)}`
                        : '-'}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
