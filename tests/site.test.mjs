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
  assert.equal(existsSync("assets/source/inventory.md"), true);
  assert.equal(existsSync("content/home.md"), true);
  assert.equal(existsSync("notes/later-improvements.md"), true);

  const home = readFileSync("dist/index.html", "utf8");
  assert.match(home, /Energize your body/);
  assert.match(home, /data-netlify="true"/);
  assert.doesNotMatch(home, /lorem ipsum/i);
  assert.doesNotMatch(home, /acuity/i);

  const schedule = readFileSync("dist/schedule/index.html", "utf8");
  assert.match(schedule, /ce1600307310/);
  assert.match(schedule, /mindbody/i);
});
