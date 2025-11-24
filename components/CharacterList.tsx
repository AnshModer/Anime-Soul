import React, { useState } from 'react';
import { CHARACTERS } from '../constants';
import { Character } from '../types';
import { Search, Zap } from 'lucide-react';

interface CharacterListProps {
  onSelect: (character: Character) => void;
  selectedId?: string;
}

const CharacterList: React.FC<CharacterListProps> = ({ onSelect, selectedId }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = CHARACTERS.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.anime.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-800">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white font-anime mb-1 flex items-center gap-2">
           <Zap className="text-yellow-400" fill="currentColor" /> AnimeSoul
        </h1>
        <p className="text-gray-500 text-sm mb-6">Talk to your favorite characters</p>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Search anime or character..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 text-white pl-10 pr-4 py-2.5 rounded-xl border border-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-600 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {filtered.map(char => (
          <button
            key={char.id}
            onClick={() => onSelect(char)}
            className={`w-full flex items-center space-x-4 p-3 rounded-xl transition-all duration-200 group ${
              selectedId === char.id 
                ? 'bg-gray-800 border-gray-700 shadow-lg' 
                : 'hover:bg-gray-900 border border-transparent hover:border-gray-800'
            }`}
          >
            <div className="relative">
               <img 
                 src={char.avatarUrl} 
                 alt={char.name} 
                 className={`w-12 h-12 rounded-full object-cover transition-transform duration-300 ${selectedId === char.id ? 'scale-110' : 'group-hover:scale-105'}`}
               />
               {selectedId === char.id && (
                 <span className={`absolute -bottom-1 -right-1 flex h-4 w-4`}>
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${char.themeColor}-400 opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-4 w-4 bg-${char.themeColor}-500`}></span>
                 </span>
               )}
            </div>
            <div className="text-left flex-1 min-w-0">
              <h3 className={`font-semibold truncate ${selectedId === char.id ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                {char.name}
              </h3>
              <p className="text-xs text-gray-500 truncate">{char.anime}</p>
            </div>
          </button>
        ))}
        
        {filtered.length === 0 && (
          <div className="text-center text-gray-600 py-10">
            No characters found.
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterList;
