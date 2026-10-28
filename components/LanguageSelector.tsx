import React from 'react';
import { SUPPORTED_LANGUAGES } from '../types';
import { ChevronDown, Globe } from 'lucide-react';

interface LanguageSelectorProps {
  selectedCode: string;
  onSelect: (code: string) => void;
  disabled: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ selectedCode, onSelect, disabled }) => {
  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedCode) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="relative group">
      <div className="flex items-center space-x-2 text-sm font-medium text-zinc-400 mb-2">
        <Globe className="w-4 h-4" />
        <span>Translate to</span>
      </div>
      <div className="relative">
        <select
          value={selectedCode}
          onChange={(e) => onSelect(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white py-3 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;