import { startServer } from './lib/serve.mjs';
const port = +(process.argv[3] || 4173);
await startServer(process.argv[2] || 'dist', port);
console.log('http://localhost:' + port);
