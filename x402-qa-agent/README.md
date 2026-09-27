# Luma x402 QA Agent

Agent-native website QA sold per request through x402.

## Products

- **POST /api/quick-audit** — $0.25 USDC — one public page.
- **POST /api/site-audit** — $2.50 USDC — up to 8 same-origin public pages.

The service detects production-content residue, placeholder/template copy, conversion friction, broken/dummy links, basic SEO/trust defects, and returns prioritized fixes.

## Required environment variables

```
PAY_TO_ADDRESS=0x...           # public EVM receiving address; never a private key
PUBLIC_ORIGIN=https://...      # deployed HTTPS origin
X402_NETWORK=eip155:8453       # Base by default
X402_FACILITATOR=https://x402.org/facilitator
```

## Run

```bash
npm install
npm start
```

## Discovery

- `GET /.well-known/x402`
- `GET /skill.md`
- `GET /health`

The middleware includes the official x402 Bazaar discovery extension. After deployment, the origin can also be registered for free with x402 directories such as agent402.tools.

## Safety

Only public HTTP(S) targets are accepted. The service resolves DNS and blocks private/reserved IP ranges to reduce SSRF risk. No wallet private key is required on the seller server; only the public receiving address is configured.
