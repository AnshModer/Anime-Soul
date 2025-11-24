export interface Character {
  id: string;
  name: string;
  anime: string;
  description: string;
  systemInstruction: string;
  themeColor: string;
  avatarUrl: string; // Using picsum for placeholder
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum AppMode {
  SELECT = 'SELECT',
  CHAT = 'CHAT',
  LIVE_CALL = 'LIVE_CALL'
}
