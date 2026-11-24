const STUDIO_TIME_ZONE = "America/Chicago";
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATED = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/;
const TIMED = "[data-show-until], [data-show-from]";

export function isPromoOpen(now, from, until) {
  if (from && now < from) return false;
  if (until && now >= until) return false;
  return true;
}

function chicagoOffsetMs(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STUDIO_TIME_ZONE,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  }).formatToParts(date);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) throw new Error(`Could not read ${STUDIO_TIME_ZONE} offset for ${date.toISOString()}`);
  const sign = match[1] === "-" ? -1 : 1;
  const minutes = Number(match[2]) * 60 + Number(match[3] || 0);
  return sign * minutes * 60 * 1000;
}

export function chicagoWallTime(isoDate, hour, minute, second) {
  const match = DATE_ONLY.exec(isoDate);
  if (!match) return null;
  const asUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), hour, minute, second);
  const utc = asUtc - chicagoOffsetMs(new Date(asUtc - chicagoOffsetMs(new Date(asUtc))));
  return new Date(utc);
}

export function previewInstant(value) {
  if (!value || typeof value !== "string") return null;
  if (DATE_ONLY.test(value)) return chicagoWallTime(value, 12, 0, 0);
  if (!DATED.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function promoNow(search = "", now = new Date()) {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return previewInstant(new URLSearchParams(query).get("bfdate")) ?? now;
}

function instantAttr(node, name) {
  const value = node.getAttribute(name);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function setHidden(node, hidden) {
  node.hidden = hidden;
  if (hidden) node.setAttribute("hidden", "");
  else node.removeAttribute("hidden");
}

export function applyPromoWindows(root, now) {
  if (!root?.querySelectorAll) return;

  for (const node of root.querySelectorAll(TIMED)) {
    const open = isPromoOpen(now, instantAttr(node, "data-show-from"), instantAttr(node, "data-show-until"));
    setHidden(node, !open);
  }

  for (const banner of root.querySelectorAll("[data-promo='black-friday']")) {
    const panels = [...banner.querySelectorAll(TIMED)];
    if (panels.length) setHidden(banner, panels.every((panel) => panel.hidden));
  }

  for (const page of root.querySelectorAll("[data-bf-page]")) {
    const live = page.querySelector("[data-bf-live]");
    const ended = page.querySelector("[data-bf-ended]");
    if (!live || !ended) continue;
    const panels = [...live.querySelectorAll(TIMED)];
    const anyOpen = panels.some((panel) => !panel.hidden);
    setHidden(live, panels.length > 0 && !anyOpen);
    setHidden(ended, anyOpen || panels.length === 0);
  }
}
