import express from "express";
import dns from "node:dns/promises";
import net from "node:net";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";

const app = express();
app.use(express.json({ limit: "32kb" }));

const PORT = Number(process.env.PORT || 3000);
const PAY_TO = process.env.PAY_TO_ADDRESS;
const NETWORK = process.env.X402_NETWORK || "eip155:8453";
const ORIGIN = (process.env.PUBLIC_ORIGIN || "").replace(/\/$/, "");
const FACILITATOR_URL = process.env.X402_FACILITATOR || "https://x402.org/facilitator";

if (!PAY_TO || !/^0x[a-fA-F0-9]{40}$/.test(PAY_TO)) {
  throw new Error("PAY_TO_ADDRESS must be a valid EVM receiving address.");
}

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const x402Server = new x402ResourceServer(facilitatorClient);
x402Server.register("eip155:*", new ExactEvmScheme());

const quickInput = {
  type: "object",
  properties: {
    url: { type: "string", description: "Public http(s) page URL to audit." }
  },
  required: ["url"]
};

const siteInput = {
  type: "object",
  properties: {
    url: { type: "string", description: "Public http(s) site URL to audit." },
    max_pages: { type: "integer", minimum: 1, maximum: 8, description: "Maximum same-origin pages to inspect. Defaults to 6." }
  },
  required: ["url"]
};

const routes = {
  "POST /api/quick-audit": {
    accepts: {
      scheme: "exact",
      price: "$0.25",
      network: NETWORK,
      payTo: PAY_TO
    },
    description: "Audit one public webpage for placeholder content, conversion friction, SEO/trust leaks and release residue.",
    mimeType: "application/json",
    serviceName: "Luma Revenue QA",
    tags: ["website-qa","conversion","content","audit"],
    extensions: {
      ...declareDiscoveryExtension({
        input: { url: "https://example.com" },
        inputSchema: quickInput,
        output: {
          example: { score: 86, findings: [{ severity: "high", issue: "Placeholder copy detected" }] },
          schema: {
            type: "object",
            properties: {
              target: { type: "string" },
              score: { type: "number" },
              findings: { type: "array" }
            }
          }
        }
      })
    }
  },
  "POST /api/site-audit": {
    accepts: {
      scheme: "exact",
      price: "$2.50",
      network: NETWORK,
      payTo: PAY_TO
    },
    description: "Crawl up to 8 same-origin public pages and return a prioritized production-content and conversion QA report.",
    mimeType: "application/json",
    serviceName: "Luma Revenue QA",
    tags: ["website-qa","crawl","conversion","release"],
    extensions: {
      ...declareDiscoveryExtension({
        input: { url: "https://example.com", max_pages: 6 },
        inputSchema: siteInput,
        output: {
          example: { pages_scanned: 6, critical_or_high: 3, findings: [] },
          schema: {
            type: "object",
            properties: {
              target: { type: "string" },
              pages_scanned: { type: "integer" },
              critical_or_high: { type: "integer" },
              findings: { type: "array" }
            }
          }
        }
      })
    }
  }
};

app.use(paymentMiddleware(routes, x402Server));

const PLACEHOLDERS = [
  ["lorem ipsum", "Lorem Ipsum / filler copy"],
  ["this is some text inside of a div block", "Default Webflow placeholder copy"],
  ["coming soon", "Coming-soon placeholder"],
  ["placeholder", "Placeholder text"],
  ["dummy text", "Dummy text"],
  ["your company here", "Template company placeholder"],
  ["[[first-name]]", "Unresolved personalization token"],
  ["[[firstname]]", "Unresolved personalization token"],
  ["{{first_name}}", "Unresolved template token"],
  ["[name of asset here]", "Unresolved asset placeholder"]
];

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isPrivateIp(ip) {
  if (net.isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    return p[0] === 10 ||
      p[0] === 127 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      p[0] === 0;
  }
  if (net.isIP(ip) === 6) {
    const x = ip.toLowerCase();
    return x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80:");
  }
  return true;
}

async function validatePublicUrl(raw) {
  const u = new URL(raw);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http(s) URLs are allowed.");
  if (["localhost","metadata.google.internal"].includes(u.hostname.toLowerCase())) throw new Error("Private hosts are blocked.");
  const records = await dns.lookup(u.hostname, { all: true });
  if (!records.length || records.some(r => isPrivateIp(r.address))) throw new Error("Private/reserved network targets are blocked.");
  return u;
}

async function fetchHtml(raw) {
  const u = await validatePublicUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(u, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "LumaRevenueQA/1.0 (+agentic website QA)",
        "accept": "text/html,application/xhtml+xml"
      }
    });
    const type = r.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) {
      throw new Error("Target did not return HTML.");
    }
    const html = (await r.text()).slice(0, 2_000_000);
    return { url: r.url, status: r.status, html };
  } finally {
    clearTimeout(timer);
  }
}

