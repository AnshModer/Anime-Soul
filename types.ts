export interface Character {
  id: string;
  name: string;
  anime: string;
  category?: 'Naruto' | 'Demon Slayer' | 'Other Anime';
  group?: string;
  description: string;
  systemInstruction: string;
  themeColor: string;
  avatarUrl: string;
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
