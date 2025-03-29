import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7070;

// Global middleware
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const corsOptions = {
  origin: ['https://neurite.network', 'http://localhost:8080'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

const servers = JSON.parse(fs.readFileSync(path.join(__dirname, 'servers.json'), 'utf8'));
const startNeurite = process.argv.includes('neurite');
const mountedServices = [];

// Function to check and install dependencies
function checkDependencies(dir) {
  return fs.existsSync(path.join(dir, 'node_modules')) &&
         (fs.existsSync(path.join(dir, 'package-lock.json')) ||
          fs.existsSync(path.join(dir, 'yarn.lock')));
}

function installDependencies(server) {
  const serverDir = path.join(__dirname, server.dir);
  if (!checkDependencies(serverDir)) {
    console.log(`Installing dependencies for ${server.name} server...`);
    execSync('npm install', { cwd: serverDir, stdio: 'inherit' });
  }
}

async function start() {
  for (const server of servers) {
    if (server.startNeurite && !startNeurite) {
      console.log(`Skipping ${server.name} server as it requires the 'neurite' flag.`);
      continue;
    }

    installDependencies(server);

    const modulePath = path.join(__dirname, server.dir, server.main);
    try {
      const moduleUrl = pathToFileURL(modulePath).href;
      const serverModule = await import(moduleUrl);
      const serverApp = serverModule.default;
      const basePath = `/${server.name.toLowerCase()}`;

      app.use(basePath, serverApp);
      mountedServices.push(server.name);
      console.log(`Mounted ${server.name} at ${basePath}`);
    } catch (error) {
      console.error(`Error importing ${server.name} from ${modulePath}:`, error);
    }
  }

  // **Health Check Endpoint**
  app.get('/check', (req, res) => {
    // Only consider servers that should run given current flags
    const expectedServices = servers
      .filter(server => !(server.startNeurite && !startNeurite))
      .map(server => server.name);
  
    const missingServices = expectedServices.filter(name => !mountedServices.includes(name));
  
    if (missingServices.length === 0) {
      res.json({
        status: 'ok',
        message: 'All expected services are running',
        services: mountedServices
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Some expected services failed to mount',
        missingServices
      });
    }
  });

  app.listen(PORT, () => {
    console.log(`Main server running on http://localhost:${PORT}`);
  });
}

start();
