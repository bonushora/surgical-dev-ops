#!/bin/sh
set -eu

SCRIPT_DIRECTORY=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

/usr/bin/clang \
  -std=c11 \
  -O2 \
  -Wall \
  -Wextra \
  -Werror \
  "$SCRIPT_DIRECTORY/sdo-seatbelt-probe.c" \
  -o "$SCRIPT_DIRECTORY/sdo-seatbelt-probe"
