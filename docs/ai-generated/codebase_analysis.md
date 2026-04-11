# OpenAlgo Codebase - Comprehensive Understanding

## Project Overview

**OpenAlgo** is a production-grade, open-source **algorithmic trading platform** built with:
- **Backend**: Python Flask (3.12+) with 839 Python files (~98.7K LOC)
- **Frontend**: React 19 with TypeScript, Vite, shadcn/ui, TanStack Query
- **Core Purpose**: Unified broker API layer across 30+ Indian brokers + real-time trading automation

**Key Positioning**: Self-hosted trading infrastructure where traders own their data, strategies, and execution stack. Bridges trading ideas from TradingView, Amibroker, Python, Excel, AI agents, and executes across any integrated broker.

---

## Architecture Overview

### High-Level Flow
```
External Platforms (TradingView/Amibroker/Excel/Python/AI)
    ↓
OpenAlgo REST API (/api/v1/)
    ↓
Broker Abstraction Layer (30+ normalized broker APIs)
    ↓
Real Broker APIs (Zerodha, Angel, Fyers, etc.)

Real-Time Data:
Broker WebSocket Streams → WebSocket Proxy (port 8765) → ZeroMQ (port 5555) → Clients
```

---

## Directory Structure & Components

### Core Backend Structure

```
openalgo/
├── app.py                          # Flask app entry point + banner display
├── blueprints/                     # Flask routes (45+ files)
│   ├── auth.py, admin.py, dashboard.py
│   ├── orders.py, analyzer.py, strategy.py
│   ├── telegram.py, flow.py (visual strategy builder)
│   ├── latency.py, traffic.py (monitoring)
│   └── [other feature routes]
├── restx_api/                      # REST API endpoints (/api/v1/)
│   ├── __init__.py                 # API initialization + namespaces
│   ├── place_order.py              # Order execution
│   ├── quotes.py, depth.py         # Market data
│   ├── holdings.py, funds.py       # Portfolio
│   ├── analyzer.py                 # Paper trading mode
│   ├── option_greeks.py            # Options analytics
│   ├── split_order.py              # Smart order routing
│   └── [35+ endpoint modules]
├── broker/                         # Broker integrations (30+ brokers)
│   ├── zerodha/
│   │   ├── plugin.json             # Broker metadata
│   │   ├── api/
│   │   │   ├── auth_api.py         # OAuth/API key auth
│   │   │   ├── order_api.py        # Place/modify/cancel
│   │   │   ├── data.py             # Quotes/depth/history
│   │   │   └── funds.py            # Margins/balance
│   │   ├── mapping/                # Format conversion (OpenAlgo ↔ broker)
│   │   ├── streaming/              # WebSocket adapter
│   │   └── database/               # Symbol mapping DB
│   ├── angel/, dhan/, fyers/       # [29+ other brokers follow same pattern]
├── database/                       # SQLAlchemy models & DB utilities
│   ├── auth_db.py                  # User/auth/API key models (encryption with Argon2 + Fernet)
│   ├── user_db.py                  # User profiles
│   ├── strategy_db.py              # Strategy definitions
│   ├── analyzer_db.py              # Paper trading state
│   ├── action_center_db.py         # Order approval workflow
│   ├── flow_db.py                  # Visual flow builder state
│   ├── latency_db.py               # Performance metrics
│   ├── traffic_db.py               # API usage logs
│   ├── telegram_db.py              # Telegram integration
│   └── [25+ other domain models]
├── services/                       # Business logic layer (60+ files)
│   ├── place_order_service.py      # Order execution logic
│   ├── market_data_service.py      # Quote/depth aggregation
│   ├── analyzer_service.py         # Paper trading engine
│   ├── flow_executor_service.py    # Visual strategy execution
│   ├── action_center_service.py    # Order approval logic
│   ├── websocket_service.py        # Real-time data distribution
│   ├── telegram_bot_service.py     # Telegram notifications
│   └── [50+ other business logic]
├── websocket_proxy/                # Unified real-time data server
│   ├── server.py                   # Main proxy (handles 3000+ concurrent symbols)
│   ├── base_adapter.py             # Broker adapter interface
│   ├── broker_factory.py           # Adapter factory pattern
│   └── mapping.py                  # Protocol mappings
├── mcp/                            # AI agent integration (MCP server)
│   └── mcpserver.py                # Claude/Copilot/ChatGPT bridge
├── utils/                          # Shared utilities
│   ├── logging.py                  # Structured logging
│   ├── plugin_loader.py            # Dynamic broker loading
│   ├── env_check.py                # Environment validation
│   └── [other helpers]
├── database/                       # SQLite databases (separate concerns)
│   ├── openalgo.db                 # Main app data
│   ├── logs.db                     # API traffic logs
│   ├── latency.db                  # Performance data
│   ├── sandbox.db                  # Paper trading (isolated ₹1 Crore virtual capital)
│   └── historify.duckdb            # Historical market data (DuckDB)
├── frontend/                       # React 19 SPA
│   ├── package.json                # Node deps + build config
│   ├── src/
│   │   ├── App.tsx                 # Main app component
│   │   ├── pages/                  # Route components
│   │   ├── components/             # shadcn/ui + custom components
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── stores/                 # Zustand state (client-side)
│   │   ├── api/                    # TanStack Query hooks
│   │   ├── contexts/               # React contexts
│   │   ├── lib/                    # Utilities + helpers
│   │   └── index.css               # Tailwind CSS
│   ├── dist/                       # Built assets (gitignored, built by CI)
│   ├── vite.config.ts              # Vite build config
│   └── e2e/                        # Playwright end-to-end tests
└── test/                           # Python unit tests
```

