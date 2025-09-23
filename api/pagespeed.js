export default async function handler(req, res) {
  // 🔍 LOGS DE DEBUG - Remueve en producción
  console.log("=== INICIO DE REQUEST ===");
  console.log("Method:", req.method);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  try {
    // ⚡ CORS más permisivo para debug
    res.setHeader("Access-Control-Allow-Origin", "*"); // TEMPORALMENTE
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    // Preflight request
    if (req.method === "OPTIONS") {
      console.log("OPTIONS request - returning 200");
      return res.status(200).end();
    }

    // Permitir GET para testing básico
    if (req.method === "GET") {
      console.log("GET request - health check");
      return res.status(200).json({ 
        status: "API funcionando", 
        time: new Date().toISOString(),
        hasKey: !!process.env.PAGESPEED_KEY 
      });
    }

    if (req.method !== "POST") {
      console.log("Method not allowed:", req.method);
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Verificar variable de entorno
    const KEY = process.env.PAGESPEED_KEY;
    console.log("API Key exists:", !!KEY);
    
    if (!KEY) {
      console.log("❌ PAGESPEED_KEY no encontrada");
      return res.status(500).json({ 
        error: "API Key no configurada", 
        details: "Verifica que PAGESPEED_KEY esté en las variables de entorno de Vercel" 
      });
    }

    const { url, strategy = "mobile" } = req.body || {};
    console.log("URL recibida:", url);
    console.log("Strategy:", strategy);
    
    if (!url) {
      console.log("❌ URL no proporcionada");
      return res.status(400).json({ error: "URL requerida" });
    }

    // Construir URL de la API
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${KEY}`;
    console.log("Calling PageSpeed API...");

    // Petición a Google PageSpeed con timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25 segundos

    const r = await fetch(apiUrl, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PageSpeedAnalyzer/1.0)'
      }
    });
    
    clearTimeout(timeout);
    console.log("PageSpeed API status:", r.status);

    if (!r.ok) {
      console.log("❌ PageSpeed API error:", r.status, r.statusText);
      const errorText = await r.text();
      console.log("Error response:", errorText);
      return res.status(500).json({ 
        error: `Google PageSpeed API error: ${r.status}`, 
        details: errorText 
      });
    }

    const text = await r.text();
    console.log("Response length:", text.length);
    
    let data;
    try {
      data = JSON.parse(text);
      console.log("JSON parsed successfully");
    } catch (err) {
      console.log("❌ JSON Parse Error:", err.message);
      console.log("Response text preview:", text.substring(0, 500));
      return res.status(500).json({ 
        error: "Error parseando respuesta PageSpeed", 
        details: `Parse error: ${err.message}` 
      });
    }

    if (data.error) {
      console.log("❌ Google API returned error:", data.error);
      return res.status(500).json({ 
        error: "Google API error", 
        details: data.error 
      });
    }

    // Verificar estructura de datos
    const lh = data.lighthouseResult || {};
    console.log("Lighthouse result exists:", !!lh);
    console.log("Categories exist:", !!lh.categories);
    console.log("Audits exist:", !!lh.audits);

    const audits = lh.audits || {};
    
    // Métricas esenciales con logs
    const perfScore = lh.categories?.performance?.score;
    console.log("Performance score raw:", perfScore);
    const perf = perfScore !== undefined ? Math.round(perfScore * 100) : null;
    
    const seoScore = lh.categories?.seo?.score;
    console.log("SEO score raw:", seoScore);
    const seo = seoScore !== undefined ? Math.round(seoScore * 100) : null;
    
    const lcpAudit = audits["largest-contentful-paint"];
    console.log("LCP audit exists:", !!lcpAudit);
    const loadTime = lcpAudit?.displayValue ?? null;
    
    const bytesAudit = audits["total-byte-weight"];
    console.log("Bytes audit exists:", !!bytesAudit);
    const pageSize = bytesAudit?.displayValue ?? "No disponible";

    // Clasificación simple
    const clasificar = (score) => {
      if (score === null) return "No disponible";
      if (score >= 85) return "Bueno 🎉";
      if (score >= 60) return "Regular ⚠️";
      return "Malo 🛑";
    };

    const result = {
      calificacion: clasificar(perf),
      performance: perf,
      seo,
      tiempoCarga: loadTime,
      tamanoPagina: pageSize,
      debug: {
        hasLighthouse: !!lh,
        hasCategories: !!lh.categories,
        hasAudits: !!lh.audits,
        perfRaw: perfScore,
        seoRaw: seoScore
      }
    };

    console.log("Final result:", result);
    console.log("=== FIN DE REQUEST EXITOSO ===");
    
    return res.status(200).json(result);

  } catch (err) {
    console.log("❌ CATCH ERROR:", err.message);
    console.log("Error stack:", err.stack);
    console.log("=== FIN DE REQUEST CON ERROR ===");
    
    return res.status(500).json({ 
      error: "Error interno del servidor", 
      details: err.message,
      type: err.name
    });
  }
}
