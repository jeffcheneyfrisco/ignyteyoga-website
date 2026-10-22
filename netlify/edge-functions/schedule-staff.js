// Mindbody paints a teacher with a public profile as a text button (bold, #e4452c)
// and every other teacher as plain text in the same paragraph (weight 400, black at
// 70% opacity). The class-title cell is the grid item that also holds the details
// accordion, so one rule covers both name treatments. #e4452c on the widget's white
// background is about 4.05:1, short of WCAG AA for this 14px text. #d3382c keeps that
// orange and clears 4.5:1 (about 4.80:1 on #ffffff). The site accent #e00003 passes
// too, but it is red and would fight the orange already used for schedule actions.

const TEACHER_NAME_STYLE = `<style id="ignyte-teacher-names">
/* The class-title cell is the grid item that also holds the details accordion.
   The start-time cell uses the same h6 + body2 pair for the duration, so :has
   keeps "45 min" out of this rule. Profile names are a button inside the paragraph. */
.MuiGrid-item:has(> .MuiAccordion-root) > .MuiTypography-h6 + .MuiTypography-body2,
.MuiGrid-item:has(> .MuiAccordion-root) > .MuiTypography-h6 + .MuiTypography-body2 .MuiButton-root,
.MuiGrid-item:has(> .MuiAccordion-root) > .MuiTypography-h6 + .MuiTypography-body2 .MuiButton-root:hover,
.MuiGrid-item:has(> .MuiAccordion-root) > .MuiTypography-h6 + .MuiTypography-body2 .MuiButton-root:focus,
.MuiGrid-item:has(> .MuiAccordion-root) > .MuiTypography-h6 + .MuiTypography-body2 .MuiButton-root:focus-visible {
  color: #d3382c !important;
  font-weight: 700 !important;
  line-height: 22px !important;
}
</style>`;

const SCHEDULE_PATH = "/book/widgets/schedules/view/ce771257310/schedule";
const UPSTREAM_ORIGIN = "https://go.mindbodyonline.com";

const WIDGET_CSP = [
  "default-src 'self' https://go.mindbodyonline.com https://*.mindbodyonline.com",
  "script-src 'self' 'unsafe-inline' https://go.mindbodyonline.com https://*.mindbodyonline.com https://www.googletagmanager.com https://www.google-analytics.com https://js-agent.newrelic.com https://bam.nr-data.net https://services.sdiapi.com https://sd.mindbodyonline.com https://reports.sdiapi.com",
  "style-src 'self' 'unsafe-inline' https://go.mindbodyonline.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://go.mindbodyonline.com",
  "connect-src 'self' https://go.mindbodyonline.com https://*.mindbodyonline.com https://www.google-analytics.com https://www.googletagmanager.com https://bam.nr-data.net https://reports.sdiapi.com https://services.sdiapi.com",
  "frame-src 'self' https://*.mindbodyonline.com https://www.mindbodyonline.com https://clients.mindbodyonline.com",
  "worker-src 'self' blob:",
  "form-action 'self' https://*.mindbodyonline.com https://www.mindbodyonline.com https://clients.mindbodyonline.com",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "keep-alive",
  "upgrade",
  "proxy-connection",
  "te",
  "trailer",
]);

export function injectTeacherNameStyle(html) {
  if (html.includes('id="ignyte-teacher-names"')) return html;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${TEACHER_NAME_STYLE}</head>`);
  return TEACHER_NAME_STYLE + html;
}

function upstreamHeaders(request) {
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  headers.set("accept-encoding", "identity");
  headers.set("origin", UPSTREAM_ORIGIN);
  headers.set("referer", `${UPSTREAM_ORIGIN}${SCHEDULE_PATH}`);
  return headers;
}

function allowedBookPath(pathname) {
  return pathname === SCHEDULE_PATH
    || pathname.startsWith("/book/_next/")
    || pathname.startsWith("/book/iframeResizer")
    || pathname === "/book/favicon.ico"
    || pathname.startsWith("/book/mp/");
}

export default async (request) => {
  const incoming = new URL(request.url);
  if (!allowedBookPath(incoming.pathname)) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const target = new URL(incoming.pathname + incoming.search, UPSTREAM_ORIGIN);

  const init = {
    method: request.method,
    headers: upstreamHeaders(request),
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream;
  try {
    upstream = await fetch(target, init);
  } catch {
    return new Response("Schedule is unavailable right now.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const headers = new Headers(upstream.headers);
  for (const name of ["content-encoding", "content-length", "content-security-policy", "content-security-policy-report-only"]) {
    headers.delete(name);
  }
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "SAMEORIGIN");

  const type = upstream.headers.get("content-type") || "";
  if (!type.includes("text/html")) {
    headers.set("cache-control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  const html = injectTeacherNameStyle(await upstream.text());
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("content-security-policy", WIDGET_CSP);
  headers.set("cache-control", "no-store");
  return new Response(html, { status: upstream.status, headers });
};
