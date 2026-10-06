#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

trap 'echo "Deploy aborted - a previous step failed, nothing was deployed." >&2' ERR

echo "Running Social Media production hosting deploy"
echo "Firebase project context: taliferrotech"
firebase use taliferrotech

echo "Building the production Social Media bundle..."
npm run build

echo "Running unit tests..."
npm run test:ci

echo "Bumping version..."
npm version patch --no-git-tag-version >/dev/null
VERSION="$(node -p "require('./package.json').version")"
echo "Version is now v${VERSION}"

echo "Build and tests passed - committing changes before deploy..."
git add -A
git commit -m "Deploy: v${VERSION}"

echo "Deploying Social Media to Firebase Hosting site todd-social-media..."
firebase deploy --project taliferrotech --only hosting:todd-social-media

echo "Social Media hosting deploy complete - version v${VERSION}."
