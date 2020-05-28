#!/usr/bin/env bash

set -ue

tmp_dir=_deploy_temp

git clone --branch master . "$tmp_dir"
pushd "$tmp_dir"

git checkout -B gh-pages

npm run build
find . -depth 1 ! -name dist -exec rm -rf '{}' +
find dist -depth 1 -exec mv '{}' . ';'
rmdir dist

git add .
git commit -m "Auto-build"
git remote set-url origin git@github.com:sharat87/timezoner.git
git push --force origin gh-pages

popd

rm -rf "$tmp_dir"
