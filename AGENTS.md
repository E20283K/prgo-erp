<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Anti-AI-Slop Design & Engineering Rules

Strictly adhere to the `.agent/skills/anti-slop-ui/SKILL.md` standard on all frontend and UI modifications:
1. **ZERO EMOJIS IN UI**: Never use emojis in buttons, dialog titles, badges, selects, table cells, or placeholders. Use refined Lucide SVG icons (`size-3.5` or `size-4`) or pure text.
2. **NO GRATUITOUS GRADIENTS OR GLOW SHADOWS**: Use flat, clean, neutral borders (`border-border`), `bg-card`, and `bg-muted` tokens. Follow Linear/Stripe/1C Enterprise industrial standards.
3. **HIGH DENSITY & COMPACT SPACING**: Form inputs `h-7` or `h-8` (`text-xs`), table rows `26-28px`, tight padding. No bloated cards or low-density mobile layouts.
4. **NO PROSE CHATTER**: Clean, direct labels and tooltips. No conversational assistant fluff.

