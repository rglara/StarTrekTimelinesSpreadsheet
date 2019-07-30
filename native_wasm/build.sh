#!/bin/bash
#@echo off

#REM This assumes you installed emsdk at this path: d:\work\emsdk\
#REM See 'https://kripken.github.io/emscripten-site/docs/getting_started/downloads.html'
# and https://webassembly.org/getting-started/developers-guide/
#REM call d:\work\emsdk\emsdk_env.bat

mkdir out

#REM -s NO_FILESYSTEM=1  -s ASSERTIONS=1
#em++ ../native/VoyageCalculator.cpp main.cpp -o out/voymod.js --bind -O2 --closure "1" -std=c++1y \
#    -s DISABLE_EXCEPTION_CATCHING=0 -s NO_EXIT_RUNTIME=1 -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 \
#    -s MODULARIZE=1 -s NO_FILESYSTEM=1 -s EXPORT_NAME="VoyMod" -I "." -I "../native"

em++ ../native/VoyageCalculator.cpp main.cpp -o out/voymod.js --bind -O3 -std=c++1y \
   -s DISABLE_EXCEPTION_CATCHING=0 -s NO_EXIT_RUNTIME=1 -s WASM=1 -s ALLOW_MEMORY_GROWTH=1 \
   -s MODULARIZE=1 -s EXPORT_NAME="VoyMod" -I "." -I "../native"
