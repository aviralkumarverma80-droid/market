"use strict";

(() => {
  let clientPromise;

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch("./auth-config", {
          cache: "no-store",
          headers: { Accept: "application/json" }
        });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Could not load authentication configuration.");

        const config = await response.json();
        if (!config.configured) return null;
        if (!window.supabase || typeof window.supabase.createClient !== "function") {
          throw new Error("The Supabase client library did not load.");
        }

        return window.supabase.createClient(config.url, config.publishableKey, {
          auth: {
            autoRefreshToken: true,
            detectSessionInUrl: true,
            persistSession: true
          }
        });
      })();
    }

    return clientPromise;
  }

  window.marketfieldAuth = Object.freeze({ getClient });
})();
