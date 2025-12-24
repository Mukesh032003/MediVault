import { Platform } from 'react-native';
import { MedicalDocument } from './DocumentStorage';

const API_BASE_URL = 'http://localhost:8000'; // Update with your backend URL

export interface ChatResponse {
  response: string;
  status: string;
}

export class ApiService {
  static async chatWithDocuments(query: string, documents: MedicalDocument[]): Promise<string> {
    try {
      console.log('API call to:', `${API_BASE_URL}/chat`);
      console.log('Query:', query);
      console.log('Documents:', documents.length);
      
      const formData = new FormData();
      formData.append('query', query);

      // Add document URLs to form data (Cloudinary URLs)
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        console.log('Processing document:', doc.name, 'URL:', doc.url);
        
        try {
          // Fetch the document from Cloudinary URL
          const response = await fetch(doc.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.status}`);
          }
          const blob = await response.blob();
          formData.append('files', blob, doc.name);
        } catch (fileError) {
          console.error('Error reading file:', fileError);
          throw new Error(`Cannot read document file: ${fileError.message}`);
        }
      }

      console.log('Sending request to backend...');
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Backend error (${response.status}): ${errorText}`);
      }

      const data: ChatResponse = await response.json();
      console.log('API Response:', data);
      return data.response || "No response from AI";
    } catch (error) {
      console.error('API Error:', error);
      if (error.message.includes('fetch')) {
        throw new Error('Cannot connect to backend. Is it running on ' + API_BASE_URL + '?');
      }
      throw error;
    }
  }
}
