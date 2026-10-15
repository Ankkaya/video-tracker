import { createServer } from 'wxt';
const server = await createServer({ webExt: { disabled: true } });
await server.start();
