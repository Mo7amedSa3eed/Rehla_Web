import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import 'dotenv/config';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const apiProxyTarget = process.env['API_PROXY_TARGET'];

// Proxy API calls during SSR/prerender so relative `/api/*` requests reach the backend.
// Configure the backend URL via `API_PROXY_TARGET` (example: http://localhost:5000).
if (apiProxyTarget) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: apiProxyTarget,
      changeOrigin: true,
      secure: false,
      pathRewrite: (path) => `/api${path}`,
    }),
  );
} else {
  app.use('/api', (req, res) => {
    res.status(502).json({
      success: false,
      message:
        'API proxy target is not configured. Set API_PROXY_TARGET (e.g. http://localhost:5000) before running SSR/prerender.',
      data: null,
      errors: ['API_PROXY_TARGET is missing'],
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
