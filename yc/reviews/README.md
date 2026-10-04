# Expert reviews

Four independent reviewers score the package each round on the same rubric: 0 to 10, where 9 means a YC partner would fight for it at the decision meeting. Founder-identity fields are excluded from the score; everything the package controls is in it, including the product as actually built. The loop continues until the four scores average 9 or more.

| Round | YC partner | Devtools investor | IT buyer / GTM | Security engineer | Average |
| --- | --- | --- | --- | --- | --- |
| 1 | 6.2 | 6.0 | 6.2 | 6.8 | **6.3** |

## Round 1: what they agreed on

- **The market moved.** Between June and September 2026, OpenAI (Codex Sites), Anthropic (Artifacts with storage and connectors), Retool (CLI), Netlify, Vercel, Cloudflare, VibeHost and display.dev all shipped private hosting for agent-built apps. The round-1 competition section was out of date and "nobody else is building that" was false.
- **Two security claims were false.** A tool could send data out by navigating or opening a popup, and any viewer could rewrite any record, so the flagship approvals demo could be forged.
- **Two denial-of-service vectors.** A quadratic regex in the secret scanner, and a body-size check that trusted the client's header.
- **No users, a broad wedge, weak sizing and pricing.** "AI-forward startups" is the most contested segment; "10% of Anthropic's customers" is top-down; per-builder pricing with an SSO tier repeated the "SSO tax" the memo criticised.

Full reviews: [round-1/](round-1/).
