# Ignyte Yoga website

Preview of a static recreation of [ignyteyoga.com](https://www.ignyteyoga.com/). This is not a production launch. Do not merge it, deploy it over the live site, or change DNS. Connect a Netlify site to this repo when you want a preview URL. Netlify Forms for the newsletter and teacher-training signup only work after that connection.

## Build

Node 24 and pnpm.

```bash
pnpm install
pnpm build
pnpm test
```

`pnpm build` reads plain HTML in `src/pages/`, inserts the shared header and footer, and writes `dist/`. Images are resized to responsive WebP with sharp. HTML is parsed with parse5. `pnpm seo` checks one H1 per page, unique titles and descriptions, the sitemap, and robots.txt.

The schedule pages embed the studio’s existing Mindbody Healcode widget (`ce1600307310`). There is no Acuity booking.

## Source archive

- `assets/source/images/` — Squarespace CDN originals (`format=original`)
- `assets/source/html/` — raw page HTML
- `assets/source/inventory.md` — each file, its source URL, and which page it came from
- `content/` — readable copy per page
- `notes/later-improvements.md` — pages and cleanup held for a later PR
