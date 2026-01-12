export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get("restaurant_id");

    if (!restaurantId) {
      return new Response("Missing restaurant_id", { status: 400 });
    }

    const apiUrl = `https://YOUR_PROJECT_ID.supabase.co/rest/v1/menu?restaurant_id=eq.${restaurantId}`;

    const cache = caches.default;
    const cacheKey = new Request(request.url);

    let response = await cache.match(cacheKey);

    if (!response) {
      response = await fetch(apiUrl, {
        headers: {
          apikey: env.SUPABASE_KEY,
          Authorization: `Bearer ${env.SUPABASE_KEY}`,
          "Content-Type": "application/json"
        }
      });

      if (response.ok) {
        await cache.put(cacheKey, response.clone());
      }
    }

    return response;
  }
};
