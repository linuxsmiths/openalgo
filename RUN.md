# Local Development Startup Guide

## Quick Start

To start the application locally:

```bash
./run.sh
```

That's it! The script will automatically handle:
1. ✓ Checking for required tools (uv)
2. ✓ Managing Node.js version (via nvm if available)
3. ✓ Building the React frontend if needed
4. ✓ Verifying environment configuration (.env)
5. ✓ Starting the application

## What the Script Does

### 1. Verifies Requirements
- Checks for `uv` package manager (required for Python dependency management)
- Exits with helpful instructions if missing

### 2. Manages Node.js Version
- Detects current Node.js version
- **Automatically installs/upgrades Node 22 via nvm** if needed
- Falls back to system Node if nvm isn't available (with version check)
- **Node 20+ is required** (the frontend uses TypeScript and Vite)

**Why Node 20+?**
- Previous versions had permission issues with TypeScript compilation
- Node 22 is recommended for best compatibility
- The script can auto-install this via nvm

### 3. Builds Frontend
- Checks if `frontend/dist/` exists (production-ready build)
- If missing:
  - Installs `npm` dependencies
  - Runs `npm run build` (takes ~1-2 minutes first time)
- Subsequent runs skip the build if dist already exists

### 4. Verifies Configuration
- Checks for `.env` file
- Creates it from `.sample.env` if missing
- Guides you through required configuration

### 5. Starts the App
- Launches `uv run app.py`
- Shows access URLs

## Troubleshooting

### Node.js Issues

**"Node.js not found"**
```bash
# Option 1: Install via nvm (automatic)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
./run.sh  # Run script again

# Option 2: Install directly
# Download from https://nodejs.org/ (get v20 or v22)
```

**"Node version too old (< 20)"**
```bash
# Upgrade via nvm
nvm install 22
nvm use 22
./run.sh
```

### Frontend Build Issues

**"npm: command not found"**
- Node.js installation incomplete
- Run `node --version` to verify
- Run `./run.sh` again (should auto-detect Node)

**Build takes too long**
- First build can take 1-2 minutes (normal)
- Subsequent runs check cache and skip if not needed
- On slow machines, may take longer

### Environment Configuration

**".env file not found"**
- Script automatically creates it from `.sample.env`
- Follow the prompts to configure broker credentials

**.env is empty or missing credentials**
- Edit `.env` with your broker API keys
- Generate APP_KEY and API_KEY_PEPPER:
  ```bash
  uv run python -c "import secrets; print(secrets.token_hex(32))"
  ```

## Application URLs

Once running:
- **Frontend**: http://localhost:5000
- **API Docs**: http://localhost:5000/api/docs  
- **WebSocket**: ws://localhost:8765

## Stop the Application

Press `Ctrl+C` in the terminal

## Advanced: Manual Steps (if needed)

If you prefer manual control:

```bash
# 1. Set Node version manually
nvm use 22

# 2. Build frontend
cd frontend
npm install
npm run build
cd ..

# 3. Start app
uv run app.py
```

## For Users Without nvm

The script gracefully handles users without nvm installed:
1. Detects system Node version
2. Checks if it's compatible (20+)
3. If too old, gives download instructions
4. Continues with system Node if compatible

No need to install nvm unless you want automatic version management!