---

## Key Technologies & Patterns

### Backend Stack
- **Flask 3.0**: HTTP routing + middleware
- **Flask-RESTX**: Auto-generated Swagger docs, request validation
- **SQLAlchemy 2.0**: ORM with parameterized queries (SQL injection protection)
- **Flask-SocketIO**: Real-time order/trade/position updates
- **ZeroMQ**: High-performance message bus (internal data distribution)
- **Argon2-CFFI**: Password hashing (PHC winner 2015)
- **Cryptography.Fernet**: Symmetric encryption for tokens (PBKDF2 key derivation)
- **APScheduler**: Scheduled tasks (session expiry, market calendar syncs)

### Frontend Stack
- **React 19**: UI components with hooks
- **TypeScript**: Type safety
- **Vite 7**: Fast bundler
- **Tailwind CSS 4**: Utility-first styling
- **shadcn/ui**: Pre-built accessible components (Radix UI)
- **TanStack Query v5**: Server state + caching
- **Zustand**: Lightweight client state
- **CodeMirror**: Syntax-highlighted code editor (Python strategies)
- **xyflow/React Flow**: Visual node-based strategy builder
- **TradingView Lightweight Charts**: Financial chart rendering
- **Vitest**: Unit testing
- **Playwright**: E2E testing
- **Biome**: Linting + formatting

### Data & Performance
- **SQLite**: 4 separate databases (main, logs, latency, sandbox) for isolation
- **DuckDB**: Historical market data storage (columnar, high-performance queries)
- **Connection Pooling**: WebSocket proxy limits = 1000 symbols/connection × 3 connections = 3000 symbols max
- **Subscription Index**: O(1) lookup for message routing (defaultdict-based)
- **Message Throttling**: 50ms minimum between updates (prevents spam)

---

## Database Architecture

### 5 Separate SQLite + DuckDB Databases

| Database | Purpose | Model Examples |
|----------|---------|-----------------|
| `openalgo.db` | Main app | User, Auth, ApiKeys, ActiveSessions, Strategy, Flow, ActionCenter |
| `logs.db` | Traffic logs | APILog, OrderLog, TradeLog |
| `latency.db` | Performance metrics | LatencyRecord |
| `sandbox.db` | Paper trading | Isolated virtual capital ₹1 Crore + realistic margin system |
| `historify.duckdb` | Historical data | Market data snapshots (columnar storage) |

### Key Models (SQLAlchemy ORM)

**Auth & Security** (`auth_db.py`):
- `User`: Username, password (Argon2), email, TOTP secret
- `Auth`: Broker credentials (encrypted with Fernet)
- `ApiKeys`: Hashed + encrypted API keys with order mode
- `ActiveSession`: Multi-device session tracking
- `LoginAttempt`: Audit trail with IP + device info
- `IpBan`: Manual/automatic IP blocking

