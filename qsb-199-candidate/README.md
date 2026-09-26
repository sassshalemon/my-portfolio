# QSB 199 USDC candidate — PR1809 EC-v2 + multi-buffer SHA

Status: **source package ready; not yet Yukon-benchmarked**.

## Goal
Target the funded TaskMarket Quantum-Safe Bitcoin bounty by combining two public, independently measured pinning improvements that have not been found together in a public submission:

- **Base / EC + scheduling:** Layr-Labs QSB PR #1809, head `6b3aaf610dbafc2d1269eb7becd62b18303f5858` (Meganpark980320). It improves the host co-grinder's EC/scheduling, but its SHA front-end remains scalar OpenSSL `SHA256_Transform` per candidate.
- **SHA donor:** PR #1731, head `3f646fdbd3d431d920edbcfe37fe5c63d620e25b` (ercumentyildirim). It contains runtime-selected 8-lane AVX2 and 2-way SHA-NI SHA-256 front-ends.

This package adapts only that SHA layer to #1809's candidate-major `z[candidate][limb]` layout. The GPU source is untouched.

## What is new in this composition
1. `cg_sha.h` is imported with attribution from #1731.
2. #1809's `fill_batch` can run SHA-NI x2, AVX2 x8, or the exact scalar OpenSSL fallback.
3. Worker 0 times real, counted batches and selects SHA and EC paths independently.
4. Non-`cache_first` layouts and tail lanes stay on the original scalar path.
5. #1809's disjoint sequence partition, EC code, core pinning, starvation controller, exact OpenSSL hit gate and GPU code remain intact.

## Required validation before submission
```bash
# Overlay these two files onto an exact checkout of PR #1809 head:
cp cpu_cogrind.h <qsb>/candidates/pinning/cpu_cogrind.h
cp cg_sha.h      <qsb>/candidates/pinning/cg_sha.h

cd <qsb>
yukon setup --track pinning
yukon run --track pinning

# First compare exactness with forced SHA modes if remote shell permits:
QSB_CPU_GRIND_SHA=ref ...
QSB_CPU_GRIND_SHA=sha-ni ...
QSB_CPU_GRIND_SHA=avx2 ...
```

Do **not** claim a speedup until Yukon measures this exact source.

## Funded task
TaskMarket escrow: 199 USDC (Base), QSB record-improvement task. Only accepted + promoted Yukon improvements earn points.
