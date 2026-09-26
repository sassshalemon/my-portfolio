#!/bin/sh
set -eu
TARGET="${1:-.}"
BASE="6b3aaf610dbafc2d1269eb7becd62b18303f5858"
echo "Expected upstream PR #1809 head: $BASE"
test -d "$TARGET/candidates/pinning"
cp "$(dirname "$0")/candidates/pinning/cpu_cogrind.h" "$TARGET/candidates/pinning/cpu_cogrind.h"
cp "$(dirname "$0")/candidates/pinning/cg_sha.h" "$TARGET/candidates/pinning/cg_sha.h"
echo "Overlay installed. Run: yukon setup --track pinning && yukon run --track pinning"
