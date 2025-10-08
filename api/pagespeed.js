// api/pagespeed.js
export default async function handler(req, res) {
    // Configurar headers de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Manejar preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    const KEY = process.env.PAGESPEED_KEY;
    
    try {
      // Función para obtener datos de PageSpeed Insights
      const getPageSpeedData = async (strategy) => {
        // Especificar categorías explícitamente para obtener performance y seo
        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${KEY}&category=performance&category=seo`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        return data;
      };

      // Obtener datos para móvil y escritorio en paralelo
      const [mobileData, desktopData] = await Promise.all([
        getPageSpeedData('mobile'),
        getPageSpeedData('desktop')
      ]);

      // Función para extraer métricas de los datos
      const extractMetrics = (data) => {
        const lh = data.lighthouseResult || {};
        const audits = lh.audits || {};
        
        
        // Obtener puntuación SEO como estaba originalmente
        const seoScore = lh.categories?.seo ? Math.round(lh.categories.seo.score * 100) : null;
        
        // Obtener captura de pantalla desde la ubicación correcta
        let screenshot = null;
        if (audits['final-screenshot']?.details?.data) {
          screenshot = audits['final-screenshot'].details.data;
        }
        
        return {
          performance: lh.categories?.performance ? Math.round(lh.categories.performance.score * 100) : null,
          seo: seoScore,
          tiempoCarga: audits['largest-contentful-paint']?.displayValue || null,
          screenshot: screenshot,
          // Detectar reCAPTCHA
          hasRecaptcha: detectRecaptcha(audits)
        };
      };

      // Función para detectar reCAPTCHA
      function detectRecaptcha(audits) {
        // Buscar reCAPTCHA en varios auditores
        const scriptsUsed = audits['unused-javascript']?.details?.items || [];
        const cssUsed = audits['unused-css-rules']?.details?.items || [];
        
        // Buscar en scripts y CSS
        const hasRecaptchaInScripts = scriptsUsed.some(item => 
          item.url && item.url.includes('recaptcha')
        );
        
        const hasRecaptchaInCSS = cssUsed.some(item => 
          item.url && item.url.includes('recaptcha')
        );
        
        // También buscar en otros auditores
        const thirdPartySummary = audits['third-party-summary']?.details?.items || [];
        const hasRecaptchaInThirdParty = thirdPartySummary.some(item => 
          item.entity && item.entity.name && item.entity.name.toLowerCase().includes('recaptcha')
        );
        
        return hasRecaptchaInScripts || hasRecaptchaInCSS || hasRecaptchaInThirdParty;
      }

      const mobileMetrics = extractMetrics(mobileData);
      const desktopMetrics = extractMetrics(desktopData);

      const results = {
        mobile: mobileMetrics,
        desktop: desktopMetrics
      };

      return res.json(results);
    } catch (err) {
      return res.status(500).json({ error: 'Error en API', details: err.message });
    }
  }
  
