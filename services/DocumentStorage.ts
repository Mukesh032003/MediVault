import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLOUDINARY_CONFIG, CLOUDINARY_UPLOAD_URL } from '../config/cloudinary';

export interface MedicalDocument {
  id: string;
  name: string;
  url: string; // Cloudinary URL
  type: string;
  uploadDate: string;
  size: number;
  category: 'Medical Scan' | 'Medical Report' | 'Medical Bill' | 'Other';
}

const DOCUMENTS_STORAGE_KEY = 'medivault_documents';

// Simple categorization based on filename and type
function categorizeDocument(filename: string, fileType: string): 'Medical Scan' | 'Medical Report' | 'Medical Bill' | 'Other' {
  const name = filename.toLowerCase();
  
  // Medical Bills - check first for specific keywords
  if (name.includes('bill') || 
      name.includes('invoice') || 
      name.includes('receipt') || 
      name.includes('payment') || 
      name.includes('charge') || 
      name.includes('cost') || 
      name.includes('fee')) {
    return 'Medical Bill';
  }
  
  // Medical Reports - check for report keywords and PDFs
  if (name.includes('report') || 
      name.includes('result') || 
      name.includes('test') || 
      name.includes('lab') || 
      name.includes('blood') || 
      name.includes('analysis') || 
      name.includes('diagnosis') || 
      name.includes('prescription') ||
      fileType.includes('pdf')) {
    return 'Medical Report';
  }
  
  // Medical Scans - images and scan-related keywords (check last)
  if (fileType.includes('image') || 
      name.includes('scan') || 
      name.includes('xray') || 
      name.includes('x-ray') || 
      name.includes('mri') || 
      name.includes('ct') || 
      name.includes('ultrasound') || 
      name.includes('mammogram') || 
      name.includes('ecg') || 
      name.includes('ekg')) {
    return 'Medical Scan';
  }
  
  return 'Other';
}

export class DocumentStorage {
  static async uploadToCloudinary(file: File): Promise<MedicalDocument> {
    try {
      console.log('Uploading to Cloudinary:', file.name, 'Size:', file.size, 'bytes');
      
      // Check file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error(`File too large. Maximum size is 10MB, got ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      }
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
      formData.append('folder', 'medical_reports');
      
      console.log('Sending request to Cloudinary...');
      
      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('Response status:', response.status);

      const responseText = await response.text();
      console.log('Response received');

      if (!response.ok) {
        throw new Error(`Cloudinary upload failed: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('Upload successful:', data.public_id);

      const document: MedicalDocument = {
        id: data.public_id,
        name: file.name,
        url: data.secure_url,
        type: file.type,
        uploadDate: new Date().toISOString(),
        size: data.bytes || file.size,
        category: categorizeDocument(file.name, file.type),
      };

      // Store persistently
      const documents = await this.getDocuments();
      documents.push(document);
      await AsyncStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
      console.log('Document stored, total documents:', documents.length);

      return document;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      
      if (error.name === 'AbortError') {
        throw new Error('Upload timed out. Please try with a smaller file or check your internet connection.');
      }
      
      throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
    }
  }

  static async getDocuments(): Promise<MedicalDocument[]> {
    try {
      const data = await AsyncStorage.getItem(DOCUMENTS_STORAGE_KEY);
      if (!data) return [];
      
      const documents = JSON.parse(data);
      console.log('Getting documents, count:', documents.length);
      return documents;
    } catch (error) {
      console.error('Error loading documents:', error);
      return [];
    }
  }

  static async deleteDocument(id: string): Promise<void> {
    try {
      console.log('Deleting document:', id);
      const documents = await this.getDocuments();
      const filtered = documents.filter(doc => doc.id !== id);
      await AsyncStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  }

  static async deleteAllDocuments(): Promise<void> {
    try {
      console.log('Deleting all documents');
      await AsyncStorage.removeItem(DOCUMENTS_STORAGE_KEY);
    } catch (error) {
      console.error('Error deleting all documents:', error);
    }
  }
}
