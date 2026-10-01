const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url && req.url.startsWith('/api-proxy/')) {
        const https = require('https');
        const targetPath = req.url.replace('/api-proxy', '');

        const proxyReq = https.request(
          {
            hostname: 'stephenkanjaportal.infinityfreeapp.com',
            path: `/api${targetPath}`,
            method: req.method,
            headers: {
              ...req.headers,
              host: 'stephenkanjaportal.infinityfreeapp.com',
            },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
          }
        );

        proxyReq.on('error', (err) => {
          console.error('Proxy request failed:', err);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Proxy error' }));
        });

        req.pipe(proxyReq);
        return;
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;