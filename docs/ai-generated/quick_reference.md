# OpenAlgo - Quick Reference for Feature Development

## What is OpenAlgo?

OpenAlgo is a **self-hosted algorithmic trading platform** that acts as a unified API layer across 30+ Indian brokers. Traders can execute strategies from TradingView, Amibroker, Python, Excel, or AI agents without changing code when switching brokers.

**Key Innovation**: Single API for multiple brokers (standardized orders, market data, portfolio management)

---

## Project Structure Quick Reference

```
openalgo/
├── app.py                      # Flask entry point → starts WebSocket proxy
├── blueprints/                 # Flask route handlers (45+ files)
│   ├── auth.py                 # Login/signup/session management
│   ├── orders.py               # Order UI/webhooks
│   ├── strategy.py             # Strategy management
│   └── ...                      # Dashboard, analyzer, flow, telegram, etc.
├── restx_api/                  # REST API /api/v1/ (40+ endpoints)
│   ├── place_order.py          # POST /api/v1/place_order
│   ├── quotes.py               # GET /api/v1/quotes
│   ├── analyzer.py             # Paper trading endpoints
│   └── ...                      # Depth, holdings, funds, option_greeks, etc.
├── broker/                     # 30+ broker integrations (plugin-based)
│   ├── zerodha/                # Each broker follows same structure:
│   │   ├── plugin.json         #   - Metadata
│   │   ├── api/                #   - Auth, Orders, Data, Funds
│   │   ├── mapping/            #   - Symbol format converters
│   │   ├── streaming/          #   - WebSocket adapter
│   │   └── database/           #   - Symbol cache DB
│   └── [29+ other brokers]
├── database/                   # SQLAlchemy models (encryption, auth, etc.)
│   ├── auth_db.py              # User, Auth, ApiKeys (Argon2 + Fernet)
│   ├── strategy_db.py          # Strategy definitions
│   ├── analyzer_db.py          # Paper trading state
│   ├── action_center_db.py     # Order approval workflow
│   └── [25+ other models]
├── services/                   # Business logic (60+ files)
│   ├── place_order_service.py  # Order execution logic
│   ├── analyzer_service.py     # Paper trading engine
│   ├── market_data_service.py  # Quote aggregation
│   └── [57+ other services]
├── websocket_proxy/            # Unified real-time data (port 8765)
│   ├── server.py               # Main proxy server
│   ├── base_adapter.py         # Broker adapter interface
│   ├── broker_factory.py       # Dynamic adapter creation
│   └── mapping.py              # Protocol mapping
├── mcp/                        # AI agent integration (Claude/Copilot/ChatGPT)
│   └── mcpserver.py
├── db/                         # 5 Separate SQLite databases
│   ├── openalgo.db             # Main app
│   ├── logs.db                 # Traffic + audit
│   ├── latency.db              # Performance metrics
│   ├── sandbox.db              # Paper trading (isolated)
│   └── historify.duckdb        # Historical data (DuckDB)
├── frontend/                   # React 19 SPA (TypeScript)
│   ├── src/
│   │   ├── pages/              # Dashboard, Orders, Holdings, Flow, Analyzer
│   │   ├── components/         # shadcn/ui + custom components
│   │   ├── hooks/              # Custom React hooks (useOrders, useQuotes, etc.)
│   │   ├── stores/             # Zustand (theme, UI state)
│   │   ├── api/                # TanStack Query hooks
│   │   └── lib/                # Utils, validators, formatters
│   ├── dist/                   # Build output (gitignored, built by CI)
│   ├── vite.config.ts
│   ├── package.json
│   └── e2e/                    # Playwright E2E tests
└── test/                       # Python unit tests (pytest)
```

---

## Database Architecture

### 5 Isolated Databases

| Database | Purpose | Key Models |
|----------|---------|-----------|
| `openalgo.db` | Main | User, Auth, ApiKeys, Strategy, Flow, ActionCenter |
| `logs.db` | Audit | APILog, OrderLog, LoginAttempt |
| `latency.db` | Metrics | LatencyRecord (execution times) |
| `sandbox.db` | Paper | AnalyzerPosition, AnalyzerOrder (isolated ₹1 Crore) |
| `historify.duckdb` | History | Market data (DuckDB columnar) |

