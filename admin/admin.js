const supabaseClient = window.FERNANDO_SUPABASE;
const authStatus = document.querySelector("#auth-status");
const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#login-form");
const emailInput = document.querySelector("#login-email");
const passwordInput = document.querySelector("#login-password");
const loginSubmit = document.querySelector("#login-submit");
const authMessage = document.querySelector("#auth-message");
const dashboardMessage = document.querySelector("#dashboard-message");
const logoutButton = document.querySelector("#logout-button");
const propertyList = document.querySelector("#property-list");
const propertyListStatus = document.querySelector("#property-list-status");
const propertyForm = document.querySelector("#property-form");
const propertyFormMessage = document.querySelector("#property-form-message");
const propertyTitleInput = document.querySelector("#property-title");
const propertySlugInput = document.querySelector("#property-slug");
const propertyCityInput = document.querySelector("#property-city");
const showPropertyFormButton = document.querySelector("#show-property-form");
const refreshPropertiesButton = document.querySelector("#refresh-properties");
const savePropertyButton = document.querySelector("#save-property");
const propertyFormEyebrow = document.querySelector("#property-form-eyebrow");
const propertyFormTitle = document.querySelector("#property-form-title");
const photoManagerDialog = document.querySelector("#photo-manager-dialog");
const photoManagerTitle = document.querySelector("#photo-manager-title");
const closePhotoManagerButton = document.querySelector("#close-photo-manager");
const photoManagerStatus = document.querySelector("#photo-manager-status");
const photoUploadForm = document.querySelector("#photo-upload-form");
const photoFileInput = document.querySelector("#photo-file-input");
const photoPreviewList = document.querySelector("#photo-preview-list");
const uploadPhotosButton = document.querySelector("#upload-photos");
const photoGalleryStatus = document.querySelector("#photo-gallery-status");
const photoGallery = document.querySelector("#photo-gallery");

const authTimeoutMs = 10000;
const maxImageSize = 10 * 1024 * 1024;
const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);
let hasVerifiedAdminSession = false;
let endingSession = false;
let authFlowId = 0;
let propertySlugWasEdited = false;
let editingPropertyId = null;
let propertiesById = new Map();
let activePhotoProperty = null;
let activePhotos = [];
let selectedPhotoFiles = [];
let previewObjectUrls = [];
let photoOperationInProgress = false;

function withAuthTimeout(operation, message) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), authTimeoutMs);

    Promise.resolve(operation).then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function setPhotoManagerStatus(message, kind = "error") {
  photoManagerStatus.textContent = message;
  photoManagerStatus.dataset.kind = kind;
  photoManagerStatus.hidden = !message;
}

function revokePreviewObjectUrls() {
  previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  previewObjectUrls = [];
}

function clearPhotoSelection() {
  selectedPhotoFiles = [];
  photoFileInput.value = "";
  revokePreviewObjectUrls();
  photoPreviewList.replaceChildren();
  uploadPhotosButton.disabled = true;
}

function validatePhotoFiles(files) {
  const errors = [];

  files.forEach((file) => {
    if (!allowedImageTypes.has(file.type)) {
      errors.push(`“${file.name}”: formato não permitido. Use JPEG, PNG, WebP ou AVIF.`);
    }
    if (file.size > maxImageSize) {
      errors.push(`“${file.name}”: excede o limite de 10 MB por imagem.`);
    }
    if (file.size === 0) {
      errors.push(`“${file.name}”: o arquivo está vazio.`);
    }
  });

  return errors;
}

function renderPhotoPreviews(files) {
  revokePreviewObjectUrls();
  photoPreviewList.replaceChildren();

  const previewItems = files.map((file) => {
    const item = document.createElement("li");
    item.className = "photo-preview-item";
    const image = document.createElement("img");
    const url = URL.createObjectURL(file);
    previewObjectUrls.push(url);
    image.src = url;
    image.alt = `Pré-visualização: ${file.name}`;
    const name = document.createElement("span");
    name.className = "photo-preview-name";
    name.textContent = file.name;
    item.append(image, name);
    return item;
  });
  photoPreviewList.replaceChildren(...previewItems);
}

function describePhotoError(error) {
  if (
    error?.code === "42501" ||
    error?.status === 401 ||
    error?.status === 403 ||
    error?.statusCode === "403"
  ) {
    return "A operação foi recusada pelas políticas do Supabase. Confirme sua sessão administrativa e as políticas do bucket e das tabelas.";
  }
  if (error?.code === "23505") {
    return "O registro desta imagem já existe. Atualize a galeria antes de tentar novamente.";
  }
  if (error?.code === "23514" || error?.code === "22P02") {
    return "Os dados da imagem não atendem às regras do banco. Confirme o imóvel e o caminho do arquivo.";
  }
  return "Não foi possível concluir a operação de fotos. Verifique a conexão e tente novamente.";
}

