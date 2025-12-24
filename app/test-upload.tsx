import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

export default function TestUpload() {
  const [uploading, setUploading] = useState(false);

  const testDocumentPicker = async () => {
    try {
      setUploading(true);
      console.log('Testing document picker...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Allow all file types for testing
        copyToCacheDirectory: true,
      });

      console.log('Result:', JSON.stringify(result, null, 2));
      
      if (!result.canceled) {
        Alert.alert('Success', `Selected: ${result.assets?.[0]?.name || 'Unknown file'}`);
      } else {
        Alert.alert('Info', 'Selection canceled');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test Document Upload</Text>
      <TouchableOpacity
        style={[styles.button, uploading && styles.buttonDisabled]}
        onPress={testDocumentPicker}
        disabled={uploading}
      >
        <Text style={styles.buttonText}>
          {uploading ? 'Testing...' : 'Test Document Picker'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    minWidth: 200,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
  },
});
