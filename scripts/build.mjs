import { mkdir, readdir, readFile, writeFile, copyFile, stat, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as parse5 from "parse5";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");
const pagesDir = path.join(srcDir, "pages");
const distDir = path.join(root, "dist");
const siteOrigin = "https://ignyteyoga.com";

const imageCache = new Map();

function attr(node, name) {
  if (!node?.attrs) return "";
  return node.attrs.find((item) => item.name === name)?.value ?? "";
}

function setAttr(node, name, value) {
  if (!node.attrs) node.attrs = [];
  const found = node.attrs.find((item) => item.name === name);
  if (found) found.value = value;
  else node.attrs.push({ name, value });
}

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
}

function findAll(node, tag) {
  const found = [];
  walk(node, (current) => {
    if (current.tagName === tag) found.push(current);
  });
  return found;
}

function findOne(node, tag) {
  return findAll(node, tag)[0] ?? null;
}

async function walkPages(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkPages(full)));
    else if (entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

function stemOf(filePath) {
  const base = path.basename(filePath).replace(/\.[^.]+$/, "");
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function emitImage(sourceUrl) {
  if (imageCache.has(sourceUrl)) return imageCache.get(sourceUrl);
  const relative = sourceUrl.replace(/^\//, "");
  const absolute = path.join(root, relative);
  const info = await stat(absolute);
  if (!info.isFile()) throw new Error(`Missing image ${sourceUrl}`);

  const meta = await sharp(absolute).metadata();
  const stem = stemOf(absolute);
  const originalWidth = meta.width || 1200;
  const widths = [480, 800, 1280, 1920].filter((width) => width < originalWidth - 8);
  if (!widths.includes(Math.min(originalWidth, 1920))) {
    widths.push(Math.min(originalWidth, 2400));
  }
  const unique = [...new Set(widths)].sort((a, b) => a - b);
  const variants = [];

  for (const width of unique) {
    const filename = `${stem}-${width}.webp`;
    const output = path.join(distDir, "media", filename);
    try {
      await access(output);
    } catch {
      await sharp(absolute)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 76 })
        .toFile(output);
    }
    variants.push({ width, url: `/media/${filename}` });
  }

  const result = {
    variants,
    width: meta.width || unique.at(-1),
    height: meta.height || unique.at(-1),
    largest: variants.at(-1).url,
  };
  imageCache.set(sourceUrl, result);
  return result;
}

function srcset(variants) {
  return variants.map((item) => `${item.url} ${item.width}w`).join(", ");
}

async function rewriteImages(node) {
  const images = findAll(node, "img");
  for (const image of images) {
    const source = attr(image, "src");
    if (!source.startsWith("/assets/source/images/")) continue;
    const emitted = await emitImage(source);
    setAttr(image, "src", emitted.largest);
    setAttr(image, "srcset", srcset(emitted.variants));
    if (!attr(image, "sizes")) setAttr(image, "sizes", "(min-width: 900px) 80vw, 100vw");
    if (!attr(image, "width")) setAttr(image, "width", String(emitted.width));
    if (!attr(image, "height")) setAttr(image, "height", String(emitted.height));
  }

  const backgrounds = [];
  walk(node, (current) => {
    if (attr(current, "data-bg")) backgrounds.push(current);
  });
  for (const element of backgrounds) {
    const source = attr(element, "data-bg");
    const emitted = await emitImage(source);
    const previous = attr(element, "style");
    const background = `background-image:url('${emitted.largest}')`;
    setAttr(element, "style", previous ? `${previous};${background}` : background);
    element.attrs = element.attrs.filter((item) => item.name !== "data-bg");
  }
}

function textOf(node) {
  if (!node) return "";
  if (node.nodeName === "#text") return node.value;
  return (node.childNodes ?? []).map(textOf).join("");
}

function outputPath(canonical, distFile) {
  if (distFile) return path.join(distDir, distFile);
  const url = new URL(canonical);
  if (url.pathname === "/") return path.join(distDir, "index.html");
  const clean = url.pathname.replace(/^\//, "").replace(/\/$/, "");
  return path.join(distDir, clean, "index.html");
}

function headElement(tag, attrs) {
  return { nodeName: tag, tagName: tag, attrs: Object.entries(attrs).map(([name, value]) => ({ name, value })), childNodes: [], namespaceURI: "http://www.w3.org/1999/xhtml" };
}

function localBusinessScript(canonical) {
  const data = {
    "@context": "https://schema.org",
    "@type": ["ExerciseGym", "LocalBusiness"],
    name: "Ignyte Yoga",
    url: canonical,
    telephone: "+1-469-536-2540",
    email: "hello@ignyteyoga.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "12021 Dallas Parkway, Suite 300",
      addressLocality: "Frisco",
      addressRegion: "TX",
      postalCode: "75033",
      addressCountry: "US",
    },
  };
  return {
    nodeName: "script",
    tagName: "script",
    attrs: [{ name: "type", value: "application/ld+json" }],
    childNodes: [{ nodeName: "#text", value: JSON.stringify(data) }],
    namespaceURI: "http://www.w3.org/1999/xhtml",
  };
}

async function buildPage(file, headerHtml, footerHtml) {
  const html = await readFile(file, "utf8");
  const document = parse5.parse(html);
  const head = findOne(document, "head");
  const body = findOne(document, "body");
  const main = findOne(document, "main");
  if (!head || !body || !main) throw new Error(`Page ${file} needs head, body, and main`);

  const title = textOf(findOne(document, "title")).trim();
  const description = attr(
    findAll(document, "meta").find((meta) => attr(meta, "name") === "description"),
    "content",
  ).trim();
  const canonical = attr(
    findAll(document, "link").find((link) => attr(link, "rel") === "canonical"),
    "href",
  ).trim();
  const robots = attr(
    findAll(document, "meta").find((meta) => attr(meta, "name") === "robots"),
    "content",
  ).trim() || "index,follow";
  const distFile = attr(
    findAll(document, "meta").find((meta) => attr(meta, "name") === "dist-file"),
    "content",
  ).trim();
  const jsonLd = findAll(document, "script").filter((script) => attr(script, "type") === "application/ld+json");

  if (!title || !description || !canonical) {
    throw new Error(`Missing title, description, or canonical in ${file}`);
  }

  await rewriteImages(main);
  const header = parse5.parseFragment(headerHtml);
  const footer = parse5.parseFragment(footerHtml);
  await rewriteImages(header);
  await rewriteImages(footer);

  body.childNodes = [...(header.childNodes ?? []), main, ...(footer.childNodes ?? [])];
  setAttr(main, "id", attr(main, "id") || "content");

  const logo = findAll(header, "img")[0];
  const logoSrc = attr(logo, "src");
  const shareImage = logoSrc ? new URL(logoSrc, siteOrigin).href : "";
  const hasLocalBusiness = jsonLd.some((script) => textOf(script).includes("LocalBusiness"));
  const structuredData = hasLocalBusiness ? jsonLd : [localBusinessScript(canonical), ...jsonLd];

  const headNodes = [
    headElement("meta", { charset: "utf-8" }),
    headElement("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
    { nodeName: "title", tagName: "title", attrs: [], childNodes: [{ nodeName: "#text", value: title }] },
    headElement("meta", { name: "description", content: description }),
    headElement("link", { rel: "canonical", href: canonical }),
    headElement("meta", { name: "robots", content: robots }),
    headElement("meta", { property: "og:title", content: title }),
    headElement("meta", { property: "og:description", content: description }),
    headElement("meta", { property: "og:url", content: canonical }),
    headElement("meta", { property: "og:type", content: "website" }),
    headElement("meta", { property: "og:site_name", content: "Ignyte Yoga" }),
    ...(shareImage ? [headElement("meta", { property: "og:image", content: shareImage })] : []),
    headElement("link", { rel: "icon", href: "/favicon.ico" }),
    headElement("link", { rel: "stylesheet", href: "/styles/site.css" }),
    ...structuredData,
  ];
  head.childNodes = headNodes;
  setAttr(body, "data-page", path.relative(pagesDir, file));

  const destination = outputPath(canonical, distFile);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `<!DOCTYPE html>\n${parse5.serialize(document)}\n`);
  return { file, destination, title, description, canonical, robots };
}

function sitemapXml(pages) {
  const urls = pages
    .filter((page) => !page.robots.includes("noindex"))
    .map((page) => `  <url><loc>${page.canonical}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function robotsTxt() {
  const agents = [
    "*",
    "Googlebot",
    "Bingbot",
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "Google-Extended",
    "ClaudeBot",
    "anthropic-ai",
    "PerplexityBot",
    "Amazonbot",
    "CCBot",
    "Applebot-Extended",
  ];
  return `${agents.map((agent) => `User-agent: ${agent}\nAllow: /\n`).join("\n")}\nSitemap: ${siteOrigin}/sitemap.xml\n`;
}

async function main() {
  await mkdir(path.join(distDir, "media"), { recursive: true });
  await mkdir(path.join(distDir, "styles"), { recursive: true });
  await mkdir(path.join(distDir, "fonts"), { recursive: true });
  await mkdir(path.join(distDir, "scripts"), { recursive: true });

  const header = await readFile(path.join(srcDir, "partials/header.html"), "utf8");
  const footer = await readFile(path.join(srcDir, "partials/footer.html"), "utf8");
  const pages = [];
  for (const file of await walkPages(pagesDir)) {
    pages.push(await buildPage(file, header, footer));
    console.log(`built ${path.relative(root, file)}`);
  }

  await copyFile(path.join(srcDir, "styles/site.css"), path.join(distDir, "styles/site.css"));
  await copyFile(path.join(srcDir, "scripts/nav.js"), path.join(distDir, "scripts/nav.js"));
  for (const font of await readdir(path.join(srcDir, "fonts"))) {
    await copyFile(path.join(srcDir, "fonts", font), path.join(distDir, "fonts", font));
  }
  await copyFile(path.join(root, "assets/source/images/favicon.ico"), path.join(distDir, "favicon.ico"));

  const scriptTag = `<script src="/scripts/nav.js" defer></script>`;
  for (const page of pages) {
    const html = await readFile(page.destination, "utf8");
    if (!html.includes("/scripts/nav.js")) {
      await writeFile(page.destination, html.replace("</body>", `  ${scriptTag}\n</body>`));
    }
  }

  await writeFile(path.join(distDir, "sitemap.xml"), sitemapXml(pages));
  await writeFile(path.join(distDir, "robots.txt"), robotsTxt());
  console.log(`pages ${pages.length}, images ${imageCache.size}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
