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

# Setup merge attributes to ignore frontend/dist
setup_merge_attributes() {
    print_header "Configuring Merge Strategy"

    # Create temporary .gitattributes if it doesn't exist or append to existing
    if ! grep -q "frontend/dist merge=ours" .gitattributes 2>/dev/null; then
        echo "frontend/dist/** merge=ours" >> .gitattributes
        print_success "Configured to keep local frontend/dist"
    else
        print_success "Merge strategy already configured"
    fi

    # Configure the 'ours' merge driver (keep our version)
    git config merge.ours.driver true
}

# Cleanup merge attributes
cleanup_merge_attributes() {
    # Remove the temporary merge attribute if we added it
    if [ -f .gitattributes ]; then
        sed -i '/frontend\/dist.*merge=ours/d' .gitattributes
        # Remove file if empty
        if [ ! -s .gitattributes ]; then
            rm -f .gitattributes
        fi
    fi
}

# Attempt merge
attempt_merge() {
    print_header "Merging upstream/main"

    # Setup merge strategy to ignore frontend/dist
    setup_merge_attributes

    # Try merge with strategy to keep our frontend/dist
    if git merge upstream/main --no-edit -m "Merge upstream/main (keeping local frontend/dist)" 2>&1; then
        print_success "Merge completed successfully"
        cleanup_merge_attributes
        return 0
    else
        # Merge failed, check for other conflicts
        echo ""
        print_warning "Merge conflicts detected"
        cleanup_merge_attributes
        return 1
    fi
}

# Handle remaining conflicts (non-frontend/dist)
resolve_remaining_conflicts() {
    print_header "Checking for Remaining Conflicts"

    # Check if there are any unresolved conflicts
    if git status | grep -q "Unmerged paths"; then
        print_error "There are conflicts that need manual resolution"
        echo ""
        echo "Conflicted files:"
        git diff --name-only --diff-filter=U
        echo ""
        echo "Please resolve these conflicts manually, then run:"
        echo "  git add ."
        echo "  git commit"
        echo "  git push origin main"
        return 1
    else
        print_success "No remaining conflicts"
        return 0
    fi
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
        print_success "Merge completed without conflicts"

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

    # Handle remaining conflicts (non-frontend/dist)
    if ! resolve_remaining_conflicts; then
        print_error "Manual conflict resolution needed"
        echo ""
        echo "To abort merge and start over:"
        echo "  git merge --abort"
        exit 1
    fi

    # If we get here, conflicts were auto-resolved
    print_success "All conflicts automatically resolved"

    echo ""
    rebuild_frontend

    echo ""
    if ask_push; then
        push_changes
    fi

    print_header "Merge Complete ✓"
    echo "Upstream changes merged successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Test the application: uv run app.py"
    echo "  2. Hard refresh browser (Ctrl+Shift+R)"
    exit 0
}

# Run main
main "$@"