**Core Trading** (`strategy_db.py`, `analyzer_db.py`):
- `Strategy`: Python strategy definitions + schedule
- `Flow`: Visual strategy nodes + connections
- `AnalyzerPosition`: Paper trading positions
- `ActionCenterItem`: Pending order approval

**Real-Time** (`*_db.py`):
- `Token`: Broker token refresh tracking
- `Telegram`: User Telegram chat ID + alerts
- `MasterContractStatus`: Symbol list cache status

---

## Broker Integration Architecture

### Standardized Broker Plugin Pattern

Every broker implements this interface (`broker/{name}/`):

```python
# api/auth_api.py
def authenticate(credentials) → broker_token, feed_token

# api/order_api.py
def place_order(params) → order_id, status, message
def modify_order(order_id, params) → status
def cancel_order(order_id) → status

# api/data.py
def get_quotes(symbols) → {symbol: price, change, etc.}
def get_depth(symbol) → {bids[], asks[]}
def get_history(symbol, interval) → [timestamp, open, high, low, close, volume]

# api/funds.py
def get_balance() → cash, used_margin, free_margin

# mapping/
# Transform OpenAlgo format ↔ broker format
# Example: NSE:SBIN-EQ → zerodha's 256265

# streaming/
# WebSocket adapter - normalize broker data streams

# database/master_contract_db.py
# Download & cache broker's full symbol list

# plugin.json
{
  "name": "zerodha",
  "auth_type": "oauth2",
  "supported_markets": ["NSE", "NFO", "MCX", "BSE"]
}
```

### Supported Brokers (30+)
Zerodha, Angel, Fyers, Upstox, Shoonya (Finvasia), Dhan, 5Paisa, Flattrade, Samco, Kotak Neo, Motilal Oswal, Groww, AliceBlue, IIFL, IBulls, Tradejini, Firstock, Wisdom Capital, Paytm Money, Indmoney, Compositedge, Definedge, Jainam XTS, Delta Exchange, DhanSandbox, and more.

---

## REST API Layer (`/api/v1/`)

### 40+ Endpoints with Auto-Swagger Docs

**Order Management** (10 endpoints):
- `/api/v1/place_order` - Market/Limit/SL orders with position sizing
- `/api/v1/modify_order` - Modify pending orders
- `/api/v1/cancel_order` - Cancel single order
- `/api/v1/cancel_all_order` - Bulk cancel
- `/api/v1/place_smart_order` - Intelligent order routing (auto-splits)
- `/api/v1/basket_order` - Multi-leg orders
- `/api/v1/split_order` - Manual order splitting
- `/api/v1/options_order` - Options trading
- `/api/v1/options_multiorder` - Multi-leg options
- `/api/v1/orderstatus` - Order state + fills

**Portfolio** (8 endpoints):
- `/api/v1/orderbook` - All orders
- `/api/v1/tradebook` - All fills
- `/api/v1/positionbook` - Open positions
- `/api/v1/openposition` - Position details
- `/api/v1/holdings` - Owned shares
- `/api/v1/funds` - Balance + margins
- `/api/v1/close_position` - Exit position

**Market Data** (12+ endpoints):
- `/api/v1/quotes` - Quote data
- `/api/v1/multiquotes` - Bulk quotes
- `/api/v1/depth` - Market depth (5 levels)
- `/api/v1/history` - Historical OHLCV
- `/api/v1/search` - Symbol search
- `/api/v1/instruments` - All symbols for a market
- `/api/v1/expiry` - Options expiries
- `/api/v1/option_chain` - Full option chain
- `/api/v1/option_greeks` - Greeks calculator
- `/api/v1/multi_option_greeks` - Bulk Greeks
- `/api/v1/synthetic_future` - Synthetic futures

**Advanced** (10+ endpoints):
- `/api/v1/margin` - Margin calculator
- `/api/v1/analyzer` - Paper trading mode
- `/api/v1/ping` - Health check
- `/api/v1/telegram_bot` - Telegram alerts setup
- Charting APIs, strategy webhooks, etc.

