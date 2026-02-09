
import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- DYNAMIC INSTALL PATH (Uses Current Location) ---
const INSTALL_DIR = __dirname; 

// Create Readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("---------------------------------------------------------");
console.log("   Payment System - Windows Service Installer (Roboust)  ");
console.log("---------------------------------------------------------");
console.log(`> Installing from: ${INSTALL_DIR}`);

// 2. Ask for Port
rl.question('Please enter the port number (Press Enter for 80): ', (inputPort) => {
  const port = inputPort.trim() || '80';
  console.log(`> Using Port: ${port}`);

  // 3. Create .env in the target directory
  const envContent = `PORT=${port}\n`;
  try {
    fs.writeFileSync(path.join(INSTALL_DIR, '.env'), envContent);
    console.log('> Saved configuration to .env file');
  } catch (err) {
    console.error('> Error writing .env file:', err);
    rl.close();
    return;
  }

  // 4. Configure Service
  const puppeteerCache = path.join(INSTALL_DIR, '.puppeteer');

  const svc = new Service({
    name: 'PaymentSystem',
    description: 'Payment Order Management System Web Server',
    // Point to the script RELATIVE to the install dir
    script: path.join(INSTALL_DIR, 'server.js'), 
    workingDirectory: INSTALL_DIR, // *** CRITICAL: Force Service to run in THIS dir ***
    env: [{
      name: "PORT",
      value: port
    }, {
      name: "PUPPETEER_CACHE_DIR",
      value: puppeteerCache
    }]
  });

  // 5. Listen for events
  svc.on('install', function() {
    console.log('> Service installed successfully!');
    console.log('> Starting service...');
    svc.start();
    console.log('> Service started in BACKGROUND.');
    console.log(`> IMPORTANT: Bot logs are now hidden. Check "service_debug.log" in this folder for output.`);
  });

  svc.on('alreadyinstalled', function() {
    console.log('Service already installed. Please run "node uninstall-service.js" first.');
    // Try start anyway
    svc.start(); 
  });

  svc.on('start', function() {
    console.log(`> Service started! App is running on http://localhost:${port}`);
    rl.close();
  });

  svc.on('error', function(e) {
    console.error('> Error:', e);
    rl.close();
  });

  // 6. Install
  console.log('> Installing Windows Service...');
  svc.install();
});
