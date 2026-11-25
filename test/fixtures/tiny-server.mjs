#!/usr/bin/env node
// A tiny HTTP server for tests: node tiny-server.mjs <port> [--crash]
import http from 'node:http';

const port = Number(process.argv[2] ?? '4300');
if (process.argv.includes('--crash')) {
  console.error('tiny-server: crashing on purpose');
  process.exit(1);
}
http
  .createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
  })
  .listen(port, '127.0.0.1', () => console.log(`tiny-server on ${port}`));
