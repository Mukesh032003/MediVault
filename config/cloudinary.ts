// Cloudinary Configuration
export const CLOUDINARY_CONFIG = {
  cloudName: "ddjaxktjz",
  uploadPreset: "medivault_uploads", // Replace with your actual preset name
  apiKey: "632236115849957",
};

// Cloudinary upload URL
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`;