function analyzePage(page) {
  const { url, status, html } = page;
  const text = stripTags(html);
  const lower = text.toLowerCase();
  const findings = [];
  const add = (score, type, issue, evidence, fix) => findings.push({
    severity: score >= 8 ? "critical" : score >= 5 ? "high" : score >= 3 ? "medium" : "low",
    score, type, issue, evidence, fix, url
  });

  for (const [needle, label] of PLACEHOLDERS) {
    if (lower.includes(needle.toLowerCase())) add(8, "trust", label, needle, "Replace or suppress the unresolved/default content at component or CMS-field level.");
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g," ").trim() || "";
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim()
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1]?.trim()
    || "";
  const h1 = (html.match(/<h1\b/gi) || []).length;
  const emptyLinks = (html.match(/href=["'](?:#|javascript:void\(0\)|)["']/gi) || []).length;
  const httpRefs = (html.match(/(?:href|src)=["']http:\/\//gi) || []).length;
  const forms = (html.match(/<form\b/gi) || []).length;

  if (status >= 400) add(9, "availability", \`HTTP \${status}\`, String(status), "Repair or remove the broken destination.");
  if (!title) add(5, "seo", "Missing page title", "", "Add a concise title tied to the page intent.");
  if (!desc) add(3, "seo", "Missing meta description", "", "Add a benefit-led search/social description.");
  if (h1 === 0) add(4, "structure", "No H1 detected", "", "Add one clear primary page heading.");
  if (h1 > 1) add(2, "structure", \`\${h1} H1 elements detected\`, String(h1), "Review heading hierarchy.");
  if (emptyLinks) add(5, "conversion", \`\${emptyLinks} dummy/empty links detected\`, String(emptyLinks), "Wire each CTA to a real destination or remove it.");
  if (httpRefs) add(6, "security", \`\${httpRefs} insecure HTTP references\`, String(httpRefs), "Upgrade references to HTTPS.");
  if (!/name=["']viewport["']/i.test(html)) add(6, "mobile", "Missing viewport meta tag", "", "Add a responsive viewport meta tag.");
  if (forms && !/autocomplete=/i.test(html)) add(2, "conversion", "Form detected without autocomplete attributes", String(forms), "Add appropriate autocomplete values.");
  if (!/property=["']og:title["']/i.test(html)) add(2, "social", "Missing Open Graph title", "", "Add Open Graph metadata.");

  findings.sort((a,b) => b.score - a.score);
  const risk = findings.reduce((n,f) => n + f.score, 0);
  return {
    url, status, score: Math.max(0, 100 - Math.min(100, risk * 3)),
    title, findings: findings.slice(0, 20)
  };
}

function extractInternalLinks(baseUrl, html) {
  const origin = new URL(baseUrl).origin;
  const out = new Set();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], baseUrl);
      if (u.origin !== origin || !["http:","https:"].includes(u.protocol)) continue;
      u.hash = "";
      const s = u.toString();
      if (!/\.(png|jpg|jpeg|gif|webp|svg|pdf|zip|xml|json|css|js)(\?|$)/i.test(s)) out.add(s);
    } catch {}
  }
  return [...out];
}

app.get("/health", (_, res) => res.json({ ok: true, service: "Luma Revenue QA", x402: true }));

app.get("/.well-known/x402", (_, res) => {
  const base = ORIGIN || \`http://localhost:\${PORT}\`;
  res.json({
    x402Version: 2,
    name: "Luma Revenue QA",
    description: "Agent-native website production-content and conversion QA.",
    payTo: PAY_TO,
    network: NETWORK,
    resources: [
      { resource: \`\${base}/api/quick-audit\`, method: "POST", price: "$0.25", description: routes["POST /api/quick-audit"].description },
      { resource: \`\${base}/api/site-audit\`, method: "POST", price: "$2.50", description: routes["POST /api/site-audit"].description }
    ]
  });
});

app.get("/skill.md", (_, res) => {
  const base = ORIGIN || \`http://localhost:\${PORT}\`;
  res.type("text/markdown").send(\`# Luma Revenue QA

Agent-native production-content and conversion QA paid via x402.

## Paid tools
- POST \${base}/api/quick-audit — $0.25 USDC — body: {"url":"https://example.com"}
- POST \${base}/api/site-audit — $2.50 USDC — body: {"url":"https://example.com","max_pages":6}

The service inspects only public web pages. Private/reserved network targets are blocked.
\`);
});

app.post("/api/quick-audit", async (req, res) => {
  try {
    if (!req.body?.url) return res.status(400).json({ error: "url_required" });
    const page = await fetchHtml(req.body.url);
    const result = analyzePage(page);
    res.json({
      product: "Luma Revenue QA — Quick Audit",
      target: result.url,
      score: result.score,
      finding_count: result.findings.length,
      critical_or_high: result.findings.filter(f => ["critical","high"].includes(f.severity)).length,
      findings: result.findings
    });
  } catch (e) {
    res.status(400).json({ error: "audit_failed", detail: String(e?.message || e) });
  }
});

app.post("/api/site-audit", async (req, res) => {
  try {
    if (!req.body?.url) return res.status(400).json({ error: "url_required" });
    const maxPages = Math.max(1, Math.min(8, Number(req.body.max_pages || 6)));
    const first = await fetchHtml(req.body.url);
    const queue = [first.url, ...extractInternalLinks(first.url, first.html)].slice(0, maxPages * 3);
    const seen = new Set();
    const reports = [];

    for (const raw of queue) {
      if (reports.length >= maxPages || seen.has(raw)) continue;
      seen.add(raw);
      try {
        const p = raw === first.url ? first : await fetchHtml(raw);
        reports.push(analyzePage(p));
      } catch {}
    }

    const findings = reports.flatMap(r => r.findings).sort((a,b) => b.score - a.score);
    res.json({
      product: "Luma Revenue QA — Site Audit",
      target: first.url,
      pages_scanned: reports.length,
      average_score: reports.length ? Math.round(reports.reduce((s,r)=>s+r.score,0)/reports.length) : 0,
      critical_or_high: findings.filter(f => ["critical","high"].includes(f.severity)).length,
      findings: findings.slice(0, 50),
      pages: reports.map(r => ({ url: r.url, status: r.status, score: r.score, finding_count: r.findings.length }))
    });
  } catch (e) {
    res.status(400).json({ error: "audit_failed", detail: String(e?.message || e) });
  }
});

app.listen(PORT, () => console.log(\`Luma x402 QA listening on :\${PORT} via \${NETWORK}\`));