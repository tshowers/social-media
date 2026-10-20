#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# The Firestore emulator (used by `npm run e2e` below) needs a JRE. Homebrew's
# openjdk isn't symlinked onto PATH by default, so pick it up here rather than
# requiring that to be done manually on every machine that runs this script.
if command -v brew >/dev/null 2>&1; then
  JAVA_PREFIX="$(brew --prefix openjdk 2>/dev/null || true)"
  if [ -n "${JAVA_PREFIX}" ] && [ -d "${JAVA_PREFIX}/bin" ]; then
    export PATH="${JAVA_PREFIX}/bin:${PATH}"
  fi
fi

# Cypress (used by `npm run e2e` below) is Electron-based. Some shells set
# ELECTRON_RUN_AS_NODE, which forces every Electron binary - Cypress's
# included - into plain-Node mode instead of launching the real app,
# producing a confusing "bad option: --no-sandbox" failure. Unsetting it
# here is a no-op if it was never set.
unset ELECTRON_RUN_AS_NODE || true

trap 'echo "Deploy aborted - a previous step failed, nothing was committed or deployed." >&2' ERR

echo "Running Social Media production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Step 1/5: Building the production Social Media bundle..."
npm run build

echo "Step 2/5: Running tests (unit + end-to-end)..."
npm run test:ci
npm run e2e

echo "Bumping version..."
npm version patch --no-git-tag-version >/dev/null
VERSION="$(node -p "require('./package.json').version")"
echo "Version is now v${VERSION}"

echo "Step 3/5: Build and tests passed - committing changes..."
git add -A
git commit -m "Deploy: v${VERSION}"

echo "Step 4/5: Deploying Social Media to Firebase Hosting site todd-social-media..."
firebase deploy --project taliferrotech --only hosting:todd-social-media

echo "Social Media hosting deploy complete - version v${VERSION}."

# Only reached when the deploy succeeded (set -e stops on any failure above).
# The site is already live by now, so a failed push warns instead of tripping
# the ERR trap, whose message would wrongly say nothing was deployed.
echo "Step 5/5: Pushing $(git rev-parse --abbrev-ref HEAD) to origin..."
if ! git push origin HEAD; then
  echo "WARNING: deploy succeeded but git push failed - run 'git push' by hand." >&2
fi
