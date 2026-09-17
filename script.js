// Pangano Bricks — small, dependency-free interactions. No framework needed
// for a marketing site this size; keeping it lean means it stays fast on
// the phones most site visitors will actually be using.

document.getElementById("year").textContent = new Date().getFullYear();

// ---------- Theme toggle (light/dark) ----------
// Persisted client-side via localStorage — static site, no server or
// cookies needed. The <head> in each page already set the initial
// data-theme attribute before paint (avoids a flash of the wrong theme);
// this just wires up the button to flip and save it.
const themeToggle = document.getElementById("themeToggle");
function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem("pangano-theme", theme); } catch (e) {
    // Private browsing / storage blocked — theme still applies for this
    // page view, it just won't persist to the next one.
  }
  if (themeToggle) themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
}
if (themeToggle) {
  themeToggle.setAttribute("aria-pressed", String(currentTheme() === "dark"));
  themeToggle.addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
}

// ---------- Sticky header state ----------
const header = document.getElementById("siteHeader");
function onScroll() {
  header.classList.toggle("scrolled", window.scrollY > 40);
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ---------- Mobile nav ----------
const navToggle = document.getElementById("navToggle");
const mobileNav = document.getElementById("mobileNav");
function closeNav() {
  navToggle.classList.remove("open");
  mobileNav.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
}
navToggle.addEventListener("click", () => {
  const open = navToggle.classList.toggle("open");
  mobileNav.classList.toggle("open", open);
  navToggle.setAttribute("aria-expanded", String(open));
});
mobileNav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));

// ---------- Scroll-reveal ----------
// Real, working motion via IntersectionObserver rather than a library —
// elements fade/slide in once, the first time they enter the viewport.
const revealEls = document.querySelectorAll(".reveal");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Stagger: any group marked [data-stagger] gets its .reveal children a
// progressively later transition-delay, so grids animate in as a wave
// rather than all at once.
document.querySelectorAll("[data-stagger]").forEach((group) => {
  group.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.09}s`;
  });
});

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  // No IntersectionObserver support: show everything immediately rather
  // than leaving content invisible.
  revealEls.forEach((el) => el.classList.add("in-view"));
}

// ---------- Hero parallax ----------
// Subtle depth on the hero photo as the visitor scrolls past it. Skipped
// entirely under reduced-motion, and capped so it never scrolls the image
// out of frame.
const heroImg = document.querySelector(".hero-media img, .page-hero-media img");
if (heroImg && !reducedMotion) {
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const shift = Math.min(window.scrollY * 0.18, 90);
        heroImg.style.transform = `scale(1.06) translateY(${shift}px)`;
        ticking = false;
      });
    },
    { passive: true }
  );
}

// ---------- Active nav link ----------
// Marks the current page in both nav variants using the page's own
// filename, so it works the same across every page without per-page JS.
const currentPage = location.pathname.split("/").pop() || "index.html";
document.querySelectorAll(".main-nav a, .mobile-nav a").forEach((a) => {
  const href = a.getAttribute("href") || "";
  const page = href.split("#")[0] || "index.html";
  if (page === currentPage || (page === "" && currentPage === "index.html")) {
    a.classList.add("active");
  }
});
