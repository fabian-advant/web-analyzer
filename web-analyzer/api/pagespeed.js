// api/pagespeed.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { url, strategy = 'mobile' } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL requerida' });
  
    const KEY = process.env.PAGESPEED_KEY;
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${KEY}`;
    
    try {
      const r = await fetch(apiUrl);
      const data = await r.json();
      const lh = data.lighthouseResult || {};
      const perf = lh.categories?.performance ? Math.round(lh.categories.performance.score * 100) : null;
      const audits = lh.audits || {};
  
      const metrics = {
        fcp: audits['first-contentful-paint']?.displayValue ?? null,
        lcp: audits['largest-contentful-paint']?.displayValue ?? null,
        cls: audits['cumulative-layout-shift']?.displayValue ?? null,
        tbt: audits['total-blocking-time']?.displayValue ?? null,
      };
  
      return res.json({ score: perf, metrics });
    } catch (err) {
      return res.status(500).json({ error: 'Error en API', details: err.message });
    }
  }
  