import type React from 'react';
import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { tradingApi } from '@/api/trading';
import './AllIndices.css';

interface IndexData {
  index_name: string;
  symbol: string;
  exchange: string;
  ltp: number;
  prev_close: number;
  change_amount: number;
  change_percent: number;
}

type SortField = 'name' | 'value' | 'change_percent';
type SortOrder = 'asc' | 'desc';

export const AllIndices: React.FC = () => {
  const apiKey = useAuthStore((state: any) => state.apiKey);
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    fetchIndices();
  }, [apiKey]);

  const fetchIndices = async () => {
    if (!apiKey) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await tradingApi.getIndices(apiKey);

      if (response.status === 'success' && response.data?.indices) {
        setIndices(response.data.indices);
      } else {
        setError('Failed to fetch indices data');
      }
    } catch (err) {
      console.error('Error fetching indices:', err);
      setError('Error loading indices. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle sort order if clicking same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Change field and reset to asc
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedIndices = [...indices].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortField) {
      case 'name':
        aVal = a.index_name;
        bVal = b.index_name;
        break;
      case 'value':
        aVal = a.ltp;
        bVal = b.ltp;
        break;
      case 'change_percent':
        aVal = a.change_percent;
        bVal = b.change_percent;
        break;
    }

    if (typeof aVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => {
    const isActive = sortField === field;
    return (
      <div
        className={`col-header sortable ${isActive ? 'active' : ''}`}
        onClick={() => handleSort(field)}
      >
        <span>{label}</span>
        {isActive && (
          sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
        )}
      </div>
    );
  };

  return (
    <div className="all-indices-page">
      <div className="page-header">
        <h1>Market Indices</h1>
        <button
          className="refresh-btn"
          onClick={fetchIndices}
          disabled={isLoading}
          title="Refresh data"
        >
          <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
        </button>
      </div>

      {isLoading && indices.length === 0 ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading indices...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button className="retry-btn" onClick={fetchIndices}>
            Try Again
          </button>
        </div>
      ) : (
        <div className="indices-table-container">
          <div className="table-header">
            <SortHeader field="name" label="Index Name" />
            <SortHeader field="value" label="Current Value" />
            <div className="col-header" style={{ justifyContent: 'flex-end' }}>Day's Change</div>
            <SortHeader field="change_percent" label="Change %" />
          </div>

          <div className="table-body">
            {sortedIndices.map((index) => {
              const isUp = index.change_percent >= 0;
              return (
                <div key={index.symbol} className={`table-row ${isUp ? 'up' : 'down'}`}>
                  <div className="col-name">
                    <div className="index-info">
                      <span className="index-name">{index.index_name}</span>
                    </div>
                  </div>
                  <div className="col-value">
                    {index.ltp.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="col-change">
                    <div className="change-value">
                      {isUp ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                      {Math.abs(index.change_amount).toFixed(2)}
                    </div>
                  </div>
                  <div className="col-percent">
                    <div className={`percent-badge ${isUp ? 'up' : 'down'}`}>
                      {isUp ? '+' : ''}{index.change_percent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="table-footer">
            <span>{indices.length} indices available</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllIndices;