### SQLAlchemy Models (ORM)
- **No raw SQL** - Always use ORM (parameterized queries prevent SQL injection)
- **Encryption**: Passwords (Argon2), Broker tokens (Fernet), API keys (both)
- **Session-based cache TTL** - Automatic cache invalidation at market close

---

## REST API Quick Reference

### 40+ Endpoints Auto-Documented at `/api/docs`

**Order Management**:
- `POST /api/v1/place_order` - Place order (Market/Limit/SL)
- `PUT /api/v1/modify_order` - Modify pending order
- `DELETE /api/v1/cancel_order` - Cancel order
- `POST /api/v1/place_smart_order` - Intelligent routing (auto-splits)

**Portfolio**:
- `GET /api/v1/orderbook` - All orders
- `GET /api/v1/positionbook` - Open positions
- `GET /api/v1/holdings` - Shares owned
- `GET /api/v1/funds` - Cash + margins

**Market Data**:
- `GET /api/v1/quotes` - Real-time quotes
- `GET /api/v1/depth` - Market depth (5 levels)
- `GET /api/v1/history` - OHLCV data
- `GET /api/v1/option_chain` - Options chain
- `GET /api/v1/option_greeks` - Greeks calculator

**Special**:
- `POST /api/v1/analyzer` - Paper trading
- `POST /api/v1/place_smart_order` - Order splitting
- `POST /api/v1/options_multiorder` - Multi-leg options

### API Authentication
```bash
# Header method
curl -H "X-API-KEY: your_api_key" http://localhost:5000/api/v1/ping

# Body method (recommended for SDKs)
curl -X POST http://localhost:5000/api/v1/quotes \
  -H "Content-Type: application/json" \
  -d '{"apikey": "your_api_key", "mode": "LTP", "exchangeTokens": {"NSE": ["10265505"]}}'
```

---

## Real-Time Systems

### WebSocket (Port 8765)
```javascript
const ws = new WebSocket("ws://127.0.0.1:8765");

ws.onopen = () => {
  ws.send(JSON.stringify({
    "action": "subscribe",
    "mode": "LTP",  // LTP, QUOTE, or DEPTH
    "symbols": ["NSE:SBIN-EQ", "NFO:NIFTY24JAN24000CE"],
    "apikey": "your_api_key"
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Quote:", data); // {symbol, ltp, change, ...}
};
```

**Features**:
- Single unified endpoint for all brokers
- Connection pooling: 1000 symbols/ws × 3 = 3000 max
- Message throttling: 50ms minimum between updates
- Auto-reconnect on disconnect

### Socket.IO (Real-Time Events)
```javascript
import io from "socket.io-client";

const socket = io("http://127.0.0.1:5000");

socket.on("order_placed", (order) => {
  console.log("New order:", order);
});

socket.on("trade", (trade) => {
  console.log("Trade filled:", trade);
});

socket.on("position_update", (position) => {
  console.log("Position P&L:", position.pnl);
});
```

---

## Broker Integration Pattern

### Adding a New Broker

1. **Create plugin directory**:
   ```bash
   mkdir -p broker/mybroker/api broker/mybroker/mapping broker/mybroker/streaming broker/mybroker/database
   ```

2. **Create `plugin.json`**:
   ```json
   {
     "name": "mybroker",
     "auth_type": "oauth2",  // or "api_key"
     "supported_markets": ["NSE", "NFO", "MCX"],
     "supports_ioc": true,
     "supports_oco": false
   }
   ```

3. **Implement required modules**:
   - `api/auth_api.py` - OAuth or API key authentication
   - `api/order_api.py` - place_order(), modify_order(), cancel_order()
   - `api/data.py` - get_quotes(), get_depth(), get_history()
   - `api/funds.py` - get_balance()
   - `mapping/` - Convert OpenAlgo format ↔ broker format
   - `streaming/` - WebSocket adapter (extend BaseBrokerWebSocketAdapter)
   - `database/master_contract_db.py` - Symbol list caching

4. **Add to `VALID_BROKERS`** in `.env`:
   ```bash
   VALID_BROKERS='zerodha,angel,mybroker'
   ```

---

## Security Quick Reference

### Password & Token Encryption

```python
# In database/auth_db.py
from argon2 import PasswordHasher
from cryptography.fernet import Fernet

# Password hashing (Argon2)
ph = PasswordHasher()
hashed = ph.hash("user_password")  # Store in DB
ph.verify(hashed, "user_password")  # Login verification

# Token encryption (Fernet)
fernet = get_encryption_key()  # Derived from API_KEY_PEPPER
encrypted_token = fernet.encrypt(broker_token.encode())  # Store in DB
decrypted_token = fernet.decrypt(encrypted_token).decode()  # Retrieve
```

