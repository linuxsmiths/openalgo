import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, TrendingUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { tradingApi } from '@/api/trading';
import './IndicesTopBar.css';

interface IndexData {
  index_name: string;
  symbol: string;
  exchange: string;
  ltp: number;
  prev_close: number;
  change_amount: number;
  change_percent: number;
}

interface MarketStatus {
  isOpen: boolean;
  timeRemaining: string;
  currentTime: string;
}

// Indian market hours: 9:15 AM to 3:30 PM IST (Mon-Fri)
const getMarketStatus = (): MarketStatus => {
  const now = new Date();
  
  // IST is UTC+5:30, but we calculate based on local time
  const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const day = istTime.getDay();

  const currentTimeStr = istTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // Check if market hours (9:15 AM to 3:30 PM) and weekday (Mon-Fri)
  const isWeekday = day >= 1 && day <= 5;
  const startHour = 9;
  const startMinute = 15;
  const endHour = 15;
  const endMinute = 30;

  const isOpen =
    isWeekday &&
    (hours > startHour || (hours === startHour && minutes >= startMinute)) &&
    (hours < endHour || (hours === endHour && minutes < endMinute));

  let timeRemaining = '';
  if (isOpen) {
    // Calculate time until 3:30 PM
    const closingTime = new Date(istTime);
    closingTime.setHours(endHour, endMinute, 0);
    const diff = closingTime.getTime() - istTime.getTime();
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    timeRemaining = `${hrs}h ${mins}m`;
  } else if (isWeekday) {
    timeRemaining = 'Opens at 9:15 AM';
  } else {
    timeRemaining = 'Market Closed';
  }

  return {
    isOpen,
    timeRemaining,
    currentTime: currentTimeStr
  };
};

export const IndicesTopBar: React.FC = () => {
  const navigate = useNavigate();
  const apiKey = useAuthStore((state: any) => state.apiKey);
  const [topIndices, setTopIndices] = useState<IndexData[]>([]);
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(getMarketStatus());

  // Update market status every second
  useEffect(() => {
    setMarketStatus(getMarketStatus());
    const interval = setInterval(() => {
      setMarketStatus(getMarketStatus());
    }, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);

  useQuery({
    queryKey: ['indices-topbar', apiKey],
    queryFn: async () => {
      if (!apiKey) return null;
      try {
        const response = await tradingApi.getIndices(apiKey);
        if (response.status === 'success' && response.data?.indices) {
          // Show the first 3 indices (NIFTY 50, SENSEX, BANKNIFTY)
          setTopIndices(response.data.indices.slice(0, 3));
          return response.data.indices;
        }
        return null;
      } catch (error) {
        console.error('Error fetching indices:', error);
        return null;
      }
    },
    refetchInterval: 1000, // Refresh every 1 second
    enabled: !!apiKey,
  });

  if (!apiKey) return null;

  return (
    <div className="indices-topbar">
      <div className="indices-topbar-content">
        {topIndices.length > 0 ? (
          <>
            <div className="indices-left">
            <div className="indices-list">
              {topIndices.map((index) => {
            const isUp = index.change_percent >= 0;
            const color = isUp ? '#10b981' : '#ef4444';

            return (
              <div key={index.symbol} className="index-item">
                <div className="index-name">{index.index_name}</div>
                <div className="index-value">
                  {index.ltp.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="index-change" style={{ color }}>
                  <div className="change-details">
                    {isUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    <span>{Math.abs(index.change_amount).toFixed(2)}</span>
                  </div>
                  <div className="change-percent">
                    ({isUp ? '+' : ''}{index.change_percent.toFixed(2)}%)
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          className="indices-viewall-btn"
          onClick={() => navigate('/indices')}
          title="View all indices"
        >
          <TrendingUp size={16} />
          View All
        </button>
        </div>

        <div className="topbar-right">
          <div className={`market-status ${marketStatus.isOpen ? 'open' : 'closed'}`}>
            <div className="status-indicator">
              <span className="status-dot"></span>
              <span className="status-text">{marketStatus.isOpen ? 'Market Open' : 'Market Closed'}</span>
            </div>
            <div className="time-info">
              <Clock size={14} />
              <span className="current-time">{marketStatus.currentTime}</span>
            </div>
            <div className="time-remaining">{marketStatus.timeRemaining}</div>
          </div>
        </div>
          </>
        ) : (
          <div className="text-xs text-gray-500">Loading market data...</div>
        )}
      </div>
    </div>
  );
};

export default IndicesTopBar;
