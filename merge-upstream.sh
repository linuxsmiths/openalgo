#!/bin/bash

# Merge Upstream Script
# Merges changes from parent repo into your fork, ignoring frontend/dist changes

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

# Reset frontend/dist back to the current branch state
resolve_frontend_dist_conflicts() {
    if ! git ls-files -- frontend/dist | grep -q . && ! git ls-files -u -- frontend/dist | grep -q .; then
        print_success "No frontend/dist paths to drop"
        return 0
    fi

    print_warning "Resetting frontend/dist to the current branch state"
    git reset HEAD -- frontend/dist >/dev/null 2>&1 || true

    return 0
}

# Check for unresolved conflicts outside frontend/dist
has_remaining_conflicts() {
    local remaining_conflicts
    remaining_conflicts=$(git diff --name-only --diff-filter=U | grep -v '^frontend/dist/' || true)

    if [ -n "$remaining_conflicts" ]; then
        echo "$remaining_conflicts"
        return 0
    fi

    return 1
}

# Attempt merge
attempt_merge() {
    print_header "Merging upstream/main"
    local merge_message="Merge upstream/main (ignoring frontend/dist changes)"

    # Start the merge without committing so we can ignore frontend/dist conflicts
    if git merge upstream/main --no-ff --no-commit 2>&1; then
        print_success "Merge applied cleanly"
    else
        echo ""
        print_warning "Merge conflicts detected"
    fi

    # Always resolve frontend/dist conflicts locally
    resolve_frontend_dist_conflicts

    # If anything outside frontend/dist is still conflicted, stop here
    if has_remaining_conflicts; then
        echo ""
        print_error "There are conflicts outside frontend/dist that need manual resolution"
        echo ""
        echo "Conflicted files:"
        git diff --name-only --diff-filter=U | grep -v '^frontend/dist/' || true
        echo ""
        echo "frontend/dist conflicts were ignored automatically."
        echo "Please resolve the remaining conflicts manually, then run:"
        echo "  git add ."
        echo "  git commit --no-edit"
        echo "  git push origin main"
        return 1
    fi

    # Finalize the merge commit now that only frontend/dist was ignored
    git commit -m "$merge_message"
    print_success "Merge commit created"
    return 0
}

# Rebuild frontend after merge
rebuild_frontend() {
    print_header "Rebuilding Frontend"

    echo "Building React frontend with latest changes..."
    if cd frontend && npm run build && cd ..; then
        print_success "Frontend rebuilt successfully"
        return 0
    else
        print_warning "Frontend build failed - you may need to run 'cd frontend && npm run build' manually"
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
        # Merge successful, rebuild frontend
        print_success "Merge completed successfully"

        echo ""
        echo "Rebuilding frontend with merged changes..."
        rebuild_frontend

        echo ""
        if ask_push; then
            push_changes
        fi

        print_header "Merge Complete ✓"
        echo "Your fork is now up-to-date with upstream!"
        echo ""
        echo "Next steps:"
        echo "  1. Test the application: uv run app.py"
        echo "  2. If frontend/dist was updated, hard refresh browser (Ctrl+Shift+R)"
        exit 0
    fi

    print_error "Merge aborted due to unresolved non-frontend/dist conflicts"
    echo ""
    echo "To abort merge and start over:"
    echo "  git merge --abort"
    exit 1
}

# Run main
main "$@"
