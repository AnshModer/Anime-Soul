import React, { useState } from 'react';
import { Character, AppMode } from './types';
import CharacterList from './components/CharacterList';
import ChatInterface from './components/ChatInterface';
import LiveCall from './components/LiveCall';
import { CHARACTERS } from './constants';

const App: React.FC = () => {
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(CHARACTERS[0]);
  const [mode, setMode] = useState<AppMode>(AppMode.CHAT);
  // Mobile sidebar toggle state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleSelectCharacter = (character: Character) => {
    setSelectedCharacter(character);
    setMode(AppMode.CHAT);
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleStartCall = () => {
    setMode(AppMode.LIVE_CALL);
  };

  const handleEndCall = () => {
    setMode(AppMode.CHAT);
  };

  return (
    <div className="flex h-screen w-screen bg-black text-white overflow-hidden font-sans">
      
      {/* Sidebar - Desktop: Always visible, Mobile: Toggled */}
      <div className={`fixed inset-y-0 left-0 z-30 w-full md:w-80 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <CharacterList 
          onSelect={handleSelectCharacter} 
          selectedId={selectedCharacter.id}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative w-full h-full bg-gray-900">
        
        {mode === AppMode.CHAT && (
          <ChatInterface 
            character={selectedCharacter}
            onBack={() => setIsSidebarOpen(true)}
            onStartCall={handleStartCall}
          />
        )}

        {mode === AppMode.LIVE_CALL && (
          <LiveCall 
            character={selectedCharacter}
            onEndCall={handleEndCall}
          />
        )}

      </div>
    </div>
  );
};

export default App;
