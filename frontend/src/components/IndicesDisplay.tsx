import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { tradingApi } from '@/api/trading';
import './IndicesDisplay.css';

interface IndexData {
  index_name: string;
  symbol: string;
  exchange: string;
  ltp: number;
  prev_close: number;
  change_amount: number;
  change_percent: number;
}

export const IndicesDisplay: React.FC = () => {
  const navigate = useNavigate();
  const apiKey = useAuthStore((state: any) => state.apiKey);
  const [indices, setIndices] = useState<IndexData[]>([]);

  const { isFetching } = useQuery({
    queryKey: ['indices', apiKey],
    queryFn: async () => {
      if (!apiKey) return null;
      try {
        const response = await tradingApi.getIndices(apiKey);
        if (response.status === 'success' && response.data?.indices) {
          setIndices(response.data.indices);
          return response.data.indices;
        }
        return null;
      } catch (error) {
        console.error('Error fetching indices:', error);
        return null;
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!apiKey,
  });

  if (!apiKey) return null;

  return (
    <div className="indices-display">
      <div className="indices-header">
        <div className="indices-title">
          <TrendingUp className="title-icon" size={20} />
          <h2>Market Indices</h2>
        </div>
        <button
          className="view-all-btn"
          onClick={() => navigate('/indices')}
        >
          View All →
        </button>
      </div>

      {isFetching && indices.length === 0 ? (
        <div className="indices-loading">
          <div className="spinner"></div>
          <p>Loading indices...</p>
        </div>
      ) : (
        <div className="indices-grid">
          {indices.map((index) => {
            const isUp = index.change_percent >= 0;
            const color = isUp ? '#10b981' : '#ef4444';

            return (
              <div key={index.symbol} className="index-card">
                <div className="index-header">
                  <h3 className="index-name">{index.index_name}</h3>
                  <span className={`change-badge ${isUp ? 'up' : 'down'}`}>
                    {isUp ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                    {Math.abs(index.change_percent).toFixed(2)}%
                  </span>
                </div>

                <div className="index-value">
                  <span className="ltp">{index.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="index-change" style={{ color }}>
                  {isUp ? '+' : ''}{index.change_amount.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isFetching && indices.length === 0 && (
        <div className="indices-empty">
          <p>Unable to load index data. Please try again later.</p>
        </div>
      )}
    </div>
  );
};

export default IndicesDisplay;
