#!/bin/bash

rm -rf build

npx esbuild src/content-script/index.mjs src/background/index.mjs --bundle --outdir=build

cp src/*.css build/
mkdir build/assets
cp src/assets/*.png build/assets/

MANIFEST_PATH=$([[ $1 == "firefox" ]] && echo "src/manifest.v2.json" || echo "src/manifest.json")
cp $MANIFEST_PATH build/manifest.json
