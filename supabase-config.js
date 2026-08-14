window.SUPABASE_URL = "https://lvlgkafrkrlowgozvavu.supabase.co";
window.SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bGdrYWZya3Jsb3dnb3p2YXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMjk3NTMsImV4cCI6MjA5OTgwNTc1M30.s4RDBhXiHv51S7Ny6Lt4AH6ctsVPRaPAzvs_5tEnCjE";

window.getSupabaseClient = function () {
  if (!window.supabase) {
    console.error("Supabase SDK belum termuat.");
    return null;
  }

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.error("Konfigurasi Supabase belum lengkap.");
    return null;
  }

  return window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY,
  );
};
