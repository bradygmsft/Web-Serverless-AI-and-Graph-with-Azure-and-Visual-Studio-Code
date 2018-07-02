
/**
 * Module dependencies.
 */
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
}

const logger = require('koa-logger');
const serve = require('koa-static');
const koaBody = require('koa-body');
const Koa = require('koa');
const fs = require('fs');
const app = new Koa();
const os = require('os');
const path = require('path');

// storage 
const storage = require('azure-storage');
const blobService = storage.createBlobService();
const containerName = 'demo-uploads';

var blobName = '';

// creates the storage container
const createContainer = () => {
  return new Promise((resolve, reject) => {
    blobService.createContainerIfNotExists(containerName, { publicAccessLevel: 'blob' }, err => {
      if (err) {
        reject(err);
      } else {
        resolve({ message: `Container '${containerName}' created` });
      }
    });
  });
};

// upload the file
const upload = (sourceFilePath, originalFilename) => {
  var blobName = path.basename(sourceFilePath, path.extname(sourceFilePath));
  return new Promise((resolve, reject) => {
      blobService.createBlockBlobFromLocalFile(containerName, originalFilename, sourceFilePath, err => {
          if (err) {
              reject(err);
          } else {
              resolve({ message: `Upload of '${blobName}' complete` });
          }
      });
  });
};


// log requests
app.use(logger());
app.use(koaBody({ multipart: true }));

// custom 404
app.use(async function (ctx, next) {
  await next();
  if (ctx.body || !ctx.idempotent) return;
  ctx.redirect('/404.html');
});

// serve files from ./public
app.use(serve(path.join(__dirname, '/public')));

// handle uploads
app.use(async function (ctx, next) {
  // ignore non-POSTs
  if ('POST' != ctx.method) return await next();

  createContainer().then(() => {
    const file = ctx.request.body.files.file;
    console.log('uploading %s to storage blob', file.path);
    upload(file.path, file.name);
  });

  ctx.redirect('/');
});

// listen
app.listen(3000);
console.log('listening on port 3000');