function setPhotoGalleryStatus(message) {
  photoGalleryStatus.textContent = message;
}

function createPhotoGalleryItem(photo) {
  const item = document.createElement("li");
  item.className = "photo-gallery-item";
  item.dataset.cover = String(photo.is_cover);

  if (photo.url) {
    const image = document.createElement("img");
    image.src = photo.url;
    image.alt = photo.alt_text || "Foto do imóvel";
    image.loading = "lazy";
    item.append(image);
  } else {
    const unavailable = document.createElement("p");
    unavailable.className = "photo-gallery-status";
    unavailable.textContent = "Prévia indisponível; a foto ainda pode ser removida.";
    item.append(unavailable);
  }

  if (photo.is_cover) {
    const badge = document.createElement("span");
    badge.className = "photo-cover-badge";
    badge.textContent = "Capa atual";
    item.append(badge);
  }

  const actions = document.createElement("div");
  actions.className = "photo-gallery-actions";
  const coverButton = document.createElement("button");
  coverButton.className = "admin-button admin-button-secondary";
  coverButton.type = "button";
  coverButton.dataset.photoAction = "cover";
  coverButton.dataset.photoId = photo.id;
  coverButton.textContent = photo.is_cover ? "Capa atual" : "Definir como capa";
  coverButton.disabled = photo.is_cover || photoOperationInProgress;

  const removeButton = document.createElement("button");
  removeButton.className = "admin-button admin-button-secondary";
  removeButton.type = "button";
  removeButton.dataset.photoAction = "remove";
  removeButton.dataset.photoId = photo.id;
  removeButton.textContent = "Remover foto";
  removeButton.disabled = photoOperationInProgress;

  actions.append(coverButton, removeButton);
  item.append(actions);
  return item;
}