### Authentication
- **Header**: `X-API-KEY: <key>` 
- **Body**: `{"apikey": "<key>", ...}`
- API keys hashed + encrypted before DB storage
- Rate limiting per endpoint type (50 req/sec default)

---

## Real-Time Systems

### WebSocket Proxy Server (port 8765)

**Flow**:
```
Client → WebSocket Connect → API Key Validation → Subscribe to symbols
         ↓
Broker WebSocket Stream → Adapter normalization → ZeroMQ publish
         ↓
ZeroMQ listener thread → Subscription index lookup → Route to client
```

**Features**:
- Single unified WebSocket for all 30+ brokers
- Connection pooling (1000 symbols/connection × 3 = 3000 max)
- Dynamic broker adapter factory pattern
- Subscription index (O(1) symbol-to-clients routing)
- Message throttling (50ms between updates)
- Auto-reconnect + failover handling

### Real-Time Events (Flask-SocketIO)

Emitted to connected frontend clients:
- `order_placed` - New order executed
- `order_modified` - Order updated
- `order_filled` - Order partially/fully filled
- `trade` - Trade executed
- `position_update` - Position P&L updated
- `fund_update` - Margin available changed
- `strategy_alert` - Strategy triggered

---

## Visual Strategy Builder (Flow)

**Node-based editor** (`blueprints/flow.py`, `frontend/Flow`):
- **Pre-built nodes**: 
  - Market data (subscribe to symbol)
  - Conditions (if/then logic)
  - Order execution (place buy/sell)
  - Notifications (email/Telegram/webhook)
- **Real-time execution** with live candle updates
- **Webhook triggers** for external signals
- **Visual debugging** with flow highlighting
- Stored as graph JSON in `flow_db.py`

---

## Paper Trading Mode (Analyzer)

**Isolated sandbox** with ₹1 Crore virtual capital:
- Separate `sandbox.db` database
- Realistic margin system with leverage (broker-specific)
- Auto square-off at IST market close (3:30 PM)
- Same order types as live (Market, Limit, SL, SL-M)
- P&L tracking + realistic slippage
- Toggle between live and paper mode per session

---

## AI Agent Integration (MCP Server)

**File**: `mcp/mcpserver.py` (35KB)

Exposes OpenAlgo as an MCP (Model Context Protocol) server:
- Compatible with Claude Desktop, Cursor, Windsurf, ChatGPT plugins
- Natural language trading commands
- Full trading capabilities via REST API
- Local + secure integration

**Example**: "Buy 10 shares of SBIN at market in Zerodha" → converts to `/api/v1/place_order` call

---

## Python Strategy Manager

**In-app Python editor** (`blueprints/python_strategy.py`):
- **CodeMirror** syntax highlighter + themes
- Host strategies directly (no external servers)
- Auto-scheduled start/stop times (IST)
- Process isolation per strategy
- Encrypted environment variables
- Real-time logs + state persistence
- Automatic square-off at market close (Analyzer mode)

---

## Security & Authentication

### Multi-Layer Security

1. **Password Hashing**: Argon2-CFFI (PHC winner)
2. **Token Encryption**: Fernet (symmetric) + PBKDF2 (key derivation from pepper)
3. **API Key Hashing**: Argon2 hash + Fernet encryption in DB
4. **Session Management**: 
   - Per-device session tracking (ActiveSession table)
   - IST-based auto-expiry (default 3 AM)
   - TOTP 2FA support
5. **CSRF Protection**: Flask-WTF with token validation
6. **CORS**: Configurable allowed origins
7. **CSP Headers**: Content Security Policy enforcement
8. **IP Banning**: Manual/automatic suspicious IP blocking
9. **Rate Limiting**: Per endpoint (login, API, orders)
10. **Audit Trail**: All login attempts logged (IP, device, success/failure)

### Environment Variables (Security)
```
APP_KEY              # Flask secret key (32-byte hex)
API_KEY_PEPPER       # Encryption pepper (32-byte hex minimum)
DATABASE_URL         # Main DB path
BROKER_API_KEY/SECRET # Broker credentials
VALID_BROKERS        # Enabled brokers list
SESSION_EXPIRY_TIME  # Daily auto-logout time (IST, default 03:00)
DISABLE_SESSION_EXPIRY # For 24/7 crypto brokers
```

