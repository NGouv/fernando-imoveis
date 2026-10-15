const whatsappUrl = window.FERNANDO_WHATSAPP_URL;
const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#site-navigation");
const siteHeader = document.querySelector(".site-header");
const currentYear = document.querySelector("#current-year");

function closeMenu() {
  if (!menuToggle || !navigation) return;

  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir menu");
  navigation.classList.remove("is-open");
}

if (menuToggle && navigation) {
  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";

    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    menuToggle.setAttribute("aria-label", isExpanded ? "Abrir menu" : "Fechar menu");
    navigation.classList.toggle("is-open", !isExpanded);
  });

  navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
      closeMenu();
      menuToggle.focus();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (
      menuToggle.getAttribute("aria-expanded") === "true" &&
      siteHeader &&
      !siteHeader.contains(event.target)
    ) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 641px)").matches) closeMenu();
  });
}

if (currentYear) currentYear.textContent = String(new Date().getFullYear());

document.querySelectorAll("[data-whatsapp-cta]").forEach((link) => {
  const status = link
    .closest(".contact-action, .detail-sidebar")
    ?.querySelector(".contact-status");

  if (whatsappUrl) {
    link.href = whatsappUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return;
  }

  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (status) status.textContent = "O link de WhatsApp ainda não foi configurado.";
  });
});
