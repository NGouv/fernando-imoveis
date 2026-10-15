const propertyGrid = document.querySelector("#property-grid");
const propertyListStatus = document.querySelector("#property-list-status");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealObserver =
  "IntersectionObserver" in window && !reduceMotion
    ? new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 },
      )
    : null;

function observeRevealItems(items) {
  if (!revealObserver) return;

  items.forEach((item) => {
    item.setAttribute("data-reveal", "");
    revealObserver.observe(item);
  });
}

observeRevealItems(
  document.querySelectorAll(".about-visual, .about-copy, .differential-item"),
);

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatArea(value) {
  if (value === null || value === undefined) return null;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)} m²`;
}

function getLocation(property) {
  const city = [property.city, property.state].filter(Boolean).join(" / ");
  return [city, property.neighborhood].filter(Boolean).join(" · ");
}

function getPropertyLabel(property) {
  const types = {
    house: "Casa",
    apartment: "Apartamento",
    land: "Terreno",
    commercial: "Imóvel comercial",
    other: "Imóvel",
  };
  const purposes = {
    sale: "à venda",
    rent: "para alugar",
    assignment: "em ágio",
  };

  return `${types[property.property_type] || "Imóvel"} ${purposes[property.purpose] || ""}`.trim();
}

function createFact(value, label) {
  const fact = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = value;
  fact.append(strong, document.createTextNode(` ${label}`));
  return fact;
}

function createPropertyCard(property, coverImage) {
  const card = document.createElement("a");
  card.className = "property-card";
  card.href = `imovel.html?id=${encodeURIComponent(property.slug)}`;
  card.setAttribute("aria-label", `Ver detalhes de ${property.title}`);

  const imageLink = document.createElement("div");
  imageLink.className = "property-image-link";

  const imageFallback = document.createElement("span");
  imageFallback.className = "property-image-fallback";
  imageFallback.textContent = "Imagem indisponível";
  imageFallback.hidden = true;

  if (coverImage?.url) {
    const image = document.createElement("img");
    image.className = "property-image";
    image.src = coverImage.url;
    image.alt = coverImage.alt_text || `Foto de capa: ${property.title}`;
    image.loading = "lazy";
    image.width = 720;
    image.height = 480;
    image.addEventListener("error", () => {
      image.hidden = true;
      imageFallback.hidden = false;
    });
    imageLink.append(image);
  } else {
    imageFallback.hidden = false;
  }

  const label = document.createElement("span");
  label.className = "property-label";
  label.textContent = getPropertyLabel(property);

  const arrow = document.createElement("span");
  arrow.className = "image-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  imageLink.append(imageFallback, label, arrow);

  const content = document.createElement("div");
  content.className = "property-content";

  const location = document.createElement("p");
  location.className = "property-location";
  location.textContent = getLocation(property);

  const title = document.createElement("h3");
  title.textContent = property.title;

  const price = document.createElement("p");
  price.className = "property-price";
  price.textContent = formatCurrency(property.price);

  const facts = document.createElement("div");
  facts.className = "property-facts";
  facts.setAttribute("aria-label", "Características principais");

  const factItems = [
    property.bedrooms === null ? null : createFact(String(property.bedrooms), "quartos"),
    property.suites === null ? null : createFact(String(property.suites), "suítes"),
    formatArea(property.built_area)
      ? createFact(formatArea(property.built_area), "construídos")
      : null,
    formatArea(property.land_area)
      ? createFact(formatArea(property.land_area), "terreno")
      : null,
    property.bathrooms === null
      ? null
      : createFact(String(property.bathrooms), "banheiros"),
  ].filter(Boolean);
  factItems.slice(0, 3).forEach((fact) => facts.append(fact));

  const cta = document.createElement("span");
  cta.className = "property-cta";
  cta.append(document.createTextNode("Ver detalhes"));

  const ctaArrow = document.createElement("span");
  ctaArrow.setAttribute("aria-hidden", "true");
  ctaArrow.textContent = "→";
  cta.append(ctaArrow);

  content.append(location, title, price, facts, cta);
  card.append(imageLink, content);
  return card;
}

function setListStatus(message) {
  propertyListStatus.textContent = message;
  propertyListStatus.hidden = !message;
}

async function loadPublishedProperties() {
  if (!window.FERNANDO_SUPABASE) {
    throw new Error("Cliente Supabase não encontrado.");
  }

  const { data: properties, error: propertiesError } = await window.FERNANDO_SUPABASE
    .from("properties")
    .select(
      "id, slug, title, description, property_type, purpose, price, city, state, neighborhood, built_area, land_area, bedrooms, suites, bathrooms, created_at",
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (propertiesError) throw propertiesError;

  if (properties.length === 0) {
    setListStatus("No momento, não há imóveis publicados.");
    return;
  }

  const { data: images, error: imagesError } = await window.FERNANDO_SUPABASE
    .from("property_images")
    .select("id, property_id, storage_path, alt_text, sort_order, is_cover, created_at")
    .in("property_id", properties.map((property) => property.id))
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const coverByProperty = new Map();
  let imageQueryFailed = false;

  if (imagesError) {
    imageQueryFailed = true;
    console.error("Falha ao consultar fotos dos imóveis publicados.", imagesError);
  } else {
    const imagesByProperty = new Map();
    images.forEach((image) => {
      const propertyImages = imagesByProperty.get(image.property_id) || [];
      propertyImages.push(image);
      imagesByProperty.set(image.property_id, propertyImages);
    });

    const coverImages = properties
      .map((property) => {
        const propertyImages = imagesByProperty.get(property.id) || [];
        return propertyImages.find((image) => image.is_cover) || propertyImages[0];
      })
      .filter(Boolean);

    const signedCovers = await Promise.all(
      coverImages.map(async (image) => {
        const { data, error } = await window.FERNANDO_SUPABASE
          .storage
          .from("property-images")
          .createSignedUrl(image.storage_path, 3600);

        if (error || !data?.signedUrl) {
          console.error(
            `Falha ao gerar URL assinada para a foto ${image.id}.`,
            error || new Error("O Storage não retornou uma URL assinada."),
          );
          return null;
        }

        return { ...image, url: data.signedUrl };
      }),
    );

    signedCovers.filter(Boolean).forEach((image) => {
      coverByProperty.set(image.property_id, image);
    });
  }

  const cards = properties.map((property) =>
    createPropertyCard(property, coverByProperty.get(property.id)),
  );
  propertyGrid.replaceChildren(...cards);
  observeRevealItems(cards);

  const failedCoverCount = properties.filter(
    (property) => !coverByProperty.has(property.id),
  ).length;

  if (imageQueryFailed) {
    setListStatus("Os imóveis foram carregados, mas não foi possível consultar as fotos.");
  } else if (failedCoverCount > 0) {
    setListStatus(
      "Os imóveis foram carregados, mas algumas imagens de capa estão indisponíveis.",
    );
  } else {
    setListStatus("");
  }
}

loadPublishedProperties().catch((error) => {
  console.error("Falha ao carregar imóveis publicados.", error);
  setListStatus("Não foi possível carregar os imóveis. Tente novamente mais tarde.");
});
