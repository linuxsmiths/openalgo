#!/bin/bash

# Merge Upstream Script
# Merges changes from parent repo into your fork, automatically handling frontend/dist conflicts

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check if upstream remote exists
check_upstream() {
    print_header "Checking Upstream Remote"

    if ! git remote | grep -q "^upstream$"; then
        print_error "Upstream remote not configured"
        echo ""
        echo "Add it with:"
        echo "  git remote add upstream https://github.com/marketcalls/openalgo.git"
        exit 1
    fi
    print_success "Upstream remote found"
}

# Fetch latest from upstream
fetch_upstream() {
    print_header "Fetching from Upstream"

    if git fetch upstream; then
        print_success "Fetched upstream/main"
    else
        print_error "Failed to fetch from upstream"
        exit 1
    fi
}

# Attempt merge
attempt_merge() {
    print_header "Merging upstream/main"

    # Try merge, capture exit code
    if git merge upstream/main 2>&1; then
        print_success "Merge completed successfully"
        return 0
    else
        # Merge failed, check for frontend/dist conflicts
        echo ""
        print_warning "Merge conflicts detected"
        return 1
    fi
}

# Handle frontend/dist conflicts
resolve_dist_conflicts() {
    print_header "Resolving frontend/dist Conflicts"

    # Check if there are dist conflicts
    if git status | grep -q "frontend/dist"; then
        print_warning "Found frontend/dist conflicts"
        echo "Removing conflicted dist files..."

        # Remove the conflicted directory
        rm -rf frontend/dist/

        # Stage the deletion
        git add -A

        print_success "Removed frontend/dist from merge"
    fi
}

# Complete merge
complete_merge() {
    print_header "Completing Merge"

    if git commit -m "Merge upstream/main (resolving frontend/dist conflicts by keeping ignored)"; then
        print_success "Merge committed"
        return 0
    else
        print_error "Failed to commit merge"
        return 1
    fi
}

# Push changes
push_changes() {
    print_header "Pushing to Origin"

    if git push origin main; then
        print_success "Pushed to origin/main"
        return 0
    else
        print_error "Failed to push to origin"
        return 1
    fi
}

# Ask user for confirmation
ask_push() {
    echo ""
    echo -n "Push changes to origin/main? (y/n): "
    read -r response

    if [[ "$response" =~ ^[Yy]$ ]]; then
        return 0
    else
        print_warning "Push cancelled"
        echo "To push later, run: git push origin main"
        return 1
    fi
}

# Main execution
main() {
    print_header "Merge Upstream into Fork"

    # Get script directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR"

    # Run checks
    check_upstream
    fetch_upstream

    # Try merge
    if attempt_merge; then
        # No conflicts, just push
        echo ""
        if ask_push; then
            push_changes
        fi

        print_header "Merge Complete ✓"
        echo "Your fork is now up-to-date with upstream!"
        exit 0
    fi

    # Handle conflicts
    resolve_dist_conflicts

    # Complete merge
    if complete_merge; then
        echo ""
        if ask_push; then
            push_changes
        fi

        print_header "Merge Complete ✓"
        echo "Upstream changes merged and conflicts resolved!"
        exit 0
    else
        print_error "Merge completion failed"
        echo "Manual intervention may be needed:"
        echo "  git status              # Check status"
        echo "  git merge --abort       # Abort merge if needed"
        exit 1
    fi
}

# Run main
main "$@"
