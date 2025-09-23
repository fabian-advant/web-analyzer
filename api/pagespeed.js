export default async function handler(req, res) {
  // CORS: permitir solo tu dominio
  res.setHeader("Access-Control-Allow-Origin", "https://www.advantms.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { url, strategy = "mobile" } = req.body || {};
  if (!url) return res.status(400).json({ error: "URL requerida" });

  try {
    const KEY = process.env.PAGESPEED_KEY;
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
      url
    )}&strategy=${strategy}&key=${KEY}`;

    const r = await fetch(apiUrl);
    const data = await r.json();

    const lh = data.lighthouseResult || {};
    const audits = lh.audits || {};

    // Calificación performance
    const perf =
      lh.categories?.performance?.score !== undefined
        ? Math.round(lh.categories.performance.score * 100)
        : null;

    // Calificación SEO
    const seo =
      lh.categories?.seo?.score !== undefined
        ? Math.round(lh.categories.seo.score * 100)
        : null;

    // Tiempo de carga principal (LCP)
    const loadTime = audits["largest-contentful-paint"]?.displayValue ?? null;

    // Tamaño total de la página (transfer size)
    const pageSize =
      audits["total-byte-weight"]?.displayValue ?? "No disponible";

    // Clasificación simple
    const clasificar = (score) => {
      if (score >= 85) return "Bueno";
      if (score >= 60) return "Regular";
      return "Malo";
    };

    return res.json({
      calificacion: clasificar(perf),
      performance: perf,
      seo,
      tiempoCarga: loadTime,
      tamanoPagina: pageSize,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Error en API", details: err.message });
  }
}
