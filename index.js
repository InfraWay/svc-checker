const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const expressServer = express();
const config = {
  port: process.env.PORT || 80,
};

async function getExternalIP() {
  const res = await fetch('https://ipinfo.io', {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  });

  return res.json();
}

function getUserIP(req) {
  return (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
}

function initMiddlewares(server) {
  server.use(cors({
    origin: ["http://localhost:3000", "*"],
    credentials: true,
  }));

  server.get('/', async (req, res) => {
    const { ip } = await getExternalIP();
    res.json({
      "client_ip": getUserIP(req),
      "external_ip": ip,
    });
  })
}

let getServerPromise;

function getServer() {
  if (getServerPromise) {
    return getServerPromise;
  }

  getServerPromise = new Promise(async (resolve, reject) => {
    try {
      initMiddlewares(expressServer);
      resolve({
        server: expressServer,
      });
    } catch (e) {
      reject(e);
    }
  });
  return getServerPromise;
}

async function runServer() {
  const { server } = await getServer();
  await new Promise((resolve, reject) => {
    server.listen(config.port, (e) => (e ? reject(e) : resolve()));
  });
}

if (require.main === module) {
  runServer().then(
    () => console.info(`The server is running at http://localhost:${config.port}/`),
    (error) => console.error(error.message, error),
  );
}

module.exports = expressServer;
