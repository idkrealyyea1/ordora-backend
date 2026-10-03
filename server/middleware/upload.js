'use strict';

/**
 * Image upload handling.
 * - multer memory storage (nothing is stored before validation)
 * - MIME type + magic-byte sniffing (extension is derived from content, not filename)
 * - size limit from config
 * - filenames are random UUIDs inside fixed subdirectories → no path traversal
 * - bytes are persisted in PostgreSQL (files.service) so uploads survive redeploys
 */

const multer = require('multer');
const config = require('../../config');
const { badRequest } = require('../utils/errors');
const { newId } = require('../utils/ids');
const files = require('../services/files.service');

const ALLOWED_TYPES = {
  'image/jpeg': { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  'image/png': { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
  'image/webp': { ext: 'webp', magic: null }, // checked separately (RIFF....WEBP)
};

const SUBDIRS = new Set(['logos', 'covers', 'items', 'hero']);

function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  for (const [mime, spec] of Object.entries(ALLOWED_TYPES)) {
    if (!spec.magic) continue;
    if (spec.magic.every((byte, i) => buffer[i] === byte)) return mime;
  }
  // WEBP: bytes 0-3 "RIFF", bytes 8-11 "WEBP"
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
    fields: 20,
    fieldSize: 16 * 1024,
  },
});

/** Express middleware: expects multipart field "image" and ?type=logos|covers|items */
function handleImageUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) return next(err);
    try {
      const subdir = req.query.type;
      if (!SUBDIRS.has(subdir)) throw badRequest('Invalid image type');

      const file = req.file;
      if (!file) throw badRequest('No image file provided (field "image")');

      const declaredOk = Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, file.mimetype);
      const detected = sniffImageType(file.buffer);
      if (!declaredOk || !detected || detected !== file.mimetype) {
        throw badRequest('Only JPEG, PNG or WebP images are allowed');
      }

      const spec = ALLOWED_TYPES[detected];
      const filename = `${newId()}.${spec.ext}`;
      req.savedImagePublicPath = `/uploads/${subdir}/${filename}`;
      req.detectedMime = detected;
      next();
    } catch (e) {
      next(e);
    }
  });
}

async function persistSavedImage(req) {
  await files.put(req.savedImagePublicPath, req.detectedMime, req.file.buffer);
}

/** Delete a previously stored upload. Refuses paths outside the uploads root. */
async function deleteUpload(publicPath) {
  if (!publicPath || typeof publicPath !== 'string' || !files.PUBLIC_PATH_RE.test(publicPath)) return;
  try {
    await files.remove(publicPath);
  } catch {
    /* best effort */
  }
}

module.exports = { handleImageUpload, persistSavedImage, deleteUpload, sniffImageType };
