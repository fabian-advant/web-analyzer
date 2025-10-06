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
        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${KEY}&screenshot=true`;
        const response = await fetch(apiUrl);
        return await response.json();
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
        
        return {
          performance: lh.categories?.performance ? Math.round(lh.categories.performance.score * 100) : null,
          seo: lh.categories?.seo ? Math.round(lh.categories.seo.score * 100) : null,
          tiempoCarga: audits['largest-contentful-paint']?.displayValue || null,
          screenshot: lh.fullPageScreenshot?.screenshot?.data || null,
          captureDate: new Date(lh.fetchTime).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          // Detectar reCAPTCHA
          hasRecaptcha: detectRecaptcha(audits)
        };
      };

      // Función para detectar reCAPTCHA
      function detectRecaptcha(audits) {
        // Buscar en el código fuente si hay reCAPTCHA
        const sourceCode = audits['unused-css-rules']?.details?.items || [];
        const hasRecaptchaScript = sourceCode.some(item => 
          item.url && item.url.includes('recaptcha')
        );
        
        // También buscar en otros auditores que puedan detectar scripts
        return hasRecaptchaScript;
      }

      const results = {
        mobile: extractMetrics(mobileData),
        desktop: extractMetrics(desktopData)
      };

      return res.json(results);
    } catch (err) {
      return res.status(500).json({ error: 'Error en API', details: err.message });
    }
  }
  
