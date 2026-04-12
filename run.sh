#!/bin/bash

# OpenAlgo Application Startup Script for Local Development
# This script handles local environment setup and starts the application

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check for required tools
check_requirements() {
    print_header "Checking Requirements"

    # Check for uv
    if ! command -v uv &> /dev/null; then
        print_error "uv package manager not found"
        echo "Install with: pip install uv"
        echo "See: https://docs.astral.sh/uv/getting-started/installation/"
        exit 1
    fi
    print_success "uv package manager installed"
}

# Ask user permission to install nvm
ask_install_nvm() {
    echo ""
    echo "nvm (Node Version Manager) is required but not installed."
    echo ""
    echo "I will run:"
    echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo ""
    echo "This will:"
    echo "  • Download nvm installer from GitHub"
    echo "  • Install nvm to ~/.nvm directory"
    echo "  • Add nvm configuration to your shell profile (~/.bashrc, ~/.zshrc, etc)"
    echo "  • You may need to restart your terminal or run: source ~/.nvm/nvm.sh"
    echo ""
    echo -n "Do you want to continue? (y/n): "
    read -r response

    if [[ "$response" =~ ^[Yy]$ ]]; then
        return 0
    else
        return 1
    fi
}

# Auto-install nvm if not available
auto_install_nvm() {
    print_warning "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash > /dev/null 2>&1

    # Source nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    if command -v nvm &> /dev/null; then
        print_success "nvm installed successfully"
        return 0
    else
        print_error "Failed to install nvm"
        return 1
    fi
}

# Handle Node version with nvm
setup_node_version() {
    print_header "Checking Node.js"

    # Check if nvm is installed, if not try to install it
    NVM_AVAILABLE=false
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        source "$HOME/.nvm/nvm.sh"
        NVM_AVAILABLE=true
    else
        # Try to auto-install nvm
        print_warning "nvm not found"
        if ask_install_nvm; then
            if auto_install_nvm; then
                source "$HOME/.nvm/nvm.sh"
                NVM_AVAILABLE=true
            fi
        else
            print_warning "nvm installation cancelled by user"
        fi
    fi

    # Get current Node version
    CURRENT_NODE=$(node --version 2>/dev/null || echo "")

    if [ -z "$CURRENT_NODE" ]; then
        # Node not installed
        if [ "$NVM_AVAILABLE" = true ]; then
            print_warning "Node.js not found, installing Node 22..."
            nvm install 22
            nvm use 22
            print_success "Node 22 installed and activated"
        else
            print_error "Could not install nvm automatically"
            echo ""
            echo "Please install Node 20 or later manually:"
            echo "  Option 1: Install nvm first"
            echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
            echo "    Then run: ./run.sh"
            echo ""
            echo "  Option 2: Download Node directly"
            echo "    https://nodejs.org/ (download v20 or v22)"
            exit 1
        fi
    else
        # Check version compatibility
        MAJOR_VERSION=$(echo $CURRENT_NODE | cut -d. -f1 | sed 's/v//')

        if [ "$MAJOR_VERSION" -lt 20 ]; then
            print_warning "Node $CURRENT_NODE is too old (requires 20+)"

            if [ "$NVM_AVAILABLE" = true ]; then
                print_warning "Upgrading to Node 22..."
                nvm install 22
                nvm use 22
                print_success "Node 22 installed and activated"
            else
                print_error "Please upgrade Node to version 20 or later"
                echo "See: https://nodejs.org/"
                exit 1
            fi
        else
            print_success "Node $CURRENT_NODE (compatible)"

            # Try to use Node 22 if available via nvm (non-fatal if it fails)
            if [ "$NVM_AVAILABLE" = true ]; then
                nvm use 22 2>/dev/null || true
            fi
        fi
    fi
}

# Check and build frontend if needed
setup_frontend() {
    print_header "Setting up Frontend"

    # Check if frontend/dist exists
    if [ ! -d "frontend/dist" ]; then
        print_warning "frontend/dist not found - frontend build required"

        # Check if node_modules exists
        if [ ! -d "frontend/node_modules" ]; then
            print_warning "Installing npm dependencies..."
            cd frontend
            npm install --legacy-peer-deps 2>&1 | tail -5
            cd ..
        fi

        # Build frontend
        print_warning "Building frontend (this may take 1-2 minutes)..."
        cd frontend
        npm run build 2>&1 | tail -10
        cd ..
        print_success "Frontend build complete"
    else
        print_success "Frontend already built"
    fi
}

# Check environment configuration
check_environment() {
    print_header "Checking Environment Configuration"

    if [ ! -f ".env" ]; then
        print_warning ".env file not found"

        if [ -f ".sample.env" ]; then
            echo "Creating .env from .sample.env..."
            cp .sample.env .env
            print_warning "✓ .env created - please edit with your broker credentials"
            echo ""
            echo "Required configurations:"
            echo "  - APP_KEY: Generate with: uv run python -c \"import secrets; print(secrets.token_hex(32))\""
            echo "  - API_KEY_PEPPER: Generate with: uv run python -c \"import secrets; print(secrets.token_hex(32))\""
            echo "  - BROKER_API_KEY: Your broker API key"
            echo "  - BROKER_API_SECRET: Your broker API secret"
            echo "  - VALID_BROKERS: Comma-separated list of enabled brokers"
            echo ""
            exit 0
        else
            print_error "No .sample.env found"
            exit 1
        fi
    fi
    print_success ".env file exists"
}

# Start the application
start_app() {
    print_header "Starting OpenAlgo"
    echo ""
    echo "Application URL:     http://localhost:5000"
    echo "API Documentation:   http://localhost:5000/api/docs"
    echo "WebSocket Proxy:      ws://localhost:8765"
    echo ""
    echo "Press Ctrl+C to stop"
    echo ""

    uv run app.py
}

# Main execution
main() {
    # Get script directory and change to it
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR"

    # Run setup checks
    check_requirements
    setup_node_version
    setup_frontend
    check_environment

    # Start application
    start_app
}

# Run main function
main "$@"
