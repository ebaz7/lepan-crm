import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svc = new Service({
  name: 'Payment Order System',
  description: 'Payment and Order Management System with Telegram & WhatsApp Bot',
  script: path.join(__dirname, 'server.js'),
  env: {
    name: "NODE_ENV",
    value: "production"
  }
});

svc.on('install', () => {
  svc.start();
  console.log('Install complete.');
});

svc.install();
