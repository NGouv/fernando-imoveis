const photoSets = {
  casa1: [
    "WhatsApp Image 2026-10-09 at 22.07.29.jpeg",
    "WhatsApp Image 2026-10-09 at 22.07.30.jpeg",
    "WhatsApp Image 2026-10-09 at 22.07.30 (1).jpeg",
    "WhatsApp Image 2026-10-09 at 22.07.30 (2).jpeg",
    "WhatsApp Image 2026-10-09 at 22.07.30 (3).jpeg",
    "WhatsApp Image 2026-10-09 at 22.07.31.jpeg",
    "WhatsApp Image 2026-10-09 at 22.07.31 (1).jpeg",
  ],
  casa2: [
    "WhatsApp Image 2026-10-09 at 22.10.37.jpeg",
    "WhatsApp Image 2026-10-09 at 22.10.38.jpeg",
    "WhatsApp Image 2026-10-09 at 22.10.38 (1).jpeg",
    "WhatsApp Image 2026-10-09 at 22.10.39.jpeg",
    "WhatsApp Image 2026-10-09 at 22.10.39 (1).jpeg",
    "WhatsApp Image 2026-10-09 at 22.10.39 (2).jpeg",
    "WhatsApp Image 2026-10-09 at 22.10.39 (3).jpeg",
    "WhatsApp Image 2026-10-09 at 22.10.39 (4).jpeg",
  ],
  casa3: [
    "WhatsApp Image 2026-10-09 at 22.20.14.jpeg",
    "WhatsApp Image 2026-10-09 at 22.20.14 (1).jpeg",
    "WhatsApp Image 2026-10-09 at 22.20.14 (2).jpeg",
    "WhatsApp Image 2026-10-09 at 22.20.14 (3).jpeg",
    "WhatsApp Image 2026-10-09 at 22.20.15.jpeg",
    "WhatsApp Image 2026-10-09 at 22.20.16.jpeg",
    "WhatsApp Image 2026-10-09 at 22.20.16 (1).jpeg",
    "WhatsApp Image 2026-10-09 at 22.20.16 (2).jpeg",
    "WhatsApp Image 2026-10-09 at 22.20.16 (3).jpeg",
    "WhatsApp Image 2026-10-09 at 22.20.16 (4).jpeg",
  ],
};

const properties = {
  casa1: {
    title: "Casa no Parqville Pinheiros",
    location: "Aparecida de Goiânia · Parqville Pinheiros",
    price: "R$ 1.300.000",
    builtArea: "163 m²",
    landArea: "338 m²",
    bedrooms: "Não informado",
    suites: "3 suítes, sendo uma master com closet",
    bathrooms: "Não informado",
    description:
      "Casa com 163 m² de área construída em terreno de 338 m². Possui 3 suítes, sendo uma master com closet, sala com pé-direito duplo, cozinha gourmet com ilha e piscina aquecida.",
    features: [
      "Sala com pé-direito duplo",
      "Cozinha gourmet com ilha",
      "Piscina aquecida",
    ],
  },
  casa2: {
    title: "Casa no Residencial Santa Efigênia",
    location: "Goiânia · Residencial Santa Efigênia",
    price: "R$ 225.000",
    builtArea: "65,83 m²",
    landArea: "Não informado",
    bedrooms: "2 quartos",
    suites: "1 suíte",
    bathrooms: "2 banheiros",
    description:
      "Casa com 65,83 m² de área construída, 2 quartos, sendo 1 suíte, 2 banheiros e área gourmet com varanda.",
    features: ["Área gourmet com varanda"],
  },
  casa3: {
    title: "Casa no Residencial Terrabela Cerrado",
    location: "Senador Canedo · Residencial Terrabela Cerrado",
    price: "R$ 290.000",
    builtArea: "85,77 m²",
    landArea: "125 m²",
    bedrooms: "3 quartos",
    suites: "1 suíte",
    bathrooms: "Não informado",
    description:
      "Casa com 85,77 m² de área construída em terreno de 125 m². Possui 3 quartos, sendo 1 suíte, garagem coberta e área gourmet.",
    features: ["Garagem coberta", "Área gourmet"],
  },
};

const propertyContainer = document.querySelector("#property-details");
const errorContainer = document.querySelector("#detail-error");
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

function imagePath(propertyId, filename) {
  return `assets/images/${propertyId}/${encodeURIComponent(filename)}`;
}

function renderProperty(propertyId) {
  const property = properties[propertyId];
  const photos = photoSets[propertyId];

  if (!property || !photos) {
    errorContainer.hidden = false;
    document.title = "Imóvel não encontrado | Fernando Bentivoglio";
    return;
  }

  propertyContainer.hidden = false;
  document.title = `${property.title} | Fernando Bentivoglio`;
  document.querySelector("#detail-location").textContent = property.location;
  document.querySelector("#detail-title").textContent = property.title;
  document.querySelector("#detail-price").textContent = property.price;
  document.querySelector("#detail-sidebar-price").textContent = property.price;
  document.querySelector("#detail-sidebar-location").textContent = property.location;
  document.querySelector("#detail-description").textContent = property.description;

  const mainImage = document.querySelector("#detail-main-image");
  const thumbnails = document.querySelector("#detail-thumbnails");
  const photoCount = document.querySelector("#detail-photo-count");
  photoCount.textContent = `${photos.length} fotos`;

  photos.forEach((filename, index) => {
    const source = imagePath(propertyId, filename);
    const thumbnail = document.createElement("button");
    const thumbnailImage = document.createElement("img");

    thumbnail.className = "detail-thumbnail";
    thumbnail.type = "button";
    thumbnail.setAttribute("aria-label", `Exibir foto ${index + 1} de ${photos.length}`);
    thumbnail.setAttribute("aria-pressed", String(index === 0));
    thumbnailImage.src = source;
    thumbnailImage.alt = "";
    thumbnailImage.loading = "lazy";
    thumbnail.append(thumbnailImage);
    thumbnail.addEventListener("click", () => {
      mainImage.src = source;
      mainImage.alt = `Foto ${index + 1} do imóvel: ${property.title}`;
      photoCount.textContent = `Foto ${index + 1} de ${photos.length}`;
      thumbnails.querySelectorAll(".detail-thumbnail").forEach((item) => {
        item.setAttribute("aria-pressed", String(item === thumbnail));
      });
    });
    thumbnails.append(thumbnail);
  });

  mainImage.src = imagePath(propertyId, photos[0]);
  mainImage.alt = `Foto 1 do imóvel: ${property.title}`;

  const facts = document.querySelector("#detail-facts");
  [
    ["Localização", property.location],
    ["Área construída", property.builtArea],
    ["Terreno", property.landArea],
    ["Quartos", property.bedrooms],
    ["Suítes", property.suites],
    ["Banheiros", property.bathrooms],
  ].forEach(([label, value]) => facts.append(createFact(label, value)));

  const featuresSection = document.querySelector("#detail-features-section");
  const featureList = document.querySelector("#detail-features");
  featuresSection.hidden = property.features.length === 0;
  property.features.forEach((feature) => {
    const item = document.createElement("li");
    item.textContent = feature;
    featureList.append(item);
  });

}

const propertyId = new URLSearchParams(window.location.search).get("id");
renderProperty(propertyId);
