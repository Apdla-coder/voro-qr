export default {
  async fetch(request) {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get("restaurant_id");

    if (!restaurantId) {
      return new Response(
        JSON.stringify({ error: "Missing restaurant_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 🔑 Supabase Config (زي ما طلبت)
    const SUPABASE_URL = "https://putgtsdgeyqyptamwpnx.supabase.co";
    const SUPABASE_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1dGd0c2RnZXlxeXB0YW13cG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODMxMzAsImV4cCI6MjA4Mjk1OTEzMH0.bo30DP6UxtpHSvKTCwtaUmkJR8aT-BNEhyrW35IKsVE";

    // Endpoint بتاع المنيو
    const apiUrl = `${SUPABASE_URL}/rest/v1/menu?restaurant_id=eq.${restaurantId}&select=*`;

    const cache = caches.default;
    const cacheKey = new Request(request.url);

    // 🔍 حاول من الكاش الأول
    let response = await cache.match(cacheKey);

    if (!response) {
      response = await fetch(apiUrl, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json"
        }
      });

      // 🧠 خزّن في الكاش لو الريسبونس تمام
      if (response.ok) {
        await cache.put(cacheKey, response.clone());
      }
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300" // 5 دقايق
      }
    });
  }
};
