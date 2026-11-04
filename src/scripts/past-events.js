const STUDIO_TIME_ZONE = "America/Chicago";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function studioToday(now = new Date(), timeZone = STUDIO_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isPastEventDate(eventDate, today) {
  return ISO_DATE.test(eventDate) && ISO_DATE.test(today) && eventDate < today;
}

export function markPastEvents(root, today = studioToday()) {
  if (!root?.querySelectorAll) return;
  for (const card of root.querySelectorAll("[data-event-date]")) {
    const past = isPastEventDate(card.getAttribute("data-event-date") || "", today);
    card.classList.toggle("event-past", past);
    if (past) card.setAttribute("data-past", "true");
    else card.removeAttribute("data-past");

    const status = card.querySelector(".event-status");
    if (past && !status) {
      const label = card.ownerDocument.createElement("p");
      label.className = "event-status";
      label.textContent = "Past";
      card.prepend(label);
    } else if (!past && status) {
      status.remove();
    }
  }
}
