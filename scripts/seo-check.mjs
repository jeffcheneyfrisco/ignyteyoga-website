import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as parse5 from "parse5";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const errors = [];

function fail(message) {
  errors.push(message);
}

function attr(node, name) {
  if (!node?.attrs) return "";
  return node.attrs.find((item) => item.name === name)?.value ?? "";
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

function textOf(node) {
  if (!node) return "";
  if (node.nodeName === "#text") return node.value;
  return (node.childNodes ?? []).map(textOf).join("");
}

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

const files = await htmlFiles(dist);
if (!files.length) fail("dist has no HTML pages");

const titles = new Map();
const descriptions = new Map();
const indexable = [];

for (const file of files) {
  const html = await readFile(file, "utf8");
  const document = parse5.parse(html);
  const title = textOf(findAll(document, "title")[0]).replace(/\s+/g, " ").trim();
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
  );
  const h1s = findAll(document, "h1").map((node) => textOf(node).replace(/\s+/g, " ").trim()).filter(Boolean);
  const label = path.relative(dist, file);

  if (!title) fail(`${label} is missing a title`);
  if (h1s.length !== 1) fail(`${label} has ${h1s.length} h1 headings`);
  if (!description) fail(`${label} is missing a meta description`);
  else if (description.length < 50 || description.length > 170) {
    fail(`${label} description length ${description.length} is outside 50-170`);
  }
  if (!canonical.startsWith("https://ignyteyoga.com/")) fail(`${label} canonical is not on https://ignyteyoga.com`);
  for (const property of ["og:title", "og:description", "og:url", "og:type", "og:site_name", "og:image"]) {
    const tag = findAll(document, "meta").find((meta) => attr(meta, "property") === property);
    if (!attr(tag, "content")) fail(`${label} is missing ${property}`);
  }
  const jsonLd = findAll(document, "script")
    .filter((script) => attr(script, "type") === "application/ld+json")
    .map((script) => textOf(script))
    .join("\n");
  if (!robots.includes("noindex")) {
    if (!jsonLd.includes("LocalBusiness") || !jsonLd.includes("ExerciseGym")) {
      fail(`${label} is missing LocalBusiness/ExerciseGym JSON-LD`);
    }
  }
  if (/lorem ipsum/i.test(html)) fail(`${label} still contains lorem ipsum`);
  if (/acuity/i.test(html)) fail(`${label} mentions Acuity`);
  for (const image of findAll(document, "img")) {
    if (!image.attrs?.some((item) => item.name === "alt")) fail(`${label} has an image without alt`);
  }

  if (titles.has(title)) fail(`duplicate title "${title}" on ${label} and ${titles.get(title)}`);
  else titles.set(title, label);
  if (!robots.includes("noindex")) {
    if (descriptions.has(description)) {
      fail(`duplicate description on ${label} and ${descriptions.get(description)}`);
    } else descriptions.set(description, label);
    indexable.push(canonical);
  }
}

const home = await readFile(path.join(dist, "index.html"), "utf8");
if (!home.includes("ExerciseGym")) fail("home page is missing ExerciseGym JSON-LD");
if (!home.includes("LocalBusiness")) fail("home page is missing LocalBusiness JSON-LD");
if (!home.includes('name="newsletter"')) fail("home page is missing the newsletter form");
if (!home.includes("data-netlify")) fail("newsletter form is not a Netlify Form");

const schedule = await readFile(path.join(dist, "schedule/index.html"), "utf8");
if (!schedule.includes("ce1600307310")) fail("schedule page is missing the Mindbody widget id");
if (!/mindbody/i.test(schedule)) fail("schedule page does not identify Mindbody");

const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8");
for (const url of indexable) {
  if (!sitemap.includes(`<loc>${url}</loc>`)) fail(`sitemap missing ${url}`);
}

const robots = await readFile(path.join(dist, "robots.txt"), "utf8");
for (const agent of ["Googlebot", "GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
  if (!robots.includes(`User-agent: ${agent}`)) fail(`robots.txt does not name ${agent}`);
}
if (!/Allow:\s*\//.test(robots)) fail("robots.txt does not allow crawling");
if (!robots.includes("Sitemap: https://ignyteyoga.com/sitemap.xml")) fail("robots.txt missing sitemap");

const netlify = await readFile(path.join(root, "netlify.toml"), "utf8");
for (const header of [
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Content-Security-Policy",
  "X-Frame-Options",
  "Permissions-Policy",
]) {
  if (!netlify.includes(header)) fail(`netlify.toml missing ${header}`);
}

const media = path.join(dist, "media");
const mediaStat = await stat(media);
if (!mediaStat.isDirectory()) fail("dist/media is missing");
const webps = (await readdir(media)).filter((name) => name.endsWith(".webp"));
if (webps.length < 10) fail("sharp did not emit enough responsive WebP files");

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`seo ok: ${files.length} pages, ${indexable.length} indexable, ${webps.length} webp`);
