// Pangano Bricks — small, dependency-free interactions. No framework needed
// for a marketing site this size; keeping it lean means it stays fast on
// the phones most site visitors will actually be using.

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Theme toggle (light/dark) ----------
// The <head> of each page sets data-theme before paint; this wires up the
// button to flip it and remember the choice.
const themeToggle = document.getElementById("themeToggle");
function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem("pangano-theme", theme); } catch (e) {
    // Storage blocked — theme still applies for this page view.
  }
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
}
if (themeToggle) {
  themeToggle.setAttribute("aria-pressed", String(currentTheme() === "dark"));
  themeToggle.addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
}

// ---------- Header shadow + floating WhatsApp button ----------
const header = document.getElementById("siteHeader");
const waFloat = document.querySelector(".wa-float");
function onScroll() {
  header.classList.toggle("scrolled", window.scrollY > 10);
  if (waFloat) waFloat.classList.toggle("show", window.scrollY > 500);
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ---------- Mobile nav ----------
const navToggle = document.getElementById("navToggle");
const mobileNav = document.getElementById("mobileNav");
function setNav(open) {
  navToggle.classList.toggle("open", open);
  mobileNav.classList.toggle("open", open);
  document.body.classList.toggle("nav-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
navToggle.addEventListener("click", () => setNav(!mobileNav.classList.contains("open")));
mobileNav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setNav(false)));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && mobileNav.classList.contains("open")) setNav(false);
});

// ---------- Advert slider ----------
// The track is a native scroll-snap strip, so swiping works with no JS.
// This adds dots, arrows and a gentle autoplay that stops as soon as the
// visitor touches it (and never runs under reduced-motion).
document.querySelectorAll("[data-slider]").forEach((slider) => {
  const track = slider.querySelector(".ad-track");
  const slides = [...track.children];
  const dotsBox = slider.querySelector(".ad-dots");
  let index = 0;
  let timer = null;

  const dots = slides.map((slide, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", `Show advert ${i + 1} of ${slides.length}`);
    b.addEventListener("click", () => { stop(); go(i); });
    dotsBox.appendChild(b);
    return b;
  });

  function go(i) {
    index = (i + slides.length) % slides.length;
    track.scrollTo({ left: slides[index].offsetLeft - track.offsetLeft, behavior: reducedMotion ? "auto" : "smooth" });
  }
  function mark(i) {
    dots.forEach((d, j) => d.setAttribute("aria-current", String(j === i)));
  }
  function stop() { clearInterval(timer); timer = null; }

  // Keep the dots in sync with manual swipes.
  let raf = 0;
  track.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      index = Math.round(track.scrollLeft / track.clientWidth);
      mark(index);
    });
  }, { passive: true });

  slider.querySelector("[data-prev]")?.addEventListener("click", () => { stop(); go(index - 1); });
  slider.querySelector("[data-next]")?.addEventListener("click", () => { stop(); go(index + 1); });
  ["pointerdown", "touchstart", "wheel"].forEach((ev) => track.addEventListener(ev, stop, { passive: true }));

  mark(0);
  if (!reducedMotion && slides.length > 1) timer = setInterval(() => go(index + 1), 5000);
});

// ---------- Scroll-reveal ----------
const revealEls = document.querySelectorAll(".reveal");
document.querySelectorAll("[data-stagger]").forEach((group) => {
  group.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i, 6) * 0.08}s`;
  });
});
if ("IntersectionObserver" in window && !reducedMotion) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("in-view"));
}

// ---------- Active nav link ----------
const currentPage = location.pathname.split("/").pop() || "index.html";
document.querySelectorAll(".main-nav a, .mobile-nav a:not(.btn)").forEach((a) => {
  const page = (a.getAttribute("href") || "").split("#")[0] || "index.html";
  if (page === currentPage) a.classList.add("active");
});
