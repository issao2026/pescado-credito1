// lib/secrets.example.js
// Copia este arquivo como lib/secrets.js (NAO COMITAR) e preenche os valores.
// Usado como fallback quando env vars da Vercel nao funcionam.
// Atencao: arquivo vai pro deploy, mas .gitignore impede commit no Git.

export const SECRETS = {
  SUPABASE_URL: "https://hebznnfqamgedwtgmluh.supabase.co",
  SUPABASE_SERVICE_KEY: "",  // cola aqui se for usar fallback
  ANTHROPIC_API_KEY: "",     // cola aqui se for usar fallback
};
