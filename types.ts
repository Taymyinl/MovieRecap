export interface TranscriptSegment {
  startTime: string;
  endTime: string;
  originalText: string;
  translatedText: string;
}

export interface TranscriptResult {
  originalLanguage: string;
  translatedLanguage: string;
  segments: TranscriptSegment[];
}

export interface SavedProject {
  version: string;
  createdAt: string;
  fileName: string;
  targetLang: string;
  transcriptResult: TranscriptResult;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'my', name: 'Burmese', flag: '🇲🇲' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'zh', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
];