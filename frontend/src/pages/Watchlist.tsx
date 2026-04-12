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
}

export const Watchlist: React.FC = () => {
  const apiKey = useAuthStore((state: any) => state.apiKey)
  const [symbols, setSymbols] = useState<WatchlistSymbol[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [sortField, setSortField] = useState<'symbol' | 'ltp' | 'change_percent'>('symbol')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

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

              return (
                <div key={`${symbol.symbol}-${symbol.exchange}`} className={`table-row ${isUp ? 'up' : 'down'}`}>
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

                  <div className="col-action">
                    <button
                      className="remove-btn"
                      onClick={() => handleRemove(symbol.symbol, symbol.exchange)}
                      title="Remove from watchlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
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
