import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

// Validate and configure Cloudinary
const validateCloudinaryConfig = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // Debug logging in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Cloudinary Config Check:');
    console.log('  CLOUDINARY_CLOUD_NAME:', cloudName ? '✓ Set' : '✗ Missing');
    console.log('  CLOUDINARY_API_KEY:', apiKey ? '✓ Set' : '✗ Missing');
    console.log('  CLOUDINARY_API_SECRET:', apiSecret ? '✓ Set' : '✗ Missing');
  }

  if (!cloudName || !apiKey || !apiSecret) {
    const missing = [];
    if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!apiKey) missing.push('CLOUDINARY_API_KEY');
    if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');
    
    throw new Error(
      `Cloudinary configuration missing: ${missing.join(', ')}. Please set these in your .env file and restart the server.`
    );
  }

  return { cloudName, apiKey, apiSecret };
};

// Configure Cloudinary (lazy initialization)
let isConfigured = false;
const configureCloudinary = () => {
  if (!isConfigured) {
    const { cloudName, apiKey, apiSecret } = validateCloudinaryConfig();
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    isConfigured = true;
  }
};

interface UploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

/**
 * Upload image to Cloudinary
 * @param file - File buffer or stream
 * @param folder - Folder path in Cloudinary (optional)
 * @returns Promise with uploaded image URL and public_id
 */
export const uploadToCloudinary = async (
  file: UploadFile,
  folder: string = 'zenfinance/profiles'
): Promise<{ url: string; public_id: string }> => {
  // Ensure Cloudinary is configured before use
  configureCloudinary();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [
          { width: 500, height: 500, crop: 'fill', gravity: 'face', quality: 'auto' },
        ],
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
      (error: any, result: any) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
          });
        } else {
          reject(new Error('Upload failed: No result returned'));
        }
      }
    );

    // Convert buffer to stream
    const readableStream = new Readable();
    readableStream.push(file.buffer);
    readableStream.push(null);

    readableStream.pipe(uploadStream);
  });
};

/**
 * Delete image from Cloudinary
 * @param publicId - Public ID of the image to delete
 */
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  // Ensure Cloudinary is configured before use
  configureCloudinary();

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    // Don't throw error, just log it
  }
};

/**
 * Extract public_id from Cloudinary URL
 * @param url - Cloudinary URL
 * @returns Public ID or null
 */
export const getPublicIdFromUrl = (url: string): string | null => {
  try {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    const publicId = filename.split('.')[0];
    const folderIndex = parts.indexOf('zenfinance');
    if (folderIndex !== -1 && folderIndex < parts.length - 1) {
      const folderPath = parts.slice(folderIndex, parts.length - 1).join('/');
      return `${folderPath}/${publicId}`;
    }
    return publicId;
  } catch {
    return null;
  }
};

export { cloudinary };