async function loadManagedPhotos() {
  if (!activePhotoProperty) return;

  setPhotoGalleryStatus("Carregando fotos…");
  photoGallery.replaceChildren();

  try {
    const { data, error } = await withAuthTimeout(
      supabaseClient
        .from("property_images")
        .select("id, property_id, storage_path, alt_text, sort_order, is_cover, created_at")
        .eq("property_id", activePhotoProperty.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      "A consulta das fotos excedeu o tempo limite.",
    );
    if (error) throw error;

    const signedPhotos = await Promise.all(
      (data || []).map(async (photo) => {
        try {
          const { data: signedData, error: signedError } = await supabaseClient
            .storage
            .from("property-images")
            .createSignedUrl(photo.storage_path, 3600);
          if (signedError || !signedData?.signedUrl) {
            throw signedError || new Error("O Storage não retornou uma URL assinada.");
          }
          return { ...photo, url: signedData.signedUrl };
        } catch (error) {
          console.error(`Falha ao gerar URL assinada para a foto ${photo.id}.`, error);
          return { ...photo, url: null };
        }
      }),
    );

    activePhotos = signedPhotos;
    photoGallery.replaceChildren(...signedPhotos.map(createPhotoGalleryItem));
    const unavailableCount = signedPhotos.filter((photo) => !photo.url).length;
    if (signedPhotos.length === 0) {
      setPhotoGalleryStatus("Este imóvel ainda não tem fotos salvas.");
    } else if (unavailableCount > 0) {
      setPhotoGalleryStatus(
        `${signedPhotos.length} ${signedPhotos.length === 1 ? "foto salva" : "fotos salvas"}; não foi possível preparar ${unavailableCount === 1 ? "uma prévia" : `${unavailableCount} prévias`}.`,
      );
    } else {
      setPhotoGalleryStatus(
        `${signedPhotos.length} ${signedPhotos.length === 1 ? "foto salva." : "fotos salvas."}`,
      );
    }
  } catch (error) {
    console.error("Falha ao carregar as fotos do imóvel.", error);
    activePhotos = [];
    photoGallery.replaceChildren();
    setPhotoGalleryStatus(describePhotoError(error));
  }
}

async function openPhotoManager(property) {
  activePhotoProperty = property;
  activePhotos = [];
  clearPhotoSelection();
  setPhotoManagerStatus("");
  photoManagerTitle.textContent = `Gerenciar fotos — ${property.title}`;
  photoManagerDialog.showModal();
  await loadManagedPhotos();
}

function getSafeStoragePath(photo) {
  const expectedPrefix = `${activePhotoProperty.id}/`;
  const path = photo.storage_path;
  if (
    photo.property_id !== activePhotoProperty.id ||
    typeof path !== "string" ||
    !path.startsWith(expectedPrefix) ||
    path.slice(expectedPrefix.length).length === 0 ||
    path.slice(expectedPrefix.length).includes("/")
  ) {
    throw new Error("O caminho da foto não corresponde ao imóvel selecionado.");
  }
  return path;
}

async function setPhotoAsCover(photo) {
  if (!activePhotoProperty || photoOperationInProgress) return;
  let storagePath;
  try {
    storagePath = getSafeStoragePath(photo);
  } catch (error) {
    console.error("Caminho inválido ao definir a capa.", error);
    setPhotoManagerStatus("A foto não corresponde a este imóvel. Atualize a galeria antes de tentar novamente.");
    return;
  }

  photoOperationInProgress = true;
  photoGallery.replaceChildren(...activePhotos.map(createPhotoGalleryItem));
  setPhotoManagerStatus("Atualizando a capa…");
  try {
    const { data, error } = await withAuthTimeout(
      supabaseClient
        .from("property_images")
        .update({ is_cover: true })
        .eq("id", photo.id)
        .eq("property_id", activePhotoProperty.id)
        .eq("storage_path", storagePath)
        .select("id"),
      "A atualização da capa excedeu o tempo limite.",
    );
    if (error) throw error;
    if (data?.length !== 1) {
      throw new Error("O banco não confirmou a atualização da capa.");
    }
    await loadManagedPhotos();
    setPhotoManagerStatus("A capa foi atualizada.", "success");
  } catch (error) {
    console.error("Falha ao definir a capa do imóvel.", error);
    setPhotoManagerStatus(describePhotoError(error));
  } finally {
    photoOperationInProgress = false;
    photoGallery.replaceChildren(...activePhotos.map(createPhotoGalleryItem));
  }
}

async function deletePhotoMetadata(photo, storagePath) {
  const deleteRecord = () => withAuthTimeout(
    supabaseClient
      .from("property_images")
      .delete()
      .eq("id", photo.id)
      .eq("property_id", activePhotoProperty.id)
      .eq("storage_path", storagePath)
      .select("id"),
    "A exclusão do registro excedeu o tempo limite.",
  );
  const findRecord = () => withAuthTimeout(
    supabaseClient
      .from("property_images")
      .select("id")
      .eq("id", photo.id)
      .eq("property_id", activePhotoProperty.id)
      .eq("storage_path", storagePath)
      .maybeSingle(),
    "A verificação da exclusão excedeu o tempo limite.",
  );

  let result;
  try {
    result = await deleteRecord();
  } catch (error) {
    result = { data: null, error };
  }
  if (!result.error && result.data?.length === 1) return;

  let verification = await findRecord();
  if (verification.error) throw verification.error;
  if (!verification.data) return;

  try {
    result = await deleteRecord();
  } catch (error) {
    result = { data: null, error };
  }
  if (!result.error && result.data?.length === 1) return;

  verification = await findRecord();
  if (verification.error) throw verification.error;
  if (verification.data) {
    throw result.error || new Error("O banco não confirmou a exclusão do registro.");
  }
}

async function removeManagedPhoto(photo) {
  if (!activePhotoProperty || photoOperationInProgress) return;
  let storagePath;
  try {
    storagePath = getSafeStoragePath(photo);
  } catch (error) {
    console.error("Caminho inválido ao remover a foto.", error);
    setPhotoManagerStatus("A foto não corresponde a este imóvel. Atualize a galeria antes de tentar novamente.");
    return;
  }

  if (!window.confirm("Remover esta foto do imóvel? Esta ação não pode ser desfeita.")) return;

  photoOperationInProgress = true;
  photoGallery.replaceChildren(...activePhotos.map(createPhotoGalleryItem));
  setPhotoManagerStatus("Removendo a foto do armazenamento…");
  let storageRemoved = false;
  try {
    const { error: storageError } = await supabaseClient
      .storage
      .from("property-images")
      .remove([storagePath]);
    if (storageError) throw storageError;
    storageRemoved = true;

    await deletePhotoMetadata(photo, storagePath);

    await loadManagedPhotos();
    setPhotoManagerStatus("A foto foi removida com sucesso.", "success");
  } catch (error) {
    console.error("Falha ao remover a foto do imóvel.", error);
    setPhotoManagerStatus(
      storageRemoved
        ? "O arquivo foi removido do Storage, mas não foi possível confirmar a remoção do registro. Atualize a galeria antes de tentar novamente."
        : describePhotoError(error),
    );
    if (storageRemoved) await loadManagedPhotos();
  } finally {
    photoOperationInProgress = false;
    photoGallery.replaceChildren(...activePhotos.map(createPhotoGalleryItem));
  }
}

async function uploadSelectedPhotos() {
  if (!activePhotoProperty || photoOperationInProgress || selectedPhotoFiles.length === 0) return;

  const files = [...selectedPhotoFiles];
  photoOperationInProgress = true;
  uploadPhotosButton.disabled = true;
  photoFileInput.disabled = true;

  let nextOrder = activePhotos.reduce(
    (maximum, photo) => Math.max(maximum, photo.sort_order),
    -1,
  ) + 1;
  let hasCover = activePhotos.some((photo) => photo.is_cover);
  let uploadedCount = 0;
  const failures = [];

  for (const [index, file] of files.entries()) {
    setPhotoManagerStatus(`Enviando ${index + 1} de ${files.length}: ${file.name}…`);
    let storagePath;
    let uploaded = false;
    let metadataMayExist = false;
    try {
      if (!window.crypto || typeof window.crypto.randomUUID !== "function") {
        throw new Error("Este navegador não disponibiliza geração segura de nomes únicos.");
      }
      if (nextOrder > 2147483647) {
        throw new Error("A galeria atingiu o limite de ordenação permitido.");
      }
      const extension = allowedImageTypes.get(file.type);
      storagePath = `${activePhotoProperty.id}/${window.crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabaseClient
        .storage
        .from("property-images")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      uploaded = true;

      const { error: insertError } = await supabaseClient
        .from("property_images")
        .insert({
          property_id: activePhotoProperty.id,
          storage_path: storagePath,
          alt_text: "",
          sort_order: nextOrder,
          is_cover: !hasCover,
        });
      if (insertError) {
        const { data: existingMetadata, error: verificationError } = await supabaseClient
          .from("property_images")
          .select("id")
          .eq("property_id", activePhotoProperty.id)
          .eq("storage_path", storagePath)
          .maybeSingle();
        if (verificationError) {
          metadataMayExist = true;
          throw new Error(
            "Não foi possível confirmar se o registro da foto foi salvo.",
            { cause: verificationError },
          );
        }
        if (!existingMetadata) throw insertError;
      }

      uploadedCount += 1;
      nextOrder += 1;
      hasCover = true;
    } catch (error) {
      console.error(`Falha ao enviar a foto “${file.name}”.`, error);
      let message = describePhotoError(error);
      if (metadataMayExist) {
        message = "Não foi possível confirmar se o registro foi salvo. O arquivo foi mantido no Storage para evitar quebrar uma possível referência; atualize a galeria antes de tentar novamente.";
      } else if (uploaded && storagePath) {
        try {
          const { error: cleanupError } = await supabaseClient
            .storage
            .from("property-images")
            .remove([storagePath]);
          if (cleanupError) throw cleanupError;
        } catch (cleanupError) {
          console.error(`Falha ao limpar o arquivo órfão ${storagePath}.`, cleanupError);
          message = "O cadastro da foto falhou e o arquivo enviado não pôde ser removido do Storage. Solicite a limpeza manual deste objeto.";
        }
      }
      failures.push(`“${file.name}”: ${message}`);
    }
  }

  clearPhotoSelection();
  await loadManagedPhotos();
  if (failures.length === 0) {
    setPhotoManagerStatus(
      `${uploadedCount} ${uploadedCount === 1 ? "foto enviada" : "fotos enviadas"} com sucesso.`,
      "success",
    );
  } else {
    const successMessage = uploadedCount
      ? `${uploadedCount} ${uploadedCount === 1 ? "foto enviada" : "fotos enviadas"}; `
      : "";
    setPhotoManagerStatus(`${successMessage}falha(s): ${failures.join(" ")}`);
  }

  photoOperationInProgress = false;
  photoFileInput.disabled = false;
  photoGallery.replaceChildren(...activePhotos.map(createPhotoGalleryItem));
}

function showLogin(message = "") {
  authStatus.hidden = true;
  loginView.hidden = false;
  dashboardView.hidden = true;
  authMessage.textContent = message;
  authMessage.hidden = !message;
  dashboardMessage.textContent = "";
  dashboardMessage.hidden = true;
}

function showChecking(message) {
  loginView.hidden = true;
  dashboardView.hidden = true;
  authStatus.textContent = message;
  authStatus.hidden = false;
}

function showDashboard() {
  authStatus.hidden = true;
  authMessage.textContent = "";
  authMessage.hidden = true;
  dashboardMessage.textContent = "";
  dashboardMessage.hidden = true;
  loginView.hidden = true;
  dashboardView.hidden = false;
}

function generateSlug(title) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatPropertyPrice(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function createPropertyListItem(property) {
  const item = document.createElement("li");
  item.className = "property-list-item";

  const details = document.createElement("div");
  const title = document.createElement("p");
  title.className = "property-list-title";
  title.textContent = property.title;

  const metadata = document.createElement("div");
  metadata.className = "property-list-meta";
  const city = document.createElement("span");
  city.textContent = [property.city, property.state].filter(Boolean).join(" / ");
  const price = document.createElement("span");
  price.textContent = formatPropertyPrice(property.price);
  metadata.append(city, price);
  details.append(title, metadata);

  const status = document.createElement("span");
  status.className = "property-status-badge";
  status.dataset.status = property.status;
  status.textContent = {
    draft: "Rascunho",
    published: "Publicado",
    archived: "Arquivado",
  }[property.status] || "Status desconhecido";

  const managePhotos = document.createElement("button");
  managePhotos.className = "admin-button admin-button-secondary";
  managePhotos.type = "button";
  managePhotos.dataset.propertyId = property.id;
  managePhotos.dataset.propertyAction = "photos";
  managePhotos.textContent = "Gerenciar fotos";

  const editProperty = document.createElement("button");
  editProperty.className = "admin-button admin-button-secondary";
  editProperty.type = "button";
  editProperty.dataset.propertyId = property.id;
  editProperty.dataset.propertyAction = "edit";
  editProperty.textContent = "Editar imóvel";

  const actions = document.createElement("div");
  actions.className = "property-list-actions";
  actions.append(editProperty, managePhotos);

  item.append(details, status, actions);
  return item;
}

function describePropertyError(error) {
  if (error.code === "23505") {
    return "Esse slug já está em uso. Escolha outro endereço para o imóvel.";
  }
  if (error.code === "23514" || error.code === "22P02" || error.code === "22003") {
    return "Um ou mais valores não atendem às regras do banco. Confira o formulário.";
  }
  if (error.code === "42501" || error.status === 401 || error.status === 403) {
    return "Sua sessão não tem autorização para esta operação. Entre novamente com uma conta administradora.";
  }
  if (error.code === "23502") {
    return "Preencha todos os campos obrigatórios antes de salvar.";
  }
  return "Não foi possível concluir a operação. Verifique sua conexão e tente novamente.";
}

async function loadProperties() {
  propertyListStatus.textContent = "Carregando imóveis…";
  propertyList.replaceChildren();
  refreshPropertiesButton.disabled = true;

  try {
    const { data, error } = await withAuthTimeout(
      supabaseClient
        .from("properties")
        .select("id, title, city, state, price, status, created_at")
        .order("created_at", { ascending: false }),
      "A consulta dos imóveis excedeu o tempo limite.",
    );
    if (error) throw error;

    const properties = data || [];
    propertiesById = new Map(properties.map((property) => [property.id, property]));
    propertyList.replaceChildren(...properties.map(createPropertyListItem));
    propertyListStatus.textContent = properties.length
      ? `${properties.length} ${properties.length === 1 ? "imóvel cadastrado." : "imóveis cadastrados."}`
      : "Ainda não há imóveis cadastrados.";
  } catch (error) {
    console.error("Falha ao carregar a lista de imóveis.", error);
    propertyListStatus.textContent = describePropertyError(error);
  } finally {
    refreshPropertiesButton.disabled = false;
  }
}

function clearPropertyFormMessage() {
  propertyFormMessage.textContent = "";
  propertyFormMessage.hidden = true;
  propertyFormMessage.dataset.kind = "";
}

function setPropertyFormMode(property = null) {
  editingPropertyId = property?.id || null;
  propertyFormEyebrow.textContent = property ? "Edição de cadastro" : "Novo cadastro";
  propertyFormTitle.textContent = property ? "Editar imóvel" : "Cadastrar imóvel";
  savePropertyButton.textContent = property ? "Salvar alterações" : "Salvar imóvel";
}

function resetPropertyForm() {
  propertyForm.reset();
  propertyForm.elements.namedItem("status").value = "draft";
  setPropertyFormMode();
  propertySlugWasEdited = false;
  propertySlugInput.setCustomValidity("");
  clearPropertyFormMessage();
  propertyForm.hidden = true;
}

async function editProperty(propertyId, editButton) {
  if (editButton) editButton.disabled = true;
  setDashboardMessage("Carregando os dados do imóvel…", "success");

  try {
    const { data: property, error } = await withAuthTimeout(
      supabaseClient
        .from("properties")
        .select(
          "id, slug, title, description, property_type, purpose, price, city, state, neighborhood, built_area, land_area, bedrooms, suites, bathrooms, features, status",
        )
        .eq("id", propertyId)
        .maybeSingle(),
      "A consulta do imóvel excedeu o tempo limite.",
    );
    if (error) throw error;
    if (!property) {
      throw new Error("O imóvel não foi encontrado. Atualize a lista e tente novamente.");
    }

    propertyForm.reset();
    Object.entries(property).forEach(([name, value]) => {
      const field = propertyForm.elements.namedItem(name);
      if (!field) return;
      if (name === "features") {
        field.value = Array.isArray(value) ? value.join("\n") : "";
      } else {
        field.value = value === null || value === undefined ? "" : String(value);
      }
    });
    setPropertyFormMode(property);
    propertySlugWasEdited = true;
    propertySlugInput.setCustomValidity("");
    clearPropertyFormMessage();
    setDashboardMessage("");
    propertyForm.hidden = false;
    propertyTitleInput.focus();
    propertyForm.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("Falha ao carregar os dados para edição.", error);
    setDashboardMessage(
      error.message === "O imóvel não foi encontrado. Atualize a lista e tente novamente."
        ? error.message
        : describePropertyError(error),
    );
  } finally {
    if (editButton) editButton.disabled = false;
  }
}

function parseOptionalNumber(value) {
  return value === "" ? null : Number(value);
}

function getPropertyPayload() {
  const formData = new FormData(propertyForm);
  const title = String(formData.get("title") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const slugValue = String(formData.get("slug") || "").trim();
  const slug = slugValue || generateSlug(title);
  propertyTitleInput.setCustomValidity(
    title ? "" : "Informe um título que não esteja vazio ou formado apenas por espaços.",
  );
  propertyCityInput.setCustomValidity(
    city ? "" : "Informe uma cidade que não esteja vazia ou formada apenas por espaços.",
  );
  propertySlugInput.value = slug;
  propertySlugInput.setCustomValidity(
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
      ? ""
      : "Use letras minúsculas sem acentos, números e hífens entre as palavras.",
  );

  const features = String(formData.get("features") || "")
    .split(/\r?\n/)
    .map((feature) => feature.trim())
    .filter(Boolean);

  return {
    title,
    slug,
    description: String(formData.get("description") || "").trim(),
    property_type: formData.get("property_type"),
    purpose: formData.get("purpose"),
    price: Number(formData.get("price")),
    city,
    state: String(formData.get("state") || "").trim().toUpperCase(),
    neighborhood: String(formData.get("neighborhood") || "").trim() || null,
    built_area: parseOptionalNumber(formData.get("built_area")),
    land_area: parseOptionalNumber(formData.get("land_area")),
    bedrooms: parseOptionalNumber(formData.get("bedrooms")),
    suites: parseOptionalNumber(formData.get("suites")),
    bathrooms: parseOptionalNumber(formData.get("bathrooms")),
    features,
    status: formData.get("status"),
  };
}

function setDashboardMessage(message, kind = "error") {
  dashboardMessage.textContent = message;
  dashboardMessage.dataset.kind = kind;
  dashboardMessage.hidden = !message;
}

showPropertyFormButton.addEventListener("click", () => {
  propertyForm.reset();
  propertyForm.elements.namedItem("status").value = "draft";
  setPropertyFormMode();
  propertySlugWasEdited = false;
  propertySlugInput.setCustomValidity("");
  clearPropertyFormMessage();
  propertyForm.hidden = false;
  propertyTitleInput.focus();
});

document.querySelectorAll("#cancel-property-form, #cancel-property-form-bottom").forEach((button) => {
  button.addEventListener("click", resetPropertyForm);
});

refreshPropertiesButton.addEventListener("click", loadProperties);

propertyList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-property-id]");
  if (!button) return;

  const property = propertiesById.get(button.dataset.propertyId);
  if (!property) {
    setDashboardMessage("Atualize a lista e tente abrir as fotos novamente.");
    return;
  }
  if (button.dataset.propertyAction === "edit") {
    editProperty(property.id, button);
  } else if (button.dataset.propertyAction === "photos") {
    openPhotoManager(property).catch((error) => {
      console.error("Falha ao abrir o gerenciamento de fotos.", error);
      setPhotoManagerStatus("Não foi possível abrir as fotos deste imóvel.");
    });
  }
});

photoFileInput.addEventListener("change", () => {
  setPhotoManagerStatus("");
  const files = [...photoFileInput.files];
  clearPhotoSelection();

  if (files.length === 0) return;

  const errors = validatePhotoFiles(files);
  if (errors.length > 0) {
    setPhotoManagerStatus(errors.join(" "));
    return;
  }

  selectedPhotoFiles = files;
  renderPhotoPreviews(files);
  uploadPhotosButton.disabled = photoOperationInProgress;
});

photoUploadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  uploadSelectedPhotos().catch((error) => {
    console.error("Falha inesperada durante o envio das fotos.", error);
    photoOperationInProgress = false;
    photoFileInput.disabled = false;
    uploadPhotosButton.disabled = selectedPhotoFiles.length === 0;
    setPhotoManagerStatus(describePhotoError(error));
  });
});

photoGallery.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-photo-action]");
  if (!button) return;

  const photo = activePhotos.find((item) => item.id === button.dataset.photoId);
  if (!photo) {
    setPhotoManagerStatus("A foto não está mais na lista. Atualize a galeria e tente novamente.");
    return;
  }

  if (button.dataset.photoAction === "cover") {
    setPhotoAsCover(photo);
  } else if (button.dataset.photoAction === "remove") {
    removeManagedPhoto(photo);
  }
});

closePhotoManagerButton.addEventListener("click", () => {
  if (!photoOperationInProgress) photoManagerDialog.close();
});

photoManagerDialog.addEventListener("cancel", (event) => {
  if (photoOperationInProgress) event.preventDefault();
});

photoManagerDialog.addEventListener("close", () => {
  clearPhotoSelection();
  activePhotoProperty = null;
  activePhotos = [];
  photoGallery.replaceChildren();
  setPhotoGalleryStatus("Abra o gerenciamento para carregar as fotos.");
  setPhotoManagerStatus("");
});

propertyTitleInput.addEventListener("input", () => {
  propertyTitleInput.setCustomValidity("");
  if (!propertySlugWasEdited) {
    propertySlugInput.value = generateSlug(propertyTitleInput.value);
    propertySlugInput.setCustomValidity("");
  }
});

propertyCityInput.addEventListener("input", () => {
  propertyCityInput.setCustomValidity("");
});

propertySlugInput.addEventListener("input", () => {
  propertySlugWasEdited = true;
  propertySlugInput.setCustomValidity("");
});

propertyForm.elements.namedItem("state").addEventListener("input", (event) => {
  event.target.value = event.target.value.toUpperCase();
});

propertyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearPropertyFormMessage();

  const payload = getPropertyPayload();
  if (!propertyForm.reportValidity()) return;

  savePropertyButton.disabled = true;
  showPropertyFormButton.disabled = true;
  const propertyIdToUpdate = editingPropertyId;

  try {
    let slugQuery = supabaseClient
      .from("properties")
      .select("id")
      .eq("slug", payload.slug);
    if (propertyIdToUpdate) slugQuery = slugQuery.neq("id", propertyIdToUpdate);

    const { data: existingProperty, error: slugError } = await withAuthTimeout(
      slugQuery.maybeSingle(),
      "A validação do slug excedeu o tempo limite.",
    );
    if (slugError) throw slugError;
    if (existingProperty) {
      propertySlugInput.setCustomValidity("Esse slug já está em uso. Escolha outro.");
      propertySlugInput.reportValidity();
      return;
    }

    if (propertyIdToUpdate) {
      const { data, error } = await withAuthTimeout(
        supabaseClient
          .from("properties")
          .update(payload)
          .eq("id", propertyIdToUpdate)
          .select("id"),
        "A atualização excedeu o tempo limite. Atualize a lista para confirmar o resultado.",
      );
      if (error) throw error;
      if (data?.length !== 1) {
        throw new Error("O banco não confirmou a atualização do imóvel.");
      }
    } else {
      const { error } = await withAuthTimeout(
        supabaseClient.from("properties").insert(payload),
        "O cadastro excedeu o tempo limite. Atualize a lista antes de tentar novamente.",
      );
      if (error) throw error;
    }

    resetPropertyForm();
    setDashboardMessage(
      propertyIdToUpdate
        ? payload.status === "draft"
          ? "Alterações salvas. O imóvel permanece como rascunho e não será exibido no site público."
          : payload.status === "archived"
            ? "Alterações salvas. O imóvel permanece arquivado e não será exibido no site público."
            : "Alterações salvas e imóvel publicado."
        : payload.status === "draft"
          ? "Imóvel cadastrado como rascunho. Ele não será exibido no site público."
          : payload.status === "archived"
            ? "Imóvel cadastrado como arquivado. Ele não será exibido no site público."
            : "Imóvel cadastrado com sucesso.",
      "success",
    );
    await loadProperties();
  } catch (error) {
    console.error(
      propertyIdToUpdate ? "Falha ao atualizar imóvel." : "Falha ao cadastrar imóvel.",
      error,
    );
    propertyFormMessage.textContent =
      error.message === "O banco não confirmou a atualização do imóvel."
        ? error.message
        : describePropertyError(error);
    propertyFormMessage.hidden = false;
  } finally {
    savePropertyButton.disabled = false;
    showPropertyFormButton.disabled = false;
  }
});

async function closeUnauthorizedSession(message) {
  hasVerifiedAdminSession = false;
  authFlowId += 1;
  showLogin(message);
  endingSession = true;

  try {
    const { error } = await withAuthTimeout(
      supabaseClient.auth.signOut({ scope: "local" }),
      "A operação de encerramento de sessão expirou.",
    );
    if (error) throw error;
  } catch (error) {
    console.error("Não foi possível encerrar a sessão sem autorização.", error);
  } finally {
    endingSession = false;
  }
}

async function verifyAdminAccess(session, flowId) {
  if (flowId !== authFlowId) return;

  showChecking("Verificando autorização…");
  if (!session) {
    showLogin("Entre com a conta autorizada para acessar o painel.");
    return;
  }

  try {
    const { data: isAdmin, error } = await withAuthTimeout(
      supabaseClient.rpc("is_admin"),
      "A verificação de autorização excedeu o tempo limite.",
    );
    if (flowId !== authFlowId) return;
    if (error) throw error;

    if (isAdmin !== true) {
      await closeUnauthorizedSession("Esta conta não tem permissão para acessar o painel.");
      return;
    }

    hasVerifiedAdminSession = true;
    showDashboard();
    loadProperties();
  } catch (error) {
    if (flowId !== authFlowId) return;
    console.error("Falha ao verificar a autorização administrativa.", error);
    await closeUnauthorizedSession(
      "Não foi possível verificar sua autorização. Tente entrar novamente mais tarde.",
    );
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const flowId = ++authFlowId;
  loginSubmit.disabled = true;
  authMessage.textContent = "";
  authMessage.hidden = true;

  try {
    const { data, error } = await withAuthTimeout(
      supabaseClient.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      }),
      "A tentativa de login excedeu o tempo limite.",
    );
    passwordInput.value = "";
    if (flowId !== authFlowId) return;

    if (error) {
      if (error.code === "invalid_credentials" || error.status === 400) {
        showLogin("E-mail ou senha inválidos.");
      } else {
        console.error("Falha ao autenticar no painel.", error);
        showLogin("Não foi possível concluir o login. Tente novamente mais tarde.");
      }
      return;
    }

    await verifyAdminAccess(data.session, flowId);
  } catch (error) {
    passwordInput.value = "";
    if (flowId !== authFlowId) return;
    console.error("Erro inesperado durante o login administrativo.", error);
    authFlowId += 1;
    showLogin(
      error.message === "A tentativa de login excedeu o tempo limite."
        ? "O login demorou mais que o esperado. Verifique sua conexão e tente novamente."
        : "Não foi possível concluir o login. Verifique sua conexão e tente novamente.",
    );
  } finally {
    loginSubmit.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  endingSession = true;

  try {
    const { error } = await withAuthTimeout(
      supabaseClient.auth.signOut({ scope: "local" }),
      "A operação de encerramento de sessão excedeu o tempo limite.",
    );
    if (error) {
      console.error("Falha ao encerrar a sessão administrativa.", error);
      dashboardMessage.textContent = "Não foi possível sair da conta. Tente novamente.";
      dashboardMessage.hidden = false;
      return;
    }

    hasVerifiedAdminSession = false;
    showLogin("Sessão encerrada.");
  } catch (error) {
    console.error("Erro inesperado ao encerrar a sessão administrativa.", error);
    dashboardMessage.textContent = "Não foi possível sair da conta. Tente novamente.";
    dashboardMessage.hidden = false;
  } finally {
    endingSession = false;
    logoutButton.disabled = false;
  }
});

if (
  !window.supabase ||
  typeof window.supabase.createClient !== "function" ||
  !supabaseClient?.auth ||
  typeof supabaseClient.auth.getSession !== "function" ||
  typeof supabaseClient.auth.signInWithPassword !== "function" ||
  typeof supabaseClient.auth.onAuthStateChange !== "function" ||
  typeof supabaseClient.rpc !== "function"
) {
  showLogin("A conexão segura não foi inicializada. Verifique sua conexão e recarregue a página.");
  loginSubmit.disabled = true;
  console.error("Biblioteca ou cliente Supabase indisponível na área administrativa.");
} else {
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event !== "SIGNED_OUT" || endingSession) return;

    const wasVerifiedAdmin = hasVerifiedAdminSession;
    hasVerifiedAdminSession = false;
    authFlowId += 1;
    showLogin(
      wasVerifiedAdmin
        ? "Sua sessão expirou ou foi encerrada. Entre novamente."
        : "Entre com a conta autorizada para acessar o painel.",
    );
  });

  const flowId = ++authFlowId;
  withAuthTimeout(
    supabaseClient.auth.getSession(),
    "A recuperação de sessão excedeu o tempo limite.",
  ).then(({ data, error }) => {
    if (error) throw error;
    if (flowId !== authFlowId) return;
    return verifyAdminAccess(data.session, flowId);
  }).catch((error) => {
    if (flowId !== authFlowId) return;
    console.error("Falha ao recuperar a sessão administrativa.", error);
    authFlowId += 1;
    showLogin(
      error.message === "A recuperação de sessão excedeu o tempo limite."
        ? "A verificação demorou mais que o esperado. Entre para tentar novamente."
        : "Não foi possível verificar sua sessão. Tente entrar novamente.",
    );
  });
}
