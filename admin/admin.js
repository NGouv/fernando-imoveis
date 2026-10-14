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

const authTimeoutMs = 10000;
let hasVerifiedAdminSession = false;
let endingSession = false;
let authFlowId = 0;
let propertySlugWasEdited = false;

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

  item.append(details, status);
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

function resetPropertyForm() {
  propertyForm.reset();
  propertyForm.elements.namedItem("status").value = "draft";
  propertySlugWasEdited = false;
  propertySlugInput.setCustomValidity("");
  clearPropertyFormMessage();
  propertyForm.hidden = true;
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

  try {
    const { data: existingProperty, error: slugError } = await withAuthTimeout(
      supabaseClient
        .from("properties")
        .select("id")
        .eq("slug", payload.slug)
        .maybeSingle(),
      "A validação do slug excedeu o tempo limite.",
    );
    if (slugError) throw slugError;
    if (existingProperty) {
      propertySlugInput.setCustomValidity("Esse slug já está em uso. Escolha outro.");
      propertySlugInput.reportValidity();
      return;
    }

    const { error } = await withAuthTimeout(
      supabaseClient.from("properties").insert(payload),
      "O cadastro excedeu o tempo limite. Atualize a lista antes de tentar novamente.",
    );
    if (error) throw error;

    resetPropertyForm();
    setDashboardMessage(
      payload.status === "draft"
        ? "Imóvel cadastrado como rascunho. Ele não será exibido no site público."
        : "Imóvel cadastrado com sucesso.",
      "success",
    );
    await loadProperties();
  } catch (error) {
    console.error("Falha ao cadastrar imóvel.", error);
    propertyFormMessage.textContent = describePropertyError(error);
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
