import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Animated, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { DocumentStorage, MedicalDocument } from '../../services/DocumentStorage';
import { ApiService } from '../../services/ApiService';
import { ChatHistory, ChatMessage, ChatSession } from '../../services/ChatHistory';

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadDocuments();
    loadChatHistory();
    initializeChat();
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // Reload documents when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadDocuments();
      loadChatHistory();
    }, [])
  );

  useEffect(() => {
    // Reload documents when the document selector is opened
    if (showDocuments) {
      loadDocuments();
    }
  }, [showDocuments]);

  const loadDocuments = async () => {
    try {
      const docs = await DocumentStorage.getDocuments();
      console.log('Loaded documents:', docs.length);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const loadChatHistory = async () => {
    const sessions = await ChatHistory.getAllSessions();
    setChatSessions(sessions);
    
    const current = await ChatHistory.getCurrentSession();
    if (current) {
      setCurrentSession(current);
      setMessages(current.messages);
    }
  };

  const initializeChat = async () => {
    const current = await ChatHistory.getCurrentSession();
    if (!current) {
      addWelcomeMessage();
    }
  };

  const addWelcomeMessage = () => {
    const welcomeMessage: ChatMessage = {
      id: Date.now().toString(),
      text: "Hello! I'm your medical assistant. Upload your medical reports and ask me questions about them.",
      isUser: false,
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const startNewChat = async () => {
    if (currentSession && messages.length > 1) {
      await saveCurrentSession();
    }
    
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setCurrentSession(newSession);
    setMessages([]);
    addWelcomeMessage();
    await ChatHistory.setCurrentSession(newSession);
  };

  const saveCurrentSession = async () => {
    if (!currentSession || messages.length <= 1) return;
    
    const title = messages.find(m => m.isUser)?.text 
      ? ChatHistory.generateSessionTitle(messages.find(m => m.isUser)!.text)
      : 'New Chat';
    
    const updatedSession: ChatSession = {
      ...currentSession,
      title,
      messages,
      updatedAt: new Date(),
    };
    
    await ChatHistory.saveSession(updatedSession);
    setCurrentSession(updatedSession);
    
    const sessions = await ChatHistory.getAllSessions();
    setChatSessions(sessions);
  };

  const loadChatSession = async (session: ChatSession) => {
    if (currentSession && messages.length > 1) {
      await saveCurrentSession();
    }
    
    setCurrentSession(session);
    setMessages(session.messages);
    await ChatHistory.setCurrentSession(session);
    setShowHistory(false);
  };

  const deleteChatSession = async (sessionId: string) => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Delete from storage
            await ChatHistory.deleteSession(sessionId);
            
            // Update UI immediately
            setChatSessions(prev => prev.filter(session => session.id !== sessionId));
            
            // If deleting current session, start new chat
            if (currentSession?.id === sessionId) {
              await startNewChat();
            }
          },
        },
      ]
    );
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const currentInput = inputText;
    setInputText('');
    setLoading(true);
    setIsTyping(true);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const response = await queryDocuments(currentInput);
      
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
        timestamp: new Date(),
      };

      const finalMessages = [...newMessages, botMessage];
      setMessages(finalMessages);
      
      if (currentSession) {
        const updatedSession = {
          ...currentSession,
          messages: finalMessages,
          updatedAt: new Date(),
        };
        setCurrentSession(updatedSession);
        await ChatHistory.setCurrentSession(updatedSession);
      }
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: `Error: ${error.message}`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const queryDocuments = async (query: string): Promise<string> => {
    try {
      if (selectedDocuments.length === 0) {
        // Chat without documents - general medical questions
        const formData = new FormData();
        formData.append('query', query);
        
        const response = await fetch('http://localhost:8000/chat', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.response;
        } else {
          throw new Error(`Backend error: ${response.status}`);
        }
      }

      // Chat with selected documents
      const selectedDocs = documents.filter(doc => selectedDocuments.includes(doc.id));
      
      try {
        const response = await ApiService.chatWithDocuments(query, selectedDocs);
        return response;
      } catch (docError) {
        // Fallback to general chat if document processing fails
        const formData = new FormData();
        formData.append('query', `${query} (Note: User has ${selectedDocs.length} selected document(s) but they couldn't be processed)`);
        
        const response = await fetch('http://localhost:8000/chat', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.response + "\n\n(Note: Your selected documents couldn't be processed, but I can still help with general medical questions.)";
        } else {
          throw new Error(`Backend error: ${response.status}`);
        }
      }
    } catch (error) {
      return `Error: ${error.message}. Make sure your backend is running at the correct URL.`;
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <Animated.View 
      style={[
        styles.messageContainer,
        item.isUser ? styles.userMessage : styles.botMessage,
        { opacity: fadeAnim }
      ]}
    >
      {item.isUser ? (
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.userMessageGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.userMessageText}>{item.text}</Text>
        </LinearGradient>
      ) : (
        <View style={styles.botMessageContent}>
          <View style={styles.botAvatar}>
            <Ionicons name="medical" size={16} color="#667eea" />
          </View>
          <View style={styles.botTextContainer}>
            <Text style={styles.botMessageText}>{item.text}</Text>
          </View>
        </View>
      )}
      <Text style={[styles.timestamp, item.isUser ? styles.userTimestamp : styles.botTimestamp]}>
        {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </Animated.View>
  );

  const renderTypingIndicator = () => {
    if (!isTyping) return null;
    
    return (
      <View style={[styles.messageContainer, styles.botMessage]}>
        <View style={styles.botMessageContent}>
          <View style={styles.botAvatar}>
            <Ionicons name="medical" size={16} color="#667eea" />
          </View>
          <View style={styles.typingContainer}>
            <ActivityIndicator size="small" color="#667eea" />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#f8f9ff', '#e8f0ff']}
      style={styles.container}
    >
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>MediVault Assistant</Text>
            {selectedDocuments.length > 0 ? (
              <Text style={styles.documentsInfo}>
                {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} selected
              </Text>
            ) : (
              <Text style={styles.documentsInfo}>
                {documents.length} document{documents.length !== 1 ? 's' : ''} available
              </Text>
            )}
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowDocuments(true)}
            >
              <Ionicons name="document-text-outline" size={20} color="#667eea" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setShowHistory(true)}
            >
              <Ionicons name="time-outline" size={20} color="#667eea" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={startNewChat}
            >
              <Ionicons name="add-outline" size={20} color="#667eea" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messagesList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messagesContent}
        ListFooterComponent={renderTypingIndicator}
      />

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about your medical reports..."
            multiline
            maxLength={500}
            placeholderTextColor="#999"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || loading) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={18} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showDocuments} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.documentSelectorContainer}>
          <View style={styles.documentSelectorHeader}>
            <Text style={styles.documentSelectorTitle}>Select Documents</Text>
            <TouchableOpacity onPress={() => setShowDocuments(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {documents.length > 0 && (
            <Text style={styles.debugText}>
              Found {documents.length} documents
            </Text>
          )}
          
          <FlatList
            data={documents}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.documentSelectorItem,
                  selectedDocuments.includes(item.id) && styles.selectedDocumentItem
                ]}
                onPress={() => {
                  setSelectedDocuments(prev => 
                    prev.includes(item.id) 
                      ? prev.filter(id => id !== item.id)
                      : [...prev, item.id]
                  );
                }}
              >
                <View style={styles.documentSelectorIcon}>
                  <Ionicons 
                    name={item.category === 'Medical Scan' ? 'scan-outline' : 
                          item.category === 'Medical Report' ? 'document-text-outline' : 
                          item.category === 'Medical Bill' ? 'receipt-outline' : 'document-outline'} 
                    size={20} 
                    color={selectedDocuments.includes(item.id) ? 'white' : '#667eea'} 
                  />
                </View>
                <View style={styles.documentSelectorInfo}>
                  <Text style={[
                    styles.documentSelectorName,
                    selectedDocuments.includes(item.id) && styles.selectedDocumentText
                  ]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.documentSelectorMeta}>
                    <Text style={[
                      styles.documentSelectorCategory,
                      selectedDocuments.includes(item.id) && styles.selectedDocumentSubtext
                    ]}>
                      {item.category}
                    </Text>
                    <Text style={[
                      styles.documentSelectorDate,
                      selectedDocuments.includes(item.id) && styles.selectedDocumentSubtext
                    ]}>
                      {new Date(item.uploadDate).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.checkboxContainer}>
                  {selectedDocuments.includes(item.id) && (
                    <Ionicons name="checkmark" size={20} color="white" />
                  )}
                </View>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyDocuments}>
                <Ionicons name="document-outline" size={48} color="#bdc3c7" />
                <Text style={styles.emptyDocumentsText}>No documents available</Text>
                <Text style={styles.emptyDocumentsSubtext}>Upload documents first to select them</Text>
              </View>
            }
          />
          
          <View style={styles.documentSelectorFooter}>
            <Text style={styles.selectedCount}>
              {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} selected
            </Text>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setShowDocuments(false)}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showHistory} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Chat History</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={chatSessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={[
                styles.historyItem,
                currentSession?.id === item.id && styles.currentHistoryItem
              ]}>
                <TouchableOpacity
                  style={styles.historyItemContent}
                  onPress={() => loadChatSession(item)}
                >
                  <Text style={styles.historyItemTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.historyItemDate}>
                    {item.updatedAt.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteChatSession(item.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#ff4444" />
                </TouchableOpacity>
              </View>
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 4,
  },
  documentsInfo: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingBottom: 20,
  },
  messageContainer: {
    marginVertical: 6,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  botMessage: {
    alignSelf: 'flex-start',
  },
  userMessageGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  userMessageText: {
    color: 'white',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  botMessageContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  botTextContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  botMessageText: {
    color: '#2c3e50',
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  userTimestamp: {
    color: '#667eea',
    textAlign: 'right',
  },
  botTimestamp: {
    color: '#95a5a6',
    marginLeft: 40,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  typingText: {
    color: '#667eea',
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e1e8ed',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 120,
    backgroundColor: '#f8f9ff',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#bdc3c7',
    shadowOpacity: 0,
    elevation: 0,
  },
  documentSelectorContainer: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  documentSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  documentSelectorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
  },
  documentSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedDocumentItem: {
    backgroundColor: '#667eea',
  },
  documentSelectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentSelectorInfo: {
    flex: 1,
  },
  documentSelectorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  selectedDocumentText: {
    color: 'white',
  },
  documentSelectorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  documentSelectorCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: '#667eea',
    textTransform: 'uppercase',
  },
  documentSelectorDate: {
    fontSize: 12,
    color: '#95a5a6',
  },
  selectedDocumentSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentSelectorFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  selectedCount: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyDocuments: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyDocumentsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#95a5a6',
    marginTop: 12,
  },
  emptyDocumentsSubtext: {
    fontSize: 14,
    color: '#bdc3c7',
    marginTop: 4,
  },
  debugText: {
    fontSize: 12,
    color: '#667eea',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  historyContainer: {
    flex: 1,
    backgroundColor: '#f8f9ff',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  currentHistoryItem: {
    backgroundColor: '#e8f0ff',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: 12,
    color: '#95a5a6',
  },
  deleteButton: {
    padding: 8,
  },
});
