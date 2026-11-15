#!/bin/sh
# Fetches and builds LFE, pinned to the release the generator is
# built and tested against (v2.1.5 runs on the OTP 25 installed here; the
# development branch needs a newer OTP). Already-built LFE is left alone.
set -eu
cd "$(dirname "$0")"
if [ -f deps/lfe/ebin/lfe.beam ]; then exit 0; fi
rm -rf deps/lfe
mkdir -p deps
git clone --quiet https://github.com/lfe/lfe deps/lfe
git -C deps/lfe checkout --quiet 6616ce0127b564eadf05c2e8ef654668528fc675   # v2.1.5
make -C deps/lfe compile > deps/lfe-build.log 2>&1
