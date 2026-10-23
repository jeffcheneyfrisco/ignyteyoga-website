import { mkdir, readdir, readFile, writeFile, copyFile, stat, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as parse5 from "parse5";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");
const pagesDir = path.join(srcDir, "pages");
const distDir = path.join(root, "dist");
const siteOrigin = "https://ignyteyoga.com";
const address = "12021 Dallas Pkwy, Suite 300, Frisco, TX 75034";

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

function element(tag, attrs, children = []) {
  return {
    nodeName: tag,
    tagName: tag,
    attrs: Object.entries(attrs)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([name, value]) => ({ name, value: String(value) })),
    childNodes: children,
    namespaceURI: "http://www.w3.org/1999/xhtml",
  };
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

function variantWidths(originalWidth, stem) {
  const wanted = stem === "ignyte-0323-090" ? [480, 800, 960, 1600] : [480, 960, 1600];
  const widths = wanted.filter((width) => width < originalWidth - 8);
  const cap = Math.min(originalWidth, 1600);
  if (!widths.includes(cap)) widths.push(cap);
  return [...new Set(widths)].sort((a, b) => a - b);
}

async function writeWebp(absolute, width, quality, output) {
  await sharp(absolute)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toFile(output);
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
  const widths = variantWidths(originalWidth, stem);
  const variants = [];

  for (const width of widths) {
    const filename = `${stem}-${width}.webp`;
    const output = path.join(distDir, "media", filename);
    let quality = 70;
    if (stem === "ignyte-0323-090" && width === 1600) {
      for (const candidate of [70, 58, 48, 40, 34, 28, 22, 18]) {
        quality = candidate;
        await writeWebp(absolute, width, quality, output);
        const size = (await stat(output)).size;
        if (size <= 210 * 1024) break;
      }
      const size = (await stat(output)).size;
      console.log(`ignyte-0323-090-1600.webp ${size} bytes at quality ${quality}`);
    } else {
      await writeWebp(absolute, width, quality, output);
    }
    variants.push({ width, url: `/media/${filename}` });
  }

  const result = {
    variants,
    width: meta.width || widths.at(-1),
    height: meta.height || widths.at(-1),
    largest: variants.at(-1).url,
    src: (variants.find((item) => item.width >= 960) ?? variants.at(-1)).url,
  };
  imageCache.set(sourceUrl, result);
  return result;
}

function srcset(variants) {
  return variants.map((item) => `${item.url} ${item.width}w`).join(", ");
}

function classList(node) {
  return attr(node, "class").split(/\s+/).filter(Boolean);
}

function ancestorClasses(node) {
  const classes = [];
  let current = node.parentNode;
  while (current) {
    classes.push(...classList(current));
    current = current.parentNode;
  }
  return classes;
}

function sizesFor(image) {
  const preset = attr(image, "sizes");
  if (preset) return preset;
  const classes = ancestorClasses(image);
  if (classes.includes("photo-row")) return "(min-width: 901px) 25vw, 50vw";
  if (classes.includes("gallery") || classes.includes("team-grid")) return "(min-width: 901px) 33vw, 50vw";
  if (classes.includes("cards")) return "(min-width: 901px) 25vw, 100vw";
  if (classes.includes("split") || classes.includes("frame")) return "(min-width: 901px) 50vw, 100vw";
  return "(min-width: 901px) 720px, 100vw";
}

async function rewriteImages(node, { eager = false } = {}) {
  const images = findAll(node, "img");
  for (const image of images) {
    const source = attr(image, "src");
    if (!source.startsWith("/assets/source/images/")) continue;
    const emitted = await emitImage(source);
    setAttr(image, "src", emitted.src);
    setAttr(image, "srcset", srcset(emitted.variants));
    setAttr(image, "sizes", sizesFor(image));
    if (!attr(image, "width")) setAttr(image, "width", String(emitted.width));
    if (!attr(image, "height")) setAttr(image, "height", String(emitted.height));
    if (!attr(image, "decoding")) setAttr(image, "decoding", "async");
    if (!eager && !attr(image, "loading")) {
      setAttr(image, "loading", "lazy");
      if (!attr(image, "fetchpriority")) setAttr(image, "fetchpriority", "low");
    }
  }
}

async function convertBackgrounds(node) {
  const backgrounds = [];
  walk(node, (current) => {
    if (attr(current, "data-bg")) backgrounds.push(current);
  });
  let lcp = null;
  let heroCount = 0;
  for (const background of backgrounds) {
    const emitted = await emitImage(attr(background, "data-bg"));
    const isHero = classList(background).includes("hero");
    if (isHero) heroCount += 1;
    const priority = isHero && heroCount === 1;
    const image = element("img", {
      class: "hero-media",
      src: emitted.src,
      srcset: srcset(emitted.variants),
      sizes: "100vw",
      alt: attr(background, "data-alt") || "",
      width: emitted.width,
      height: emitted.height,
      decoding: "async",
      fetchpriority: priority ? "high" : "low",
      loading: priority ? undefined : "lazy",
    });
    background.childNodes = [image, ...(background.childNodes ?? [])];
    background.attrs = (background.attrs ?? []).filter((item) => item.name !== "data-bg" && item.name !== "data-alt");
    if (priority) lcp = emitted;
  }
  return lcp;
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
      streetAddress: address,
      addressLocality: "Frisco",
      addressRegion: "TX",
      postalCode: "75034",
      addressCountry: "US",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 33.1778061,
      longitude: -96.8411471,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "06:00",
      closes: "20:00",
    },
  };
  return element("script", { type: "application/ld+json" }, [{ nodeName: "#text", value: JSON.stringify(data) }]);
}

