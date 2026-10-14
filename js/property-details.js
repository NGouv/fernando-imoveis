const propertyContainer = document.querySelector("#property-details");
const errorContainer = document.querySelector("#detail-error");
const loadingMessage = document.querySelector("#detail-loading");
const galleryStatus = document.querySelector("#detail-gallery-status");

function createFact(label, value) {
  const item = document.createElement("div");
  item.className = "detail-fact";

  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  item.append(term, description);
  return item;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatArea(value) {
  if (value === null || value === undefined) return "Não informado";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)} m²`;
}

function formatCount(value, singular, plural) {
  if (value === null || value === undefined) return "Não informado";
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatLocation(property) {
  const city = [property.city, property.state].filter(Boolean).join(" / ");
  return [city, property.neighborhood].filter(Boolean).join(" · ");
}

function showError(title, message) {
  loadingMessage.hidden = true;
  propertyContainer.hidden = true;
  errorContainer.querySelector("h1").textContent = title;
  errorContainer.querySelector("p").textContent = message;
  errorContainer.hidden = false;
  document.title = `${title} | Fernando Bentivoglio`;
}

function setGalleryStatus(message) {
  galleryStatus.textContent = message;
  galleryStatus.hidden = !message;
}

function renderGallery(photos, property) {
  const mainImage = document.querySelector("#detail-main-image");
  const thumbnails = document.querySelector("#detail-thumbnails");
  const photoCount = document.querySelector("#detail-photo-count");
  const failedPhotos = new Set();
  const thumbnailById = new Map();

  thumbnails.replaceChildren();
  if (photos.length === 0) {
    mainImage.hidden = true;
    photoCount.hidden = true;
    photoCount.textContent = "0 fotos";
    setGalleryStatus("Este imóvel ainda não possui fotos disponíveis.");
    return;
  }

  photoCount.hidden = false;
  photoCount.textContent = `${photos.length} fotos`;

  function selectPhoto(photo) {
    if (failedPhotos.has(photo.id)) return;

    const index = photos.findIndex((item) => item.id === photo.id);
    mainImage.dataset.photoId = photo.id;
    mainImage.hidden = false;
    mainImage.alt = photo.alt_text || `Foto do imóvel: ${property.title}`;
    mainImage.src = photo.url;
    photoCount.textContent = `Foto ${index + 1} de ${photos.length}`;

    thumbnailById.forEach((button, photoId) => {
      button.setAttribute("aria-pressed", String(photoId === photo.id));
    });
  }

  function selectNextPhoto() {
    const nextPhoto = photos.find((photo) => !failedPhotos.has(photo.id));
    if (nextPhoto) {
      selectPhoto(nextPhoto);
      return;
    }

    mainImage.hidden = true;
    photoCount.textContent = "Fotos indisponíveis";
    setGalleryStatus("Não foi possível carregar as fotos deste imóvel.");
  }

  photos.forEach((photo, index) => {
    const thumbnail = document.createElement("button");
    const thumbnailImage = document.createElement("img");

    thumbnail.className = "detail-thumbnail";
    thumbnail.type = "button";
    thumbnail.setAttribute("aria-label", `Exibir foto ${index + 1} de ${photos.length}`);
    thumbnail.setAttribute("aria-pressed", "false");
    thumbnailImage.src = photo.url;
    thumbnailImage.alt = photo.alt_text || "";
    thumbnailImage.loading = "lazy";
    thumbnail.append(thumbnailImage);
    thumbnail.addEventListener("click", () => selectPhoto(photo));
    thumbnailImage.addEventListener("error", () => {
      if (failedPhotos.has(photo.id)) return;
      failedPhotos.add(photo.id);
      thumbnail.hidden = true;
      setGalleryStatus("Não foi possível carregar uma ou mais fotos deste imóvel.");
      if (mainImage.dataset.photoId === photo.id) selectNextPhoto();
    });

    thumbnailById.set(photo.id, thumbnail);
    thumbnails.append(thumbnail);
  });

  mainImage.addEventListener("error", () => {
    const failedPhotoId = mainImage.dataset.photoId;
    if (!failedPhotoId || failedPhotos.has(failedPhotoId)) return;

    failedPhotos.add(failedPhotoId);
    const failedThumbnail = thumbnailById.get(failedPhotoId);
    if (failedThumbnail) failedThumbnail.hidden = true;
    setGalleryStatus("Não foi possível carregar uma ou mais fotos deste imóvel.");
    selectNextPhoto();
  });

  const cover = photos.find((photo) => photo.is_cover) || photos[0];
  selectPhoto(cover);
}

function renderProperty(property, photos) {
  const location = formatLocation(property);
  const facts = document.querySelector("#detail-facts");
  const featuresSection = document.querySelector("#detail-features-section");
  const featureList = document.querySelector("#detail-features");
  const features = Array.isArray(property.features) ? property.features : [];

  loadingMessage.hidden = true;
  errorContainer.hidden = true;
  propertyContainer.hidden = false;
  document.title = `${property.title} | Fernando Bentivoglio`;
  document.querySelector("#detail-location").textContent = location;
  document.querySelector("#detail-title").textContent = property.title;
  document.querySelector("#detail-price").textContent = formatCurrency(property.price);
  document.querySelector("#detail-sidebar-price").textContent = formatCurrency(property.price);
  document.querySelector("#detail-sidebar-location").textContent = location;
  document.querySelector("#detail-description").textContent =
    property.description || "Descrição não informada.";

  facts.replaceChildren();
  [
    ["Localização", location || "Não informada"],
    ["Área construída", formatArea(property.built_area)],
    ["Terreno", formatArea(property.land_area)],
    ["Quartos", formatCount(property.bedrooms, "quarto", "quartos")],
    ["Suítes", formatCount(property.suites, "suíte", "suítes")],
    ["Banheiros", formatCount(property.bathrooms, "banheiro", "banheiros")],
  ].forEach(([label, value]) => facts.append(createFact(label, value)));

  featureList.replaceChildren();
  featuresSection.hidden = features.length === 0;
  features.forEach((feature) => {
    const item = document.createElement("li");
    item.textContent = feature;
    featureList.append(item);
  });

  renderGallery(photos, property);
}

async function loadProperty(slug) {
  if (!slug) {
    showError(
      "Imóvel não encontrado",
      "Escolha um dos imóveis disponíveis na página inicial.",
    );
    return;
  }

  if (!window.FERNANDO_SUPABASE) {
    showError(
      "Não foi possível carregar o imóvel",
      "A conexão com o serviço de imóveis não está disponível no momento.",
    );
    console.error("Cliente Supabase não encontrado em window.FERNANDO_SUPABASE.");
    return;
  }

  const { data: property, error: propertyError } = await window.FERNANDO_SUPABASE
    .from("properties")
    .select(
      "id, slug, title, description, price, city, state, neighborhood, built_area, land_area, bedrooms, suites, bathrooms, features",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (propertyError) {
    console.error("Falha ao consultar o imóvel.", propertyError);
    showError(
      "Não foi possível carregar o imóvel",
      "Ocorreu um erro ao consultar os dados. Tente novamente mais tarde.",
    );
    return;
  }

  if (!property) {
    showError(
      "Imóvel não encontrado",
      "Este imóvel não está disponível. Escolha um dos imóveis publicados na página inicial.",
    );
    return;
  }

  const { data: imageRows, error: imagesError } = await window.FERNANDO_SUPABASE
    .from("property_images")
    .select("id, storage_path, alt_text, sort_order, is_cover, created_at")
    .eq("property_id", property.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (imagesError) {
    console.error("Falha ao consultar as fotos do imóvel.", imagesError);
    renderProperty(property, []);
    setGalleryStatus("Não foi possível consultar as fotos deste imóvel.");
    return;
  }

  const signedResults = await Promise.all(
    imageRows.map(async (image) => {
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
  const photos = signedResults.filter(Boolean);

  renderProperty(property, photos);
  if (photos.length < imageRows.length) {
    setGalleryStatus("Não foi possível preparar uma ou mais fotos deste imóvel.");
  }
}

const propertySlug = new URLSearchParams(window.location.search).get("id");
loadProperty(propertySlug).catch((error) => {
  console.error("Erro inesperado ao carregar os detalhes do imóvel.", error);
  showError(
    "Não foi possível carregar o imóvel",
    "Ocorreu um erro inesperado. Tente novamente mais tarde.",
  );
});