---

## Monitoring & Analytics

### Latency Monitor (`blueprints/latency.py`)
- Track order execution round-trip time
- Per-broker latency metrics
- Identify performance bottlenecks

### Traffic Monitor (`blueprints/traffic.py`)
- API endpoint usage analytics
- Error tracking + debugging
- Usage patterns per user

### PnL Tracker (`blueprints/pnltracker.py`)
- Real-time P&L with interactive charts (TradingView Lightweight Charts)
- Daily/cumulative tracking
- Strategy-level P&L attribution

---

## Frontend Architecture (React 19)

### Structure
```
frontend/src/
├── App.tsx                    # Main component + routing
├── pages/
│   ├── Auth/                 # Login, signup, 2FA
│   ├── Dashboard/            # Main dashboard
│   ├── Orders/               # Order management UI
│   ├── Holdings/             # Portfolio view
│   ├── Strategy/             # Strategy editor
│   ├── Flow/                 # Visual builder
│   ├── Analyzer/             # Paper trading UI
│   ├── Telegram/             # Telegram setup
│   ├── Settings/             # User preferences
│   └── [other pages]
├── components/
│   ├── OrderForm/            # Order entry widget
│   ├── QuoteWidget/          # Real-time quotes
│   ├── ChartWidget/          # TradingView charts
│   ├── PositionTable/        # Portfolio table
│   └── [shadcn/ui components]
├── hooks/
│   ├── useOrders/            # Order data fetching
│   ├── useQuotes/            # Quote subscriptions
│   ├── useWebSocket/         # Real-time connectivity
│   └── [custom hooks]
├── stores/                   # Zustand state (theme, UI state)
├── api/                      # TanStack Query hooks
├── contexts/                 # Auth context, theme context
└── utils/                    # Formatters, validators
```

### Key React Patterns
- **Server State**: TanStack Query (useQuery, useMutation)
- **Client State**: Zustand stores (theme, sidebar state)
- **Real-Time**: Socket.IO emitter for order/trade updates
- **Form Handling**: TypeScript-first form validation
- **Components**: Composition over inheritance (shadcn/ui patterns)
- **Testing**: Vitest unit tests + Playwright E2E tests

---

## Build & Deployment

### Development Workflow
```bash
# 1. Install uv (required)
pip install uv

# 2. Configure environment
cp .sample.env .env

# 3. Build React frontend (required once locally)
cd frontend && npm install && npm run build && cd ..

# 4. Run Flask app (auto-creates DBs)
uv run app.py

# Access: http://127.0.0.1:5000
#         ws://127.0.0.1:8765 (WebSocket proxy)
```

### Production
- **Docker**: Multi-stage Dockerfile available
- **Gunicorn**: Use `-w 1` (single worker for WebSocket)
- **Nginx**: Reverse proxy + SSL termination
- **React Build**: `npm run build` generates `/frontend/dist/` (served by Flask)

### Important: Frontend `/dist/` is Gitignored
- Not tracked in git (prevents merge conflicts)
- Built automatically by GitHub Actions CI/CD
- Must build locally: `cd frontend && npm run build`

---

## Code Statistics
- **Python Files**: 839 files across backend
- **Total Python LOC**: ~98.7K lines
- **Services Layer**: 60+ business logic modules
- **Broker Integrations**: 30+ fully supported
- **REST Endpoints**: 40+ with auto-Swagger docs
- **Frontend Components**: 100+ React components

---

## Key Extension Points (for future features)

1. **New Broker**: Create `broker/new_broker/` following plugin pattern
2. **New API Endpoint**: Add to `restx_api/` with Flask-RESTX namespace
3. **New Service**: Add to `services/` for business logic reuse
4. **New Database Model**: Define in `database/*_db.py`, add to session factory
5. **New Real-Time Event**: Emit via Flask-SocketIO in relevant service
6. **New Strategy Type**: Add execution logic to `services/flow_executor_service.py`
7. **New WebSocket Data**: Add adapter in `websocket_proxy/`, normalize in mapping

---

## Performance Characteristics

