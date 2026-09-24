import React, { useState, useEffect, useRef } from 'react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial greeting when character changes
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
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: new Date()
    };

    const currentHistory = [...messages, userMsg];
    setMessages(currentHistory);
    setInput('');
    setIsLoading(true);

    const responseMsgId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      {
        id: responseMsgId,
        role: 'model',
        text: '',
        timestamp: new Date()
      }
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: currentHistory.map(m => ({ role: m.role, text: m.text })),
          systemInstruction: character.systemInstruction,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponseText = '';

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  fullResponseText += parsed.text;
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === responseMsgId ? { ...msg, text: fullResponseText } : msg
                    )
                  );
                } else if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                // Ignore json parse error for partial lines
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      const isHighDemand =
        error?.message?.includes('high demand') ||
        error?.message?.includes('503') ||
        error?.message?.includes('UNAVAILABLE');
      const errorFeedback = isHighDemand
        ? '(Chakra overload from high demand! Please tap Send again to reconnect.)'
        : error?.message || '(Connection interrupted... please try again.)';

      setMessages(prev =>
        prev.map(msg =>
          msg.id === responseMsgId
            ? {
                ...msg,
                text: msg.text ? msg.text + ' ' + errorFeedback : errorFeedback,
              }
            : msg
        )
      );
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
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white text-base md:text-lg leading-tight">{character.name}</h2>
              {character.group && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 hidden sm:inline-block font-medium">
                  {character.group}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate max-w-[260px] md:max-w-[420px]">
              {character.anime} • {character.description}
            </p>
          </div>
        </div>
        
        <button 
          onClick={onStartCall}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-full text-xs md:text-sm font-semibold transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
        >
          <Phone size={15} />
          <span>Live Call</span>
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
              className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-sm md:text-base leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none shadow-md' 
                  : 'bg-gray-800/95 text-gray-100 rounded-bl-none border border-gray-700/80 shadow-sm'
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
            <p className="text-[10px] text-gray-500 flex items-center justify-center gap-1">
                <Sparkles size={10} /> Powered by Gemini Flash-Lite • Fast & Quota-Optimized
            </p>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
