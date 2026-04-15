/**
 * React Development Proxy Configuration
 * This file is automatically detected by Create React App during development
 * to proxy requests to your internal APIs and avoid CORS issues.
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

// API key for authentication
const API_KEY = '0b760c5caff24c6c7daa3e5400cc0530';

module.exports = function(app) {
  console.log('Setting up proxy middleware for authenticated API endpoints');

  // Proxy for OSRM API
  app.use(
    '/osrm',
    createProxyMiddleware({
      target: 'https://osrm.westchesterrtc.com',
      changeOrigin: true,
      pathRewrite: {
        '^/osrm': '' // Remove the /osrm prefix
      },
      logLevel: 'debug',
      onProxyReq: function(proxyReq, req, res) {
        // Add API key to all requests
        proxyReq.setHeader('X-API-Key', API_KEY);
        console.log(`[PROXY] ${req.method} request to OSRM API: ${req.originalUrl}`);
      },
      onProxyRes: function(proxyRes, req, res) {
        console.log(`[PROXY] Response from OSRM API: ${proxyRes.statusCode}`);
      }
    })
  );

  // Proxy for Overpass API
  app.use(
    '/overpass',
    createProxyMiddleware({
      target: 'https://overpass.westchesterrtc.com',
      changeOrigin: true,
      // Don't rewrite paths - send them as-is
      prependPath: false,
      logLevel: 'debug',
      onProxyReq: function(proxyReq, req, res) {
        // Add API key to all requests
        proxyReq.setHeader('X-API-Key', API_KEY);
        console.log(`[PROXY] ${req.method} request to Overpass API: ${req.originalUrl}`);
        
        // Don't modify anything else - pass through as-is
        if (req.method === 'POST') {
          console.log('[PROXY] Request body length:', req.headers['content-length']);
        }
      },
      onProxyRes: function(proxyRes, req, res) {
        console.log(`[PROXY] Response from Overpass API: ${proxyRes.statusCode}`);
      }
    })
  );
  
  // Proxy for Nominatim API
  app.use(
    '/nominatim',
    createProxyMiddleware({
      target: 'https://nominatim.westchesterrtc.com',
      changeOrigin: true,
      pathRewrite: {
        '^/nominatim': '' // Remove the /nominatim prefix
      },
      logLevel: 'debug',
      onProxyReq: function(proxyReq, req, res) {
        // Add API key to all requests
        proxyReq.setHeader('X-API-Key', API_KEY);
        console.log(`[PROXY] ${req.method} request to Nominatim API: ${req.originalUrl}`);
      },
      onProxyRes: function(proxyRes, req, res) {
        console.log(`[PROXY] Response from Nominatim API: ${proxyRes.statusCode}`);
      }
    })
  );
};