- **Concurrent Symbols**: 3,000 (1000/ws × 3 connections)
- **API Rate Limit**: 50 req/second default (configurable)
- **Order Rate Limit**: 10 req/second
- **WebSocket Update Throttle**: 50ms minimum
- **Database**: SQLite (sufficient for single-instance, consider PostgreSQL for scale)
- **Message Bus**: ZeroMQ (sub-millisecond latency)

---

## Testing Infrastructure

### Python Tests
```bash
uv run pytest test/ -v
uv run pytest test/test_broker.py::test_function_name -v
```

### React Tests
```bash
cd frontend
npm test                    # Unit tests (Vitest)
npm run test:coverage      # With coverage
npm run e2e                # End-to-end (Playwright)
npm run build              # Build validation
```

### Code Quality
```bash
ruff check .               # Linting
ruff format .              # Formatting
biome check frontend/      # Frontend linting
```

---

## Critical Dependencies

**Backend Critical**:
- Flask 3.1.3
- SQLAlchemy 2.0.48
- Flask-SocketIO 5.6.1
- Argon2-CFFI 23.1.0
- ZeroMQ (via pyzmq)
- Cryptography 46.0.7

**Frontend Critical**:
- React 19
- TypeScript
- Tailwind CSS 4.0
- TanStack Query v5
- shadcn/ui

---

## Known Architectural Decisions

1. **SQLite × 5**: Simplicity + zero dependencies. Trade-off: limited concurrent writes.
2. **ZeroMQ**: Sub-millisecond latency for internal message bus. Alternative: Redis (simpler but slower).
3. **Plugin Pattern**: Dynamic broker loading allows 30+ brokers without code changes.
4. **Fernet Encryption**: Symmetric encryption (simple, fast). Broker tokens never sent to external systems.
5. **Connection Pooling in WebSocket**: Handles broker symbol limits elegantly. Automatic × 3 connections.
6. **Separate Analyzer DB**: Complete isolation of paper trading (sandbox.db) from live data.
7. **Frontend Built by CI**: `/frontend/dist/` gitignored to prevent merge conflicts + ensure fresh builds.

---

## Key Files to Know

| File | Purpose | LOC |
|------|---------|-----|
| `app.py` | Flask app entry + WebSocket server spawn | 150+ |
| `database/auth_db.py` | User/auth/encryption models | 500+ |
| `services/place_order_service.py` | Order execution logic | 200+ |
| `websocket_proxy/server.py` | Unified WebSocket proxy | 1652 |
| `blueprints/auth.py` | Login/signup routes | 300+ |
| `restx_api/__init__.py` | API initialization + doc generation | 50+ |
| `broker/{name}/plugin.json` | Broker metadata | 20 per broker |
| `frontend/src/App.tsx` | React root component | 400+ |
| `mcp/mcpserver.py` | AI agent integration | 900+ |

---

## What I Understand About the Codebase

✅ **Core Architecture**: Flask + React SPA with unified broker API layer
✅ **Database Design**: 5 isolated databases (main, logs, latency, sandbox, historify)
✅ **Broker Pattern**: Plugin-based architecture supporting 30+ brokers
✅ **Security**: Argon2 + Fernet encryption, rate limiting, audit trails
✅ **Real-Time**: WebSocket proxy + ZeroMQ message bus for market data
✅ **REST API**: 40+ endpoints with Flask-RESTX auto-documentation
✅ **Visual Strategy Builder**: Node-based Flow editor with webhook triggers
✅ **Paper Trading**: Isolated sandbox with realistic margin system
✅ **AI Integration**: MCP server for Claude/Copilot/ChatGPT compatibility
✅ **Frontend Stack**: React 19 + TypeScript + Tailwind + TanStack Query
✅ **Testing**: Pytest + Vitest + Playwright (E2E)
✅ **Performance**: Message throttling, subscription indexing, connection pooling
✅ **Security**: Multi-device session tracking, 2FA, IP banning, audit logging

---

**Ready for complex feature requests!** The codebase is well-structured with clear separation of concerns. Each major feature request will likely involve:
1. New service layer logic
2. New database model(s)
3. New REST endpoint(s)
4. New React page/component(s)
5. Real-time event emissions (if applicable)

