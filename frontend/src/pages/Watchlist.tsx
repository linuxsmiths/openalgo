import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trash2, Plus, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { tradingApi } from '@/api/trading'
import { SymbolSearchModal } from '@/components/SymbolSearchModal'
import './Watchlist.css'

interface WatchlistSymbol {
  symbol: string
  exchange: string
  ltp: number
  change_amount: number
  change_percent: number
  bid: number
  ask: number
  volume: number
  high: number
  low: number
  open: number
  depth: {
    buy: Array<{ price: number; quantity: number; orders: number }>
    sell: Array<{ price: number; quantity: number; orders: number }>
  }
  total_buy_quantity: number
  total_sell_quantity: number
  total_buy_orders: number
  total_sell_orders: number
  week_52_high: number
  week_52_low: number
}

export const Watchlist: React.FC = () => {
  const apiKey = useAuthStore((state: any) => state.apiKey)
  const [symbols, setSymbols] = useState<WatchlistSymbol[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortField, setSortField] = useState<'symbol' | 'ltp' | 'change_percent'>('symbol')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null)

  const {
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['watchlist', apiKey],
    queryFn: async () => {
      if (!apiKey) return null
      try {
        const response = await tradingApi.getWatchlist(apiKey)
        if (response.status === 'success' && response.data) {
          setSymbols(response.data)
          return response.data
        }
        return []
      } catch (err) {
        console.error('Error fetching watchlist:', err)
        return []
      }
    },
    refetchInterval: 1000, // Refresh every second
    enabled: !!apiKey,
  })

  const handleSort = (field: 'symbol' | 'ltp' | 'change_percent') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const sortedSymbols = React.useMemo(() => {
    const sorted = [...symbols]
    sorted.sort((a, b) => {
      let aVal: number | string = ''
      let bVal: number | string = ''

      if (sortField === 'symbol') {
        aVal = a.symbol
        bVal = b.symbol
      } else if (sortField === 'ltp') {
        aVal = a.ltp
        bVal = b.ltp
      } else {
        aVal = a.change_percent
        bVal = b.change_percent
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal)
      }

      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return sorted
  }, [symbols, sortField, sortOrder])

  const handleRemove = async (symbol: string, exchange: string) => {
    try {
      const response = await tradingApi.removeFromWatchlist(apiKey, symbol, exchange)
      if (response.status === 'success') {
        setSymbols(symbols.filter((s) => s.symbol !== symbol || s.exchange !== exchange))
      }
    } catch (err) {
      console.error('Error removing symbol:', err)
    }
  }

  const handleAddSymbol = async (symbol: string, exchange: string) => {
    try {
      const response = await tradingApi.addToWatchlist(apiKey, symbol, exchange)
      if (response.status === 'success') {
        await refetch()
        setSearchOpen(false)
      }
    } catch (err) {
      console.error('Error adding symbol:', err)
    }
  }

  const SortHeader = ({ field, label }: { field: typeof sortField; label: string }) => {
    const isActive = sortField === field
    return (
      <div
        className={`col-header sortable ${isActive ? 'active' : ''}`}
        onClick={() => handleSort(field)}
      >
        <span>{label}</span>
        {isActive && (sortOrder === 'asc' ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
      </div>
    )
  }

  if (!apiKey) {
    return (
      <div className="watchlist-page">
        <div className="auth-required">
          <p>Please login to view your watchlist</p>
        </div>
      </div>
    )
  }

  return (
    <div className="watchlist-page">
      <div className="page-header">
        <h1>Watchlist</h1>
        <div className="header-actions">
          <button className="add-btn" onClick={() => setSearchOpen(true)} title="Add symbol">
            <Plus size={18} />
            Add Symbol
          </button>
          <button className="refresh-btn" onClick={() => refetch()} disabled={isLoading} title="Refresh">
            <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {isLoading && symbols.length === 0 ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading watchlist...</p>
        </div>
      ) : error && symbols.length === 0 ? (
        <div className="error-state">
          <p className="error-message">{error instanceof Error ? error.message : 'Error loading watchlist'}</p>
          <button className="retry-btn" onClick={() => refetch()}>
            Try Again
          </button>
        </div>
      ) : symbols.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <TrendingUp size={48} />
          </div>
          <h2>Your watchlist is empty</h2>
          <p>Add symbols to start tracking them</p>
          <button className="add-btn" onClick={() => setSearchOpen(true)}>
            <Plus size={16} />
            Add Your First Symbol
          </button>
        </div>
      ) : (
        <div className="watchlist-table-container">
          <div className="table-header">
            <SortHeader field="symbol" label="Symbol" />
            <SortHeader field="ltp" label="Current Price" />
            <div className="col-header">Bid</div>
            <div className="col-header">Ask</div>
            <div className="col-header">Day Change</div>
            <SortHeader field="change_percent" label="% Change" />
            <div className="col-header">Volume</div>
            <div className="col-header">Action</div>
          </div>

          <div className="table-body">
            {sortedSymbols.map((symbol) => {
              const isUp = symbol.change_percent >= 0
              const changeColor = isUp ? '#10b981' : '#ef4444'
              const isExpanded = expandedSymbol === `${symbol.symbol}-${symbol.exchange}`

              return (
                <React.Fragment key={`${symbol.symbol}-${symbol.exchange}`}>
                  <div 
                    className={`table-row ${isUp ? 'up' : 'down'} ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => setExpandedSymbol(isExpanded ? null : `${symbol.symbol}-${symbol.exchange}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="col-symbol">
                      <span className="symbol-name">{symbol.symbol}</span>
                      <span className="exchange">{symbol.exchange}</span>
                    </div>

                    <div className="col-price">
                      {symbol.ltp.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>

                    <div className="col-bid">
                      {symbol.bid.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>

                    <div className="col-ask">
                      {symbol.ask.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>

                    <div className="col-change" style={{ color: changeColor }}>
                      <div className="change-details">
                        {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        <span>{Math.abs(symbol.change_amount).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="col-percent" style={{ color: changeColor }}>
                      <span className={`percent-badge ${isUp ? 'up' : 'down'}`}>
                        {isUp ? '+' : ''}{symbol.change_percent.toFixed(2)}%
                      </span>
                    </div>

                    <div className="col-volume">
                      {(symbol.volume / 1000).toFixed(0)}K
                    </div>

                    <div className="col-action" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="remove-btn"
                        onClick={() => handleRemove(symbol.symbol, symbol.exchange)}
                        title="Remove from watchlist"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="expanded-row">
                      <div className="expanded-content">
                        {/* Price Range Info */}
                        <div className="price-ranges">
                          <div className="range-item">
                            <span className="range-label">Day Range:</span>
                            <span className="range-value">
                              ₹{symbol.low.toFixed(2)} - ₹{symbol.high.toFixed(2)}
                            </span>
                          </div>
                          <div className="range-item">
                            <span className="range-label">Open:</span>
                            <span className="range-value">₹{symbol.open.toFixed(2)}</span>
                          </div>
                          {symbol.week_52_high > 0 && symbol.week_52_low > 0 && (
                            <div className="range-item">
                              <span className="range-label">52W Range:</span>
                              <span className="range-value">
                                ₹{symbol.week_52_low.toFixed(2)} - ₹{symbol.week_52_high.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Market Depth */}
                        <div className="depth-section">
                          <h4>Market Depth</h4>
                          <div className="depth-summary">
                            <div className="depth-stat buyers">
                              <span className="stat-label">Total Buyers:</span>
                              <span className="stat-value">{symbol.total_buy_orders} orders ({(symbol.total_buy_quantity / 1000).toFixed(1)}K qty)</span>
                            </div>
                            <div className="depth-stat sellers">
                              <span className="stat-label">Total Sellers:</span>
                              <span className="stat-value">{symbol.total_sell_orders} orders ({(symbol.total_sell_quantity / 1000).toFixed(1)}K qty)</span>
                            </div>
                          </div>

                          {/* Depth Visualization */}
                          <div className="depth-viz">
                            <div className="depth-side buy-side">
                              <div className="depth-header">Bid</div>
                              {symbol.depth.buy.slice(0, 5).map((level, idx) => {
                                const maxQty = Math.max(
                                  ...symbol.depth.buy.slice(0, 5).map(l => l.quantity),
                                  ...symbol.depth.sell.slice(0, 5).map(l => l.quantity)
                                )
                                const widthPercent = (level.quantity / maxQty) * 100
                                return (
                                  <div key={idx} className="depth-level">
                                    <span className="depth-price">₹{level.price.toFixed(2)}</span>
                                    <div className="depth-bar-container">
                                      <div className="depth-bar buy" style={{ width: `${widthPercent}%` }}></div>
                                    </div>
                                    <span className="depth-qty">{level.quantity}</span>
                                    <span className="depth-orders">({level.orders})</span>
                                  </div>
                                )
                              })}
                            </div>

                            <div className="depth-side sell-side">
                              <div className="depth-header">Ask</div>
                              {symbol.depth.sell.slice(0, 5).map((level, idx) => {
                                const maxQty = Math.max(
                                  ...symbol.depth.buy.slice(0, 5).map(l => l.quantity),
                                  ...symbol.depth.sell.slice(0, 5).map(l => l.quantity)
                                )
                                const widthPercent = (level.quantity / maxQty) * 100
                                return (
                                  <div key={idx} className="depth-level">
                                    <span className="depth-price">₹{level.price.toFixed(2)}</span>
                                    <div className="depth-bar-container">
                                      <div className="depth-bar sell" style={{ width: `${widthPercent}%` }}></div>
                                    </div>
                                    <span className="depth-qty">{level.quantity}</span>
                                    <span className="depth-orders">({level.orders})</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>
      )}

      {searchOpen && <SymbolSearchModal onClose={() => setSearchOpen(false)} onSelect={handleAddSymbol} apiKey={apiKey} />}
    </div>
  )
}

export default Watchlist
