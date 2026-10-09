const revealItems = document.querySelectorAll(
  ".property-card, .about-visual, .about-copy, .differential-item",
);

const heroCarousel = document.querySelector("[data-hero-carousel]");
const heroSlides = heroCarousel ? [...heroCarousel.querySelectorAll(".hero-slide")] : [];
const heroIndicators = heroCarousel
  ? [...heroCarousel.querySelectorAll("[data-hero-indicator]")]
  : [];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (heroCarousel && heroSlides.length > 1 && heroIndicators.length === heroSlides.length) {
  const previousButton = heroCarousel.querySelector("[data-hero-previous]");
  const nextButton = heroCarousel.querySelector("[data-hero-next]");
  let activeSlide = 0;
  let rotationTimer;
  let isPaused = false;

  function updatePauseState() {
    isPaused =
      heroCarousel.matches(":hover") || heroCarousel.contains(document.activeElement);

    if (isPaused) {
      stopRotation();
    } else {
      startRotation();
    }
  }

  function stopRotation() {
    window.clearTimeout(rotationTimer);
  }

  function startRotation() {
    stopRotation();

    if (isPaused || reducedMotion.matches || document.hidden) return;

    rotationTimer = window.setTimeout(() => {
      showSlide(activeSlide + 1);
    }, 5000);
  }

  function showSlide(index) {
    activeSlide = (index + heroSlides.length) % heroSlides.length;

    heroSlides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === activeSlide);
    });
    heroIndicators.forEach((indicator, indicatorIndex) => {
      const isActive = indicatorIndex === activeSlide;
      indicator.classList.toggle("is-active", isActive);
      indicator.setAttribute("aria-pressed", String(isActive));
    });

    heroCarousel.classList.remove("is-transitioning");
    void heroCarousel.offsetWidth;
    heroCarousel.classList.add("is-transitioning");
    startRotation();
  }

  previousButton?.addEventListener("click", () => showSlide(activeSlide - 1));
  nextButton?.addEventListener("click", () => showSlide(activeSlide + 1));
  heroIndicators.forEach((indicator, index) => {
    indicator.addEventListener("click", () => showSlide(index));
  });

  heroCarousel.addEventListener("mouseenter", updatePauseState);
  heroCarousel.addEventListener("mouseleave", updatePauseState);
  heroCarousel.addEventListener("focusin", updatePauseState);
  heroCarousel.addEventListener("focusout", (event) => {
    if (!heroCarousel.contains(event.relatedTarget)) {
      window.setTimeout(updatePauseState);
    }
  });
  document.addEventListener("visibilitychange", startRotation);
  reducedMotion.addEventListener("change", startRotation);
  startRotation();
}

if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  revealItems.forEach((item) => item.setAttribute("data-reveal", ""));

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}
