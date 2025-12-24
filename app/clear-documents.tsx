import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ClearDocuments() {
  const clearAllDocuments = async () => {
    try {
      await AsyncStorage.removeItem('medical_documents');
      Alert.alert('Success', 'All documents cleared! You can now upload new ones.');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear documents');
    }
  };

  const confirmClear = () => {
    Alert.alert(
      'Clear All Documents',
      'This will delete all uploaded medical documents. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearAllDocuments },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clear Documents</Text>
      <Text style={styles.description}>
        Clear all stored medical documents to fix any storage issues.
      </Text>
      
      <TouchableOpacity style={styles.button} onPress={confirmClear}>
        <Text style={styles.buttonText}>Clear All Documents</Text>
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
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  button: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 10,
    minWidth: 200,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
