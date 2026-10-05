#!/usr/bin/env bash
# Build the folder GitHub Pages publishes: just the pages and their icons, not the source or the helper.
# When SITE_PASSWORD is set (a GitHub secret), the pages are locked with StatiCrypt using lock/template.html.
#   lock/publish.sh [out-dir]          default: _site
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-_site}"
rm -rf "$out"; mkdir -p "$out"
cp index.html display.html manifest.webmanifest display.webmanifest icon-180.png icon-192.png icon-512.png "$out/"
touch "$out/.nojekyll"
if [ -n "${SITE_PASSWORD:-}" ]; then
  # One fixed salt keeps "Remember this screen" working across pages and across deploys. A salt isn't secret:
  # StatiCrypt writes it into every page.
  STATICRYPT_PASSWORD="$SITE_PASSWORD" npx --yes staticrypt@3.5.4 "$out/index.html" "$out/display.html" \
    --directory "$out" --salt 921212f355e6f70b7bf75a95b5bae2aa --remember 365 --short --config false \
    --template lock/template.html --template-title "Locked" \
    --template-instructions "Enter the household PIN to open the dashboard and display." \
    --template-placeholder "PIN" --template-button "Unlock" --template-remember "Remember this screen" \
    --template-error "That PIN didn't work."
  echo "Published pages are locked."
else
  echo "::warning::SITE_PASSWORD isn't set, so the published pages have no lock. Add it under Settings > Secrets and variables > Actions."
fi
