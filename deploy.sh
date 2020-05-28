#!/usr/bin/env bash

set -ue

tmp_dir=_deploy_temp

git clone --branch master . "$tmp_dir"
pushd "$tmp_dir"

git config user.name "$(git --git-dir "../.git" config user.name)"
git config user.email "$(git --git-dir "../.git" config user.email)"
git checkout -B gh-pages

npm run build
ls -A | grep -v '^\(dist\|\.git\)$' | while read name; do
	rm -rf "$name"
done

find dist -depth 1 -exec mv '{}' . ';'
rmdir dist

git add .
git commit -m "Auto-build"
git remote set-url origin git@github.com:sharat87/timezoner.git
git push --set-upstream --force origin gh-pages

popd

rm -rf "$tmp_dir"
