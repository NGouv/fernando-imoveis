const statusElement = document.querySelector("#test-status");
const resultsElement = document.querySelector("#test-results");

async function testPublishedPropertyRead() {
  try {
    const { data, error } = await window.FERNANDO_SUPABASE
      .from("properties")
      .select("id, slug, title")
      .eq("status", "published")
      .limit(5);

    if (error) throw error;

    statusElement.textContent = `Leitura concluída: ${data.length} imóvel(is) publicado(s) encontrado(s), máximo 5.`;
    resultsElement.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    statusElement.textContent = `Falha na leitura: ${error.message}`;
    resultsElement.textContent = "";
    console.error("Falha no teste de leitura do Supabase.", error);
  }
}

testPublishedPropertyRead();
