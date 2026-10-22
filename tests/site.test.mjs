import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
  assert.equal(existsSync("dist/classes/flow/index.html"), true);
  assert.equal(existsSync("dist/classes/powerflo/index.html"), true);
  assert.equal(existsSync("dist/classes/ignyte-sculpt/index.html"), true);
  assert.equal(existsSync("dist/classes/ignyte-sculpt-45/index.html"), false);
  assert.equal(existsSync("src/pages/classes/ignyte-sculpt-45.html"), false);
  assert.equal(existsSync("dist/classes/deep-surrender/index.html"), true);
  assert.equal(existsSync("dist/classes/deep-surrender45/index.html"), true);
  assert.equal(existsSync("dist/classes/blissflo/index.html"), false);
  assert.equal(existsSync("src/pages/classes/blissflo.html"), false);
  assert.equal(existsSync("dist/classes/stretch/index.html"), false);
  assert.equal(existsSync("src/pages/classes/stretch.html"), false);
  assert.equal(existsSync("dist/classes/hotflo/index.html"), false);
  assert.equal(existsSync("src/pages/classes/hotflo.html"), false);
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
  assert.match(newer, /1\. Before you come/);
  assert.match(newer, /2\. Arriving/);
  assert.match(newer, /3\. In the room/);
  assert.match(newer, /4\. After class/);
  assert.match(newer, /TODO: The published policies/);

  const teachers = readFileSync("dist/ourteam/index.html", "utf8");
  assert.match(teachers, /Christie must confirm this roster/);
  assert.match(teachers, /Christie Cheney Bone/);
  assert.match(teachers, /Dianne Powter/);
  assert.match(teachers, /Sierra Snyder/);
  assert.doesNotMatch(teachers, /lorem ipsum/i);
  assert.match(home, /Why infrared/);
  assert.match(home, /self-guided infrared sauna workout/);
  assert.match(home, /href="\/classes\/flow\/"/);
  assert.match(home, /href="\/classes\/hothiit\/"/);
  assert.doesNotMatch(home, /Journal of the American College of Cardiology/);
  assert.match(home, /class="mobile-bar"/);
  assert.match(home, /tel:\+14695362540/);
  assert.match(home, /maps\/dir\/\?api=1/);
  assert.doesNotMatch(home, /lorem ipsum/i);
  assert.doesNotMatch(home, /acuity/i);

  const schedule = readFileSync("dist/schedule/index.html", "utf8");
  assert.match(schedule, /ce1600307310/);
  assert.match(schedule, /mindbody/i);
  assert.match(schedule, /src="\/book\/widgets\/schedules\/view\/ce771257310\/schedule"/);
  assert.doesNotMatch(schedule, /widgets\.mindbodyonline\.com\/iframe/);
  assert.doesNotMatch(schedule, /healcode\.js/);
  const staffStyle = readFileSync("netlify/edge-functions/schedule-staff.js", "utf8");
  assert.match(staffStyle, /\.MuiGrid-item:has\(> \.MuiAccordion-root\) > \.MuiTypography-h6 \+ \.MuiTypography-body2/);
  assert.match(staffStyle, /color: #d3382c !important/);
  assert.match(staffStyle, /font-weight: 700 !important/);
  assert.doesNotMatch(staffStyle, /Kristin|Andrea|Christie|Danielle/);
  assert.match(schedule, /openingHoursSpecification/);
  assert.match(schedule, /75034/);
  assert.doesNotMatch(schedule, /75033/);

  const address = "12021 Dallas Pkwy, Suite 300, Frisco, TX 75034";
  assert.match(home, new RegExp(address));
  assert.match(newer, new RegExp(address));
  assert.match(home, /Find us/);
  assert.match(newer, /Find us/);
  assert.match(home, /width="1118"/);
  assert.match(home, /height="257"/);
  assert.doesNotMatch(home, /href="\/blog\//);
  assert.equal(existsSync("dist/blog/index.html"), false);
  assert.equal(existsSync("dist/blog/exploring-kfzll/index.html"), false);
  assert.equal(existsSync("dist/home-original/index.html"), false);
  assert.equal(existsSync("dist/schedule-1/index.html"), false);
  assert.equal(existsSync("dist/instructors-1/index.html"), false);
  const netlify = readFileSync("netlify.toml", "utf8");
  assert.match(netlify, /function = "schedule-staff"/);
  assert.match(netlify, /path = "\/book\/widgets\/schedules\/view\/ce771257310\/schedule"/);
  assert.match(netlify, /from = "\/book\/\*"\n  to = "https:\/\/go\.mindbodyonline\.com\/book\/:splat"\n  status = 200\n  force = true/);
  assert.match(netlify, /frame-src 'self'/);
  assert.match(netlify, /from = "\/home-original\/"\n  to = "\/"\n  status = 301\n  force = true/);
  assert.match(netlify, /from = "\/schedule-1\/"\n  to = "\/schedule\/"\n  status = 301\n  force = true/);
  assert.match(netlify, /from = "\/instructors-1\/"\n  to = "\/ourteam\/"\n  status = 301\n  force = true/);
  assert.equal(existsSync("dist/apple-touch-icon.png"), true);
  assert.equal(existsSync("dist/site.webmanifest"), true);
  const icon = readFileSync("dist/apple-touch-icon.png");
  assert.equal(icon.readUInt32BE(16), 180);
  assert.equal(icon.readUInt32BE(20), 180);
  const photo = statSync("dist/media/ignyte-0323-090-1600.webp");
  assert.ok(photo.size <= 220 * 1024, `ignyte-0323-090-1600.webp is ${photo.size} bytes`);
  assert.equal(existsSync("dist/media/ignyte-0323-090-800.webp"), true);
  const about = readFileSync("dist/about/index.html", "utf8");
  assert.match(about, /ignyte-0323-090-1600\.webp 1600w/);
  assert.match(about, /ignyte-0323-090-800\.webp 800w/);
  assert.match(about, /loading="lazy"/);

  assert.match(home, /href="\/community\/">Community/);
  assert.equal(existsSync("dist/community/index.html"), true);
  assert.equal(existsSync("dist/classes/power45/index.html"), false);
  assert.equal(existsSync("dist/classes/power-45/index.html"), false);
  assert.equal(existsSync("src/pages/classes/power45.html"), false);
  const community = readFileSync("dist/community/index.html", "utf8");
  assert.match(community, /<h1>Community Beyond the Walls<\/h1>/);
  assert.match(community, /Ignyte Adventures/);
  assert.match(community, /Lake Grapevine Community Day/);
  assert.match(community, /April 11, 2026, 10 AM to 5 PM/);
  assert.match(community, /Ignyte community group photo on a hiking trail at Lake Grapevine/);
  assert.match(community, /Ignyte Tri 2026/);
  assert.match(community, /Fall 2026/);
  assert.match(community, /Our pace\. Our people\./);
  assert.match(community, /More Ignyte Tri to come!/);
  assert.match(community, /Strength45 with Allyson/);
  assert.match(community, /href="\/classes\/powerflo\/"/);
  assert.match(community, /PowerFlo/);
  assert.match(community, /with Dianne/);
  assert.match(community, /5K fun run/);
  assert.match(community, /run, walk, or roll/);
  assert.match(community, /starting and finishing at the studio/);
  assert.match(community, /Sunrise Walks/);
  assert.match(community, /src="\/images\/community\/lake-grapevine\.jpg"/);
  assert.match(community, /src="\/images\/community\/ignyte-tri\.mp4"/);
  assert.match(community, /poster="\/images\/community\/ignyte-tri-poster\.jpg"/);
  assert.match(community, /src="\/images\/community\/grapevine-clip1\.mp4"/);
  assert.match(community, /poster="\/images\/community\/grapevine-clip1-poster\.jpg"/);
  assert.match(community, /src="\/images\/community\/grapevine-clip2\.mp4"/);
  assert.match(community, /poster="\/images\/community\/grapevine-clip2-poster\.jpg"/);
  assert.match(community, /preload="metadata"/);
  assert.match(community, /class="sound-toggle"/);
  assert.match(community, /Play Ignyte Tri with sound/);
  assert.equal((community.match(/preload="metadata"/g) || []).length, 5);
  assert.equal((community.match(/\smuted(?:=|\s|>)/g) || []).length, 5);
  assert.match(community, /src="\/images\/community\/sunrise-1\.jpg"/);
  assert.match(community, /Ignyte Sunrise Walk group outside the studio at sunrise/);
  assert.match(community, /src="\/images\/community\/sunrise-2\.jpg"/);
  assert.match(community, /src="\/images\/community\/grapevine-clip3\.mp4"/);
  assert.match(community, /poster="\/images\/community\/grapevine-clip3-poster\.jpg"/);
  assert.match(community, /hiking a green trail at Lake Grapevine/);
  assert.doesNotMatch(community, /sunrise-clip1/);
  assert.match(community, /src="\/images\/community\/sunrise-clip2\.mp4"/);
  assert.match(community, /poster="\/images\/community\/sunrise-clip2-poster\.jpg"/);
  assert.doesNotMatch(community, /image-asset-90d1db64/);
  assert.doesNotMatch(community, /sunrise-walks\.jpg/);
  assert.match(community, /https:\/\/www\.instagram\.com\/ignyteyoga\//);
  assert.match(community, /@ignyteyoga/);
  assert.match(community, /href="\/schedule\/">Book a class/);
  assert.match(community, /https:\/\/ignyteyoga\.com\/community\//);
  assert.equal(existsSync("dist/images/community/lake-grapevine.jpg"), true);
  assert.equal(existsSync("dist/images/community/ignyte-tri-poster.jpg"), true);
  assert.equal(existsSync("dist/images/community/sunrise-1.jpg"), true);
  assert.equal(existsSync("dist/images/community/sunrise-2.jpg"), true);
  assert.equal(existsSync("dist/images/community/grapevine-clip3.mp4"), true);
  assert.equal(existsSync("dist/images/community/grapevine-clip3-poster.jpg"), true);
  assert.equal(existsSync("dist/images/community/sunrise-clip1.mp4"), false);
  assert.equal(existsSync("dist/images/community/sunrise-clip2.mp4"), true);
  assert.equal(existsSync("dist/images/community/sunrise-walks.jpg"), false);
  assert.doesNotMatch(home, /image-asset-90d1db64/);
  assert.doesNotMatch(home, /Diane Shaw/);
  assert.match(readFileSync("dist/sitemap.xml", "utf8"), /<loc>https:\/\/ignyteyoga\.com\/community\/<\/loc>/);
  assert.match(netlify, /from = "\/classes\/power45\/"\n  to = "\/classes\/"\n  status = 301\n  force = true/);
  assert.match(netlify, /from = "\/classes\/power-45\/"\n  to = "\/classes\/"\n  status = 301\n  force = true/);
  assert.match(netlify, /from = "\/power45\/"\n  to = "\/classes\/"\n  status = 301\n  force = true/);
  assert.match(netlify, /from = "\/power-45\/"\n  to = "\/classes\/"\n  status = 301\n  force = true/);
  for (const from of ["/classes/bliss", "/classes/bliss/", "/classes/blissflo", "/classes/blissflo/", "/bliss", "/bliss/", "/blissflo", "/blissflo/"]) {
    assert.match(netlify, new RegExp(`from = "${from}"\\n  to = "/classes/deep-surrender/"\\n  status = 301\\n  force = true`));
  }
  for (const from of ["/classes/bliss45", "/classes/bliss45/", "/classes/bliss-45", "/classes/bliss-45/", "/classes/blissflo45", "/classes/blissflo45/", "/classes/blissflo-45", "/classes/blissflo-45/", "/bliss45", "/bliss45/", "/bliss-45", "/bliss-45/", "/blissflo45", "/blissflo45/", "/blissflo-45", "/blissflo-45/"]) {
    assert.match(netlify, new RegExp(`from = "${from}"\\n  to = "/classes/deep-surrender45/"\\n  status = 301\\n  force = true`));
  }
  for (const from of ["/classes/ignyte-sculpt-45", "/classes/ignyte-sculpt-45/", "/classes/ignytesculpt45", "/classes/ignytesculpt45/", "/classes/ignyte-sculpt45", "/classes/ignyte-sculpt45/", "/classes/ignite-sculpt-45", "/classes/ignite-sculpt-45/", "/classes/ignitesculpt45", "/classes/ignitesculpt45/", "/classes/ignite-sculpt45", "/classes/ignite-sculpt45/", "/ignyte-sculpt-45", "/ignyte-sculpt-45/", "/ignytesculpt45", "/ignytesculpt45/", "/ignyte-sculpt45", "/ignyte-sculpt45/", "/ignite-sculpt-45", "/ignite-sculpt-45/", "/ignitesculpt45", "/ignitesculpt45/", "/ignite-sculpt45", "/ignite-sculpt45/", "/classes/stretch", "/classes/stretch/", "/stretch", "/stretch/"]) {
    assert.match(netlify, new RegExp(`from = "${from}"\\n  to = "/classes/"\\n  status = 301\\n  force = true`));
  }
  for (const from of ["/classes/hotflo", "/classes/hotflo/", "/classes/hot-flo", "/classes/hot-flo/", "/classes/hotflow", "/classes/hotflow/", "/classes/hot-flow", "/classes/hot-flow/", "/hotflo", "/hotflo/", "/hot-flo", "/hot-flo/", "/hotflow", "/hotflow/", "/hot-flow", "/hot-flow/"]) {
    assert.match(netlify, new RegExp(`from = "${from}"\\n  to = "/classes/flow/"\\n  status = 301\\n  force = true`));
  }
  assert.doesNotMatch(community, /power yoga/i);
  assert.match(readFileSync("dist/classes/index.html", "utf8"), /PowerFlo/);

  const power45 = /power[\s-]*45/i;
  function walkHtml(dir, found = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walkHtml(full, found);
      else if (entry.name.endsWith(".html") || entry.name.endsWith(".xml") || entry.name.endsWith(".txt")) found.push(full);
    }
    return found;
  }
  for (const file of walkHtml("dist")) {
    const html = readFileSync(file, "utf8");
    assert.doesNotMatch(html, power45, file);
    assert.doesNotMatch(html, /bliss/i, file);
    assert.doesNotMatch(html, /ignyte[\s-]*sculpt[\s-]*45/i, file);
    assert.doesNotMatch(html, /ignite[\s-]*sculpt[\s-]*45/i, file);
    assert.doesNotMatch(html, /hot[\s-]*flo/i, file);
    assert.doesNotMatch(html, /hot[\s-]*flow/i, file);
    assert.doesNotMatch(html, /\/classes\/stretch/i, file);
    assert.doesNotMatch(html, />\s*Stretch\s*</, file);
    assert.doesNotMatch(html, /image-asset-90d1db64/, file);
    assert.doesNotMatch(html, /Diane Shaw/, file);
  }
  assert.match(readFileSync("dist/classes/flow/index.html", "utf8"), /<h1>Flow<\/h1>/);
  assert.match(readFileSync("dist/classes/deep-surrender/index.html", "utf8"), /<h1>Deep Surrender<\/h1>/);
  assert.match(readFileSync("dist/classes/deep-surrender45/index.html", "utf8"), /<h1>Deep Surrender45<\/h1>/);
  assert.match(readFileSync("dist/sitemap.xml", "utf8"), /<loc>https:\/\/ignyteyoga\.com\/classes\/flow\/<\/loc>/);
  assert.doesNotMatch(readFileSync("dist/sitemap.xml", "utf8"), /hotflo|stretch|ignyte-sculpt-45|bliss/i);
  assert.match(readFileSync("dist/sitemap.xml", "utf8"), /<loc>https:\/\/ignyteyoga\.com\/classes\/deep-surrender45\/<\/loc>/);
  assert.match(readFileSync("dist/classes/powerhiit45/index.html", "utf8"), /PowerHIIT45/);
  assert.match(readFileSync("dist/classes/powerflo/index.html", "utf8"), /PowerFlo/);
});
