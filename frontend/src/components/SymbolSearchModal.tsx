import type React from 'react'
import { useState, useCallback } from 'react'
import { Search, X, Loader } from 'lucide-react'
import { tradingApi } from '@/api/trading'
import './SymbolSearchModal.css'

interface SearchResult {
  symbol: string
  exchange: string
  name: string
  company_name: string
}

interface SymbolSearchModalProps {
  onClose: () => void
  onSelect: (symbol: string, exchange: string) => void
  apiKey: string
}

export const SymbolSearchModal: React.FC<SymbolSearchModalProps> = ({ onClose, onSelect, apiKey }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery || searchQuery.length < 1) {
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        const response = await tradingApi.searchSymbols(searchQuery, apiKey, undefined, 20)
        if (response.status === 'success' && response.data) {
          setResults(response.data)
          setSelectedIndex(-1)
        } else {
          setResults([])
        }
      } catch (error) {
        console.error('Error searching symbols:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    },
    [apiKey]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    handleSearch(value)
  }

  const handleSelect = (result: SearchResult) => {
    onSelect(result.symbol, result.exchange)
    setQuery('')
    setResults([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      default:
        break
    }
  }

  return (
    <div className="symbol-search-modal">
      <div className="modal-overlay" onClick={onClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Add Symbol to Watchlist</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by symbol or company name..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {isLoading && <Loader size={18} className="spinner" />}
        </div>

        <div className="results-container">
          {query && isLoading ? (
            <div className="loading-state">
              <div className="spinner-inline"></div>
              <p>Searching...</p>
            </div>
          ) : query && results.length === 0 ? (
            <div className="no-results">
              <p>No symbols found</p>
              <span>Try searching with a different term</span>
            </div>
          ) : results.length > 0 ? (
            <div className="results-list">
              {results.map((result, index) => (
                <div
                  key={`${result.symbol}-${result.exchange}`}
                  className={`result-item ${selectedIndex === index ? 'selected' : ''}`}
                  onClick={() => handleSelect(result)}
                >
                  <div className="result-main">
                    <div className="symbol">{result.symbol}</div>
                    <div className="company-name">{result.name || result.company_name}</div>
                  </div>
                  <div className="exchange-badge">{result.exchange}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>Start typing to search for symbols</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <p className="hint">Use arrow keys to navigate • Enter to select • Esc to close</p>
        </div>
      </div>
    </div>
  )
}

export default SymbolSearchModal
