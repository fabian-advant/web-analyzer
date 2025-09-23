export default async function handler(req, res) {
  // ⚡ CORS: permite múltiples dominios
  const allowedOrigins = [
    "https://www.advantms.com",
    "https://advantms.webflow.io",
    "http://localhost:3000",
    "https://127.0.0.1:5500"
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || !origin) { // !origin para testing directo
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  // Preflight request
  if (req.method === "OPTIONS") return res.status(200).end();
  
  // Health check
  if (req.method === "GET") {
    return res.status(200).json({ 
      status: "API funcionando", 
      time: new Date().toISOString() 
    });
  }
  
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { url, strategy = "mobile" } = req.body || {};
  if (!url) return res.status(400).json({ error: "URL requerida" });

  try {
    const KEY = process.env.PAGESPEED_KEY;
    if (!KEY) {
      return res.status(500).json({ 
        error: "API Key no configurada", 
        details: "Verifica PAGESPEED_KEY en variables de entorno" 
      });
    }

    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&category=seo&key=${KEY}`;

    // Petición a Google PageSpeed
    const r = await fetch(apiUrl, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PageSpeedAnalyzer/1.0)' }
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      return res.status(500).json({ 
        error: `Google PageSpeed API error: ${r.status}`, 
        details: errorText 
      });
    }

    const text = await r.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch (err) {
      return res.status(500).json({ 
        error: "Error parseando respuesta PageSpeed", 
        details: err.message 
      });
    }

    if (data.error) {
      return res.status(500).json({ 
        error: "Google API error", 
        details: data.error 
      });
    }

    const lh = data.lighthouseResult || {};
    const audits = lh.audits || {};

    // 📊 MÉTRICAS MEJORADAS
    
    // Performance
    const perfScore = lh.categories?.performance?.score;
    const perf = perfScore !== undefined ? Math.round(perfScore * 100) : null;
    
    // SEO - Verificar si existe la categoría
    const seoScore = lh.categories?.seo?.score;
    const seo = seoScore !== undefined ? Math.round(seoScore * 100) : null;
    
    // 🕐 TIEMPO DE CARGA - Formato mejorado
    const lcpAudit = audits["largest-contentful-paint"];
    let tiempoCarga = "No disponible";
    
    if (lcpAudit?.displayValue) {
      // Si viene como "1.5 s", extraer solo el número
      const match = lcpAudit.displayValue.match(/[\d.]+/);
      if (match) {
        const segundos = parseFloat(match[0]);
        tiempoCarga = `${segundos} segundos`;
      }
    }
    
    // 📏 TAMAÑO DE PÁGINA - Convertir a MB
    const bytesAudit = audits["total-byte-weight"];
    let tamanoPagina = "No disponible";
    
    if (bytesAudit?.numericValue) {
      // Convertir bytes a MB
      const mb = (bytesAudit.numericValue / (1024 * 1024)).toFixed(1);
      tamanoPagina = `${mb} MB`;
    } else if (bytesAudit?.displayValue) {
      // Si viene en formato texto como "2,002 KiB"
      const texto = bytesAudit.displayValue;
      if (texto.includes('KiB')) {
        const match = texto.match(/[\d,]+/);
        if (match) {
          const kib = parseFloat(match[0].replace(/,/g, ''));
          const mb = (kib * 1.024 / 1000).toFixed(1); // KiB a MB aproximado
          tamanoPagina = `${mb} MB`;
        }
      } else if (texto.includes('MB')) {
        const match = texto.match(/[\d.]+/);
        if (match) {
          tamanoPagina = `${match[0]} MB`;
        }
      }
    }

    // Clasificación
    const clasificar = (score) => {
      if (score === null) return "No disponible";
      if (score >= 85) return "Bueno 🎉";
      if (score >= 60) return "Regular ⚠️";
      return "Malo 🛑";
    };

    return res.status(200).json({
      calificacion: clasificar(perf),
      performance: perf,
      seo,
      tiempoCarga,
      tamanoPagina,
      // Debug info (remover en producción)
      debug: {
        seoExists: !!lh.categories?.seo,
        lcpRaw: lcpAudit?.displayValue,
        bytesRaw: bytesAudit?.displayValue,
        bytesNumeric: bytesAudit?.numericValue
      }
    });
    
  } catch (err) {
    return res.status(500).json({ 
      error: "Error interno del servidor", 
      details: err.message 
    });
  }
}
