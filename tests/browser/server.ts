import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain'
};

export interface StaticHost {
  url: string;
  close: () => Promise<void>;
}

/**
 * Minimal static host for the production client bundle. The browser journey runs
 * against real build output over real HTTP; the Worker is not involved because
 * the campaign engine and MockCartographer are entirely client-side.
 */
export function serveDist(root: string): Promise<StaticHost> {
  const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const path = decodeURIComponent((request.url ?? '/').split('?')[0]);
    const candidate = join(root, normalize(path).replace(/^(\.\.[/\\])+/, ''));
    const file = existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(root, 'index.html');
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((done) => server.close(() => done()))
      });
    });
  });
}