### Environment Variables (Required)
```bash
APP_KEY="..." # 32-byte hex (Flask secret)
API_KEY_PEPPER="..." # 32+ byte hex (encryption pepper)
DATABASE_URL="sqlite:///db/openalgo.db"
SESSION_EXPIRY_TIME="03:00"  # IST, daily auto-logout
VALID_BROKERS="zerodha,angel,fyers,..."
```

### Rate Limiting
```bash
LOGIN_RATE_LIMIT_MIN="5 per minute"
API_RATE_LIMIT="50 per second"
ORDER_RATE_LIMIT="10 per second"
WEBHOOK_RATE_LIMIT="100 per minute"
```

---

## Development Workflow

### Setup (First Time)
```bash
# 1. Install uv
pip install uv

# 2. Configure environment
cp .sample.env .env
# Edit .env with your values

# 3. Build React frontend (required locally)
cd frontend
npm install
npm run build
cd ..

# 4. Run Flask app
uv run app.py
```

### Running Tests
```bash
# Python tests
uv run pytest test/ -v
uv run pytest test/test_broker.py::test_function_name -v

# React tests
cd frontend
npm test                    # Unit (Vitest)
npm run test:coverage       # With coverage
npm run e2e                 # End-to-end (Playwright)

# Code quality
ruff check .
biome check frontend/
```

### Common Commands
```bash
# Run Flask app in dev mode
uv run app.py

# Run with Gunicorn (production)
uv run gunicorn --worker-class eventlet -w 1 app:app  # Note: -w 1 for WebSocket

# Check if port is in use
lsof -i :5000  # Flask
lsof -i :8765  # WebSocket proxy
lsof -i :5555  # ZeroMQ

# Clean up temp files
rm -rf __pycache__ .pytest_cache frontend/dist
```

---

## Key Extension Points

### Add New REST Endpoint
```python
# restx_api/my_feature.py
from flask_restx import Namespace, Resource, fields

api = Namespace('my_feature', description='My feature')

my_model = api.model('MyModel', {
    'status': fields.String(required=True),
    'message': fields.String(),
    'data': fields.Raw()
})

@api.route('/do_something')
class MyFeatureResource(Resource):
    @api.doc('do_something')
    @api.marshal_with(my_model)
    def post(self):
        """Do something awesome"""
        return {'status': 'success', 'message': 'Done!', 'data': {...}}

# In restx_api/__init__.py, add:
from .my_feature import api as my_feature_ns
api.add_namespace(my_feature_ns)
```

### Add New React Component
```typescript
// frontend/src/components/MyFeature.tsx
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

export function MyFeature() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['myFeature'],
    queryFn: () => fetch('/api/v1/my_feature').then(r => r.json())
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>My Feature</h1>
      <Button onClick={() => { /* action */ }}>Click Me</Button>
    </div>
  );
}
```

### Add New Service
```python
# services/my_service.py
from database.auth_db import User
from utils.logging import get_logger

logger = get_logger(__name__)

def do_something_important(user_id: str, params: dict):
    """Business logic for my feature"""
    user = User.query.filter_by(user_id=user_id).first()
    if not user:
        return {'status': 'error', 'message': 'User not found'}
    
    # Your logic here
    logger.info(f"Doing something for {user_id}")
    
    return {'status': 'success', 'data': {...}}
```

---

## Paper Trading Mode (Analyzer)

### How It Works
```
┌──────────────────────┐
│ Paper Trading Mode   │
├──────────────────────┤
│ • Separate sandbox.db│
│ • ₹1 Crore virtual   │
│ • Realistic margins  │
│ • Auto square-off    │
│   at 3:30 PM IST     │
└──────────────────────┘
```

### Accessing via API
```bash
curl -X POST http://localhost:5000/api/v1/analyzer \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "your_api_key",
    "action": "get_state"  # or "place_order", "get_positions"
  }'
```

### Frontend
UI at `/analyzer` route - same UX as live trading but with paper capital

---

## Visual Strategy Builder (Flow)

