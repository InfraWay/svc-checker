const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const redis = require('redis');
const mysql = require('mysql');

const expressServer = express();
const config = {
  port: process.env.PORT || 80,
  MYSQL_HOST: process.env.MYSQL_HOST,
  MYSQL_PORT: process.env.MYSQL_PORT,
  MYSQL_USER: process.env.MYSQL_USER,
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
  MYSQL_DB: process.env.MYSQL_DB,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT || 6379,
};

async function checkExternalIP() {
  const res = await fetch('https://api.ipify.org?format=json', {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  return res.json();
}

async function checkRedis() {
  const { REDIS_HOST: host, REDIS_PORT: port } = config;
  if (host) {
    return new Promise((resolve, reject) => {
      try {
        const client = redis.createClient(port, host);
        client.on('error', (err) => reject({ host, port, err }));
        client.incr('visits', (err, reply) => {
          if (err) {
            reject({ host, port, err });
            return;
          }
          resolve({
            host,
            port,
            incr: reply,
          })
        });
      } catch (err) {
        reject({ host, port, err });
      }
    });
  }
}

async function checkMysql() {
  const { MYSQL_USER: user, MYSQL_PASSWORD: password, MYSQL_HOST: host, MYSQL_PORT: port, MYSQL_DB: database } = config;
  if (host) {
    return new Promise((resolve, reject) => {
      try {
        const conn = mysql.createConnection({
          host,
          user,
          password,
          database,
          port,
        });
        conn.connect();
        conn.query('SELECT 1 + 1 AS solution', function (err, results, fields) {
          if (err) {
            reject({ host, port, err });
            return;
          }
          resolve({ host, port, sol: results[0].solution });
        });
        conn.end();
      } catch (err) {
        reject({ host, port, err });
      }
    });
  }
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
    const { ip } = await checkExternalIP();
    let redis;
    try {
      redis = checkRedis();
    } catch (e) {
      redis = e;
    }
    let mysql;
    try {
      mysql = checkMysql();
    } catch (e) {
      mysql = e;
    }
    res.json({
      client_ip: getUserIP(req),
      nat_ip: ip,
      redis,
      mysql,
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
