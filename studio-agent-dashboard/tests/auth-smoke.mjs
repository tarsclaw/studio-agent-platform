import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'dist');
const port = Number(process.env.AUTH_SMOKE_PORT || 4174);
const baseUrl = process.env.AUTH_SMOKE_BASE_URL || `http://localhost:${port}`;

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', baseUrl);
  let filePath = path.join(root, url.pathname);

  if (url.pathname === '/' || !path.extname(url.pathname)) {
    filePath = path.join(root, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  res.setHeader('Content-Type', contentType(filePath));
  res.end(fs.readFileSync(filePath));
});

let serverStarted = false;
if (!process.env.AUTH_SMOKE_BASE_URL) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      serverStarted = true;
      resolve();
    });
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => {
  consoleErrors.push(String(err));
});

try {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const currentUrl = page.url();
  const html = await page.content();
  const env = await page.evaluate(() => window.__STUDIO_AGENT_ENV__ ?? null);

  if (!currentUrl.includes('/dashboard')) {
    throw new Error(`Expected to remain on /dashboard route, got ${currentUrl}`);
  }

  if (!currentUrl.includes('/overview')) {
    throw new Error(`Expected dashboard shell redirect to /overview, got ${currentUrl}`);
  }

  if (html.includes('/.auth/login/aad')) {
    throw new Error('Found legacy SWA auth redirect in rendered HTML');
  }

  if (consoleErrors.some((msg) => msg.includes('swa_login_redirect_started'))) {
    throw new Error('Legacy SWA login flow still triggered');
  }

  if ((env?.azureAdClientId ?? '') === '' || (env?.azureAdTenantId ?? '') === '') {
    throw new Error('MSAL environment was not exposed to the running app');
  }

  console.log(JSON.stringify({ ok: true, currentUrl, env, consoleErrors }, null, 2));
} finally {
  await browser.close();
  if (serverStarted) {
    await new Promise((resolve) => server.close(resolve));
  }
}