### How It Works
1. Drag-drop nodes (data, conditions, orders, notifications)
2. Connect nodes with edges
3. Set parameters for each node
4. Save as visual strategy
5. Execute with live market data or webhook triggers
6. See execution flow highlighted in real-time

### Storage
- Flow graph stored as JSON in `flow_db.py`
- Execution state tracked in Flow model
- Webhook handler in `blueprints/flow.py`

---

## AI Agent Integration (MCP Server)

### What is MCP?
Model Context Protocol - allows Claude/ChatGPT/Copilot to interact with local services

### Using with Claude Desktop
```json
// ~/.claude/config.json (on macOS/Linux)
{
  "mcpServers": {
    "openalgo": {
      "command": "uv",
      "args": ["run", "python", "/path/to/openalgo/mcp/mcpserver.py"]
    }
  }
}
```

### Example Usage in Claude
```
User: "Buy 50 shares of SBIN at market in Zerodha"
Claude: Calls /api/v1/place_order with quantity=50, symbol=NSE:SBIN-EQ, broker=zerodha
Response: Order placed successfully, order_id=12345
```

---

## Performance Tuning

### WebSocket Connection Pooling
```bash
# In .env
MAX_SYMBOLS_PER_WEBSOCKET=1000    # Per connection
MAX_WEBSOCKET_CONNECTIONS=3       # Per user/broker
# Total: 3000 symbols max per user
```

### Message Throttling
```python
# websocket_proxy/server.py
self.message_throttle_interval = 0.05  # 50ms minimum between updates
```

### Database Indexing
- All frequently queried columns indexed
- Query performance monitored in `latency.db`
- Consider PostgreSQL for multi-instance deployments

---

## Monitoring & Debugging

### Available Monitoring Tools

1. **Latency Monitor** (`/latency`)
   - Order execution round-trip times
   - Broker comparison

2. **Traffic Monitor** (`/traffic`)
   - API endpoint usage
   - Error tracking
   - Usage patterns

3. **PnL Tracker** (`/pnltracker`)
   - Real-time P&L
   - Daily/cumulative tracking

### Logging
```python
from utils.logging import get_logger

logger = get_logger(__name__)
logger.info("Information")
logger.warning("Warning")
logger.error("Error")
logger.debug("Debug (only in FLASK_DEBUG=True)")
```

### Enable Debug Mode
```bash
# In .env
FLASK_DEBUG=True
LOG_LEVEL=DEBUG
```

---

## Important Files to Know

| File | Purpose |
|------|---------|
| `app.py` | Flask entry point + WebSocket startup |
| `database/auth_db.py` | All auth/encryption models |
| `services/place_order_service.py` | Order execution logic |
| `websocket_proxy/server.py` | Real-time data proxy |
| `restx_api/__init__.py` | API initialization |
| `blueprints/auth.py` | Login/session routes |
| `mcp/mcpserver.py` | AI agent server |
| `frontend/src/App.tsx` | React root component |

---

## Common Mistakes to Avoid

❌ **Don't**:
- Use raw SQL (use SQLAlchemy ORM)
- Store unencrypted API keys
- Commit secrets to git
- Use global Python (always use `uv run`)
- Skip frontend build step in development
- Use `-w >1` with Gunicorn (breaks WebSocket)
- Modify `frontend/dist/` (it's gitignored)

✅ **Do**:
- Use ORM for all DB queries
- Encrypt sensitive data (Argon2 + Fernet)
- Use environment variables
- Always prefix with `uv run`
- Run `npm run build` in `frontend/` before deploying
- Use `-w 1` worker count for Gunicorn
- Let CI/CD build frontend

---

## Troubleshooting

### WebSocket Connection Fails
```bash
# Check if port 8765 is in use
lsof -i :8765

# Kill the process
kill -9 <PID>

# Restart Flask app
uv run app.py
```

### Database Locked
```bash
# SQLite is single-writer - close all connections
pkill -f "python app.py"

# Wait 2-3 seconds, restart
uv run app.py
```

### Frontend Not Showing
```bash
# Build is required locally
cd frontend && npm run build && cd ..

# Restart Flask (it serves dist/)
uv run app.py

# Access at http://127.0.0.1:5000
```

### Broker Integration Not Loading
```bash
# Check broker name in VALID_BROKERS (.env)
# Verify plugin.json exists in broker directory
# Check broker module structure is correct
# Restart app to reload plugins
```

---

**You now have a complete understanding of the codebase! Ready for feature requests.**

