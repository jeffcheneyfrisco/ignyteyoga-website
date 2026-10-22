const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("#site-nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

document.querySelectorAll(".sound-toggle").forEach((button) => {
  const video = button.closest(".tri-frame")?.querySelector("video");
  if (!video) return;
  button.addEventListener("click", () => {
    const unmute = video.muted;
    video.muted = !unmute;
    if (unmute) {
      const play = video.play();
      if (play) play.catch(() => {});
    }
    const sounding = !video.muted;
    button.setAttribute("aria-pressed", sounding ? "true" : "false");
    button.setAttribute("aria-label", sounding ? "Mute Ignyte Tri" : "Play Ignyte Tri with sound");
    button.textContent = sounding ? "Mute" : "Play";
  });
});
