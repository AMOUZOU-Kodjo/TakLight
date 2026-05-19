import { v2 } from 'cloudinary';
import { config } from '../config/index.js';

cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret,
  secure: true,
});

export { cloudinary };

export function getCloudinaryUrl(publicId, options) {
  const { width = 800, height = 800, quality = 'auto', format = 'auto' } = options || {};
  return cloudinary.url(publicId, {
    width,
    height,
    quality,
    fetch_format: format,
    crop: 'fill',
    secure: true,
  });
}

export function getThumbnailUrl(publicId) {
  return cloudinary.url(publicId, {
    width: 200,
    height: 200,
    quality: 'auto',
    crop: 'fill',
    secure: true,
  });
}
