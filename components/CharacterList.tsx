import React, { useState, useMemo } from 'react';
import { CHARACTERS } from '../constants';
import { Character } from '../types';
import { Search, Zap, X, Filter } from 'lucide-react';

interface CharacterListProps {
  onSelect: (character: Character) => void;
  selectedId?: string;
}

type CategoryType = 'All' | 'Naruto' | 'Demon Slayer' | 'Other Anime';

const CharacterList: React.FC<CharacterListProps> = ({ onSelect, selectedId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');

  // Compute counts per category
  const counts = useMemo(() => {
    return {
      All: CHARACTERS.length,
      Naruto: CHARACTERS.filter((c) => c.category === 'Naruto').length,
      'Demon Slayer': CHARACTERS.filter((c) => c.category === 'Demon Slayer').length,
      'Other Anime': CHARACTERS.filter((c) => c.category === 'Other Anime').length,
    };
  }, []);

  // Compute available groups for current category
  const availableGroups = useMemo(() => {
    if (selectedCategory === 'All') return [];
    const groups = new Set<string>();
    CHARACTERS.forEach((c) => {
      if (c.category === selectedCategory && c.group) {
        groups.add(c.group);
      }
    });
    return Array.from(groups);
  }, [selectedCategory]);

  const handleCategoryChange = (cat: CategoryType) => {
    setSelectedCategory(cat);
    setSelectedGroup('All');
  };

  const filtered = useMemo(() => {
    return CHARACTERS.filter((c) => {
      // Category filter
      if (selectedCategory !== 'All' && c.category !== selectedCategory) {
        return false;
      }
      // Group filter
      if (selectedGroup !== 'All' && c.group !== selectedGroup) {
        return false;
      }
      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(query);
        const matchesAnime = c.anime.toLowerCase().includes(query);
        const matchesGroup = c.group?.toLowerCase().includes(query);
        const matchesDesc = c.description.toLowerCase().includes(query);
        return matchesName || matchesAnime || matchesGroup || matchesDesc;
      }
      return true;
    });
  }, [selectedCategory, selectedGroup, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-800">
      {/* Brand Header */}
      <div className="p-4 border-b border-gray-800/80">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-white font-anime flex items-center gap-2">
            <Zap className="text-yellow-400" size={20} fill="currentColor" /> AnimeSoul
          </h1>
          <span className="text-[11px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-medium">
            {CHARACTERS.length} Characters
          </span>
        </div>
        <p className="text-gray-400 text-xs mb-3">Live chat in English, Hindi & Hinglish</p>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            placeholder="Search ninja, hashira, demons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 text-white pl-9 pr-8 py-2 rounded-xl border border-gray-800 focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/40 outline-none transition-all placeholder-gray-500 text-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-4 gap-1 mt-3 bg-gray-900/80 p-1 rounded-xl border border-gray-800/60">
          {(['All', 'Naruto', 'Demon Slayer', 'Other Anime'] as CategoryType[]).map((cat) => {
            const isActive = selectedCategory === cat;
            const label =
              cat === 'All'
                ? 'All'
                : cat === 'Naruto'
                ? 'Naruto'
                : cat === 'Demon Slayer'
                ? 'Slayer'
                : 'Other';
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`py-1.5 px-1 rounded-lg text-[11px] font-medium transition-all text-center truncate ${
                  isActive
                    ? 'bg-yellow-400 text-black shadow-sm font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
                title={`${cat} (${counts[cat]})`}
              >
                {label} <span className="text-[9px] opacity-75">({counts[cat]})</span>
              </button>
            );
          })}
        </div>

        {/* Group Sub-filters */}
        {availableGroups.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-2 no-scrollbar mt-1">
            <button
              onClick={() => setSelectedGroup('All')}
              className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full transition-all border ${
                selectedGroup === 'All'
                  ? 'bg-gray-200 text-black font-semibold border-gray-200'
                  : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700'
              }`}
            >
              All {selectedCategory === 'Demon Slayer' ? 'Slayers & Demons' : selectedCategory}
            </button>
            {availableGroups.map((group) => {
              const isActive = selectedGroup === group;
              return (
                <button
                  key={group}
                  onClick={() => setSelectedGroup(group)}
                  className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full transition-all border ${
                    isActive
                      ? 'bg-yellow-400/20 text-yellow-300 font-semibold border-yellow-400/50'
                      : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  {group}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Characters Count Header */}
      <div className="px-4 py-2 bg-gray-950/60 border-b border-gray-900 text-[11px] text-gray-500 flex items-center justify-between">
        <span>
          Showing <span className="text-gray-300 font-medium">{filtered.length}</span> character{filtered.length === 1 ? '' : 's'}
        </span>
        {(selectedGroup !== 'All' || searchTerm) && (
          <button
            onClick={() => {
              setSelectedGroup('All');
              setSearchTerm('');
            }}
            className="text-[10px] text-yellow-500 hover:underline flex items-center gap-1"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Characters Scroll List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {filtered.map((char) => {
          const isSelected = selectedId === char.id;
          return (
            <button
              key={char.id}
              onClick={() => onSelect(char)}
              className={`w-full flex items-center space-x-3 p-2.5 rounded-xl transition-all duration-200 group text-left ${
                isSelected
                  ? 'bg-gray-800/90 border border-yellow-500/40 shadow-md ring-1 ring-yellow-500/20'
                  : 'hover:bg-gray-900/80 border border-transparent hover:border-gray-800'
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src={char.avatarUrl}
                  alt={char.name}
                  loading="lazy"
                  className={`w-11 h-11 rounded-full object-cover transition-transform duration-300 border border-gray-700 ${
                    isSelected ? 'scale-105 border-yellow-400/60 ring-2 ring-yellow-400/20' : 'group-hover:scale-105'
                  }`}
                />
                {isSelected && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <h3
                    className={`font-semibold text-xs truncate ${
                      isSelected ? 'text-yellow-400 font-bold' : 'text-gray-200 group-hover:text-white'
                    }`}
                  >
                    {char.name}
                  </h3>
                  {char.group && (
                    <span className="shrink-0 text-[9px] px-1.5 py-0.2 bg-gray-800/90 text-gray-400 rounded border border-gray-700/60 truncate max-w-[90px]">
                      {char.group.split(' - ')[0]}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 line-clamp-1 group-hover:text-gray-300">
                  {char.description}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-gray-500">{char.anime}</span>
                </div>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-12 px-4 space-y-2">
            <Filter size={28} className="mx-auto text-gray-600 mb-2 opacity-50" />
            <p className="text-sm font-medium text-gray-400">No characters found</p>
            <p className="text-xs text-gray-600">Try adjusting your search query or category filters.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setSelectedGroup('All');
              }}
              className="mt-3 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs transition-colors"
            >
              Show all characters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterList;
