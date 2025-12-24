import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';

export default function TestChat() {
  const [query, setQuery] = useState('What do you see in this image?');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testChatAPI = async () => {
    setLoading(true);
    try {
      console.log('Testing chat API...');
      
      // Create a simple test without files first
      const formData = new FormData();
      formData.append('query', query);
      
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        setResult(`✅ Chat API works! Response: ${data.response}`);
      } else {
        const errorText = await response.text();
        setResult(`❌ Chat API error (${response.status}): ${errorText}`);
      }
    } catch (error) {
      console.error('Chat API error:', error);
      setResult(`❌ Chat API failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat API Test</Text>
      
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Enter test query"
      />
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={testChatAPI}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Testing...' : 'Test Chat API'}
        </Text>
      </TouchableOpacity>

      {result ? <Text style={styles.result}>{result}</Text> : null}
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
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    width: '100%',
    marginBottom: 20,
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
  result: {
    marginTop: 20,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: '90%',
  },
});
