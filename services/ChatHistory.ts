import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const CHAT_HISTORY_KEY = 'medivault_chat_history';
const CURRENT_SESSION_KEY = 'medivault_current_session';

export class ChatHistory {
  static async saveSession(session: ChatSession): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        sessions[existingIndex] = { ...session, updatedAt: new Date() };
      } else {
        sessions.push(session);
      }
      
      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving chat session:', error);
    }
  }

  static async getAllSessions(): Promise<ChatSession[]> {
    try {
      const data = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
      if (!data) return [];
      
      const sessions = JSON.parse(data);
      return sessions.map((s: any) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
        messages: s.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      }));
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      return [];
    }
  }

  static async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      const filtered = sessions.filter(s => s.id !== sessionId);
      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting chat session:', error);
    }
  }

  static async getCurrentSession(): Promise<ChatSession | null> {
    try {
      const data = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
      if (!data) return null;
      
      const session = JSON.parse(data);
      return {
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }))
      };
    } catch (error) {
      console.error('Error loading current session:', error);
      return null;
    }
  }

  static async setCurrentSession(session: ChatSession): Promise<void> {
    try {
      await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error setting current session:', error);
    }
  }

  static generateSessionTitle(firstMessage: string): string {
    const words = firstMessage.split(' ').slice(0, 5);
    return words.join(' ') + (firstMessage.split(' ').length > 5 ? '...' : '');
  }
}
