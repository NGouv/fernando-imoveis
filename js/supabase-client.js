(() => {
  const projectUrl = "https://hqafazcffjlpzhldxmgi.supabase.co";
  const publishableKey = "sb_publishable_1BNauSW119lMV5L4_6VFgA_hXHWLCmg";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("O cliente oficial do Supabase não foi carregado.");
  }

  window.FERNANDO_SUPABASE = window.supabase.createClient(projectUrl, publishableKey);
})();