function preloadImage(emitted) {
  return element("link", {
    rel: "preload",
    as: "image",
    href: emitted.src,
    imagesrcset: srcset(emitted.variants),
    imagesizes: "100vw",
    fetchpriority: "high",
  });
}

async function buildPage(file, headerHtml, footerHtml, css) {
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
  await rewriteImages(header, { eager: true });
  await rewriteImages(footer);
  const lcp = await convertBackgrounds(main);

  body.childNodes = [...(header.childNodes ?? []), main, ...(footer.childNodes ?? [])];
  setAttr(main, "id", attr(main, "id") || "content");

  const logo = findAll(header, "img")[0];
  const logoSrc = attr(logo, "src");
  const shareImage = logoSrc ? new URL(logoSrc, siteOrigin).href : "";
  const hasLocalBusiness = jsonLd.some((script) => textOf(script).includes("LocalBusiness"));
  const structuredData = hasLocalBusiness ? jsonLd : [localBusinessScript(canonical), ...jsonLd];

  const headNodes = [
    element("meta", { charset: "utf-8" }),
    element("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
    ...(lcp ? [preloadImage(lcp)] : []),
    element("meta", { name: "theme-color", content: "#111111" }),
    { nodeName: "title", tagName: "title", attrs: [], childNodes: [{ nodeName: "#text", value: title }], namespaceURI: "http://www.w3.org/1999/xhtml" },
    element("meta", { name: "description", content: description }),
    element("link", { rel: "canonical", href: canonical }),
    element("meta", { name: "robots", content: robots }),
    element("style", {}, [{ nodeName: "#text", value: css }]),
    element("meta", { property: "og:title", content: title }),
    element("meta", { property: "og:description", content: description }),
    element("meta", { property: "og:url", content: canonical }),
    element("meta", { property: "og:type", content: "website" }),
    element("meta", { property: "og:site_name", content: "Ignyte Yoga" }),
    ...(shareImage ? [element("meta", { property: "og:image", content: shareImage })] : []),
    element("link", { rel: "icon", href: "/favicon.ico" }),
    element("link", { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" }),
    element("link", { rel: "manifest", href: "/site.webmanifest" }),
    ...structuredData,
  ];
  head.childNodes = headNodes;
  setAttr(body, "data-page", path.relative(pagesDir, file));

  const destination = outputPath(canonical, distFile);
  await mkdir(path.dirname(destination), { recursive: true });
  const serialized = parse5.serialize(document);
  const pageHtml = restoreStyleText(serialized.startsWith("<!DOCTYPE") ? serialized : `<!DOCTYPE html>\n${serialized}`);
  await writeFile(destination, `${pageHtml}\n`);
  return { file, destination, title, description, canonical, robots };
}

function restoreStyleText(html) {
  return html.replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => `<style>${css.replace(/&gt;/g, ">").replace(/&amp;/g, "&")}</style>`);
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

async function copyTree(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) await copyTree(source, target);
    else await copyFile(source, target);
  }
}

async function emitTouchIcon() {
  const logo = path.join(root, "assets/source/images/Your+paragraph+text.png");
  const resized = await sharp(logo).resize({ width: 156, height: 156, fit: "inside" }).png().toBuffer();
  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .png()
    .toFile(path.join(distDir, "apple-touch-icon.png"));
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(path.join(distDir, "media"), { recursive: true });
  await mkdir(path.join(distDir, "styles"), { recursive: true });
  await mkdir(path.join(distDir, "fonts"), { recursive: true });
  await mkdir(path.join(distDir, "scripts"), { recursive: true });
  await emitTouchIcon();

  const css = await readFile(path.join(srcDir, "styles/site.css"), "utf8");
  const header = await readFile(path.join(srcDir, "partials/header.html"), "utf8");
  const footer = await readFile(path.join(srcDir, "partials/footer.html"), "utf8");
  const pages = [];
  for (const file of await walkPages(pagesDir)) {
    pages.push(await buildPage(file, header, footer, css));
    console.log(`built ${path.relative(root, file)}`);
  }

  await copyFile(path.join(srcDir, "styles/site.css"), path.join(distDir, "styles/site.css"));
  await copyFile(path.join(srcDir, "scripts/nav.js"), path.join(distDir, "scripts/nav.js"));
  await copyFile(path.join(srcDir, "site.webmanifest"), path.join(distDir, "site.webmanifest"));
  for (const font of await readdir(path.join(srcDir, "fonts"))) {
    await copyFile(path.join(srcDir, "fonts", font), path.join(distDir, "fonts", font));
  }
  await copyFile(path.join(root, "assets/source/images/favicon.ico"), path.join(distDir, "favicon.ico"));
  await copyTree(path.join(root, "images"), path.join(distDir, "images"));

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
