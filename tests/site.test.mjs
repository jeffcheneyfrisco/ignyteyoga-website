import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("static build and SEO check", () => {
  const build = spawnSync(process.execPath, ["scripts/build.mjs"], { encoding: "utf8" });
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

  const seo = spawnSync(process.execPath, ["scripts/seo-check.mjs"], { encoding: "utf8" });
  assert.equal(seo.status, 0, `${seo.stdout}\n${seo.stderr}`);

  assert.equal(existsSync("dist/index.html"), true);
  assert.equal(existsSync("dist/schedule/index.html"), true);
  assert.equal(existsSync("dist/classes/index.html"), true);
  assert.equal(existsSync("dist/new-here/index.html"), true);
  assert.equal(existsSync("dist/classes/hotflo/index.html"), true);
  assert.equal(existsSync("dist/classes/powerflo/index.html"), true);
  assert.equal(existsSync("dist/classes/ignyte-sculpt/index.html"), true);
  assert.equal(existsSync("dist/classes/ignyte-sculpt-45/index.html"), true);
  assert.equal(existsSync("dist/classes/blissflo/index.html"), true);
  assert.equal(existsSync("dist/classes/stretch/index.html"), true);
  assert.equal(existsSync("dist/classes/hothiit/index.html"), true);
  assert.equal(existsSync("dist/classes/powerhiit45/index.html"), true);
  assert.equal(existsSync("assets/source/inventory.md"), true);
  assert.equal(existsSync("content/home.md"), true);
  assert.equal(existsSync("notes/later-improvements.md"), true);

  const home = readFileSync("dist/index.html", "utf8");
  assert.match(home, /Energize your body/);
  assert.match(home, /data-netlify="true"/);
  assert.match(home, /href="\/schedule\/">Book a class/);
  assert.match(home, /class="btn book-btn book-btn-bar"/);
  assert.match(home, /75034/);
  assert.match(home, /Open daily, 6:00 AM to 8:00 PM/);
  assert.match(home, /openingHoursSpecification/);
  assert.match(home, /"opens": "06:00"/);
  assert.match(home, /"closes": "20:00"/);
  assert.doesNotMatch(home, /75033/);
  assert.doesNotMatch(home, /TODO: ZIP/);
  assert.doesNotMatch(home, /TODO: Hours/);

  const newer = readFileSync("dist/new-here/index.html", "utf8");
  assert.match(newer, /id="intro-offer" hidden/);
  assert.match(newer, /TODO: Intro offer/);
  assert.match(newer, /75034/);
  assert.match(newer, /Open daily, 6:00 AM to 8:00 PM/);
  assert.doesNotMatch(newer, /TODO: Hours/);
  assert.doesNotMatch(newer, /75033/);
  assert.match(newer, /href="\/new-here\/">New here\?/);
  assert.doesNotMatch(home, /lorem ipsum/i);
  assert.doesNotMatch(home, /acuity/i);

  const schedule = readFileSync("dist/schedule/index.html", "utf8");
  assert.match(schedule, /ce1600307310/);
  assert.match(schedule, /mindbody/i);
  assert.match(schedule, /openingHoursSpecification/);
  assert.match(schedule, /75034/);
  assert.doesNotMatch(schedule, /75033/);
});
