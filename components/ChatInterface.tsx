import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from '@google/genai';
import { Character, Message } from '../types';
import { Send, Phone, ArrowLeft, Loader2, Sparkles } from 'lucide-react';

interface ChatInterfaceProps {
  character: Character;
  onBack: () => void;
  onStartCall: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ character, onBack, onStartCall }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset chat when character changes
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    chatSessionRef.current = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: character.systemInstruction,
      },
    });
    
    // Initial greeting
    setMessages([
      {
        id: 'init',
        role: 'model',
        text: `*${character.name} enters the chat*`,
        timestamp: new Date()
      }
    ]);
  }, [character]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatSessionRef.current || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const resultStream = await chatSessionRef.current.sendMessageStream({ message: userMsg.text });
      
      let fullResponseText = '';
      const responseMsgId = (Date.now() + 1).toString();
      
      // Add placeholder for streaming response
      setMessages(prev => [...prev, {
        id: responseMsgId,
        role: 'model',
        text: '',
        timestamp: new Date()
      }]);

      for await (const chunk of resultStream) {
        const c = chunk as GenerateContentResponse;
        const textChunk = c.text || '';
        fullResponseText += textChunk;
        
        setMessages(prev => prev.map(msg => 
          msg.id === responseMsgId ? { ...msg, text: fullResponseText } : msg
        ));
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: '(Connection interrupted... seems like the network chakra is blocked.)',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur z-10 sticky top-0">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="md:hidden text-gray-400 hover:text-white">
            <ArrowLeft size={24} />
          </button>
          <div className="relative">
             <img src={character.avatarUrl} alt={character.name} className="w-10 h-10 rounded-full object-cover border border-gray-700" />
             <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>
          </div>
          <div>
            <h2 className="font-bold text-white leading-tight">{character.name}</h2>
            <p className="text-xs text-gray-400 truncate max-w-[150px]">{character.anime}</p>
          </div>
        </div>
        
        <button 
          onClick={onStartCall}
          className={`flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-${character.themeColor}-600 to-${character.themeColor}-500 hover:from-${character.themeColor}-500 hover:to-${character.themeColor}-400 text-white rounded-full text-sm font-medium transition-all shadow-lg shadow-${character.themeColor}-500/20`}
        >
          <Phone size={16} />
          <span>Call</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-3 text-sm md:text-base leading-relaxed ${
                msg.role === 'user' 
                  ? `bg-${character.themeColor}-600 text-white rounded-br-none` 
                  : 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'
              }`}
            >
              {msg.text || <span className="animate-pulse">...</span>}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-900 border-t border-gray-800">
        <div className="relative flex items-end bg-gray-800 rounded-2xl border border-gray-700 focus-within:border-gray-500 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${character.name}...`}
            className="w-full bg-transparent text-white p-4 max-h-32 min-h-[56px] resize-none outline-none placeholder-gray-500"
            rows={1}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`p-3 m-1 rounded-xl transition-all ${
              input.trim() 
                ? `bg-${character.themeColor}-500 text-white hover:bg-${character.themeColor}-400` 
                : 'text-gray-500 hover:bg-gray-700'
            }`}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
        <div className="text-center mt-2">
            <p className="text-[10px] text-gray-600 flex items-center justify-center gap-1">
                <Sparkles size={10} /> Powered by Gemini 2.5 Flash
            </p>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
