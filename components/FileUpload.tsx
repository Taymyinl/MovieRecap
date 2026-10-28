import React, { useCallback, useState } from 'react';
import { Upload, Youtube, AlertCircle, FileJson, XCircle, Film, Sparkles } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onLoadProject: (file: File) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onLoadProject }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showYoutubeAlert, setShowYoutubeAlert] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateAndSelect = (file: File) => {
    setValidationError(null);
    // Allow all common video & audio formats (MP4, MOV, WebM, MKV, AVI, TS, MP3, WAV, etc.)
    const isMedia = 
      file.type.startsWith('video/') || 
      file.type.startsWith('audio/') || 
      file.name.match(/\.(mp4|mov|webm|mkv|avi|flv|wmv|m4v|ts|mp3|wav|m4a|aac|ogg|opus)$/i);

    if (isMedia) {
      onFileSelect(file);
    } else {
      setValidationError("Please upload a valid movie recap video or audio file (MP4, MOV, WebM, MKV, MP3, etc.).");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.json')) {
        onLoadProject(file);
      } else {
        validateAndSelect(file);
      }
    }
  }, [onLoadProject]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSelect(e.target.files[0]);
    }
  };

  const handleProjectInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onLoadProject(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {validationError && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center justify-between text-red-300 text-sm animate-in fade-in">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
          <button 
            onClick={() => setValidationError(null)}
            className="text-red-400 hover:text-white text-xs underline ml-4 flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div 
        className={`relative border-2 border-dashed rounded-2xl p-10 transition-all duration-300 text-center cursor-pointer group
          ${isDragging 
            ? 'border-red-500 bg-red-500/10' 
            : 'border-zinc-700 hover:border-red-500/50 hover:bg-zinc-800/50'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('fileInput')?.click()}
      >
        <input 
          type="file" 
          id="fileInput" 
          className="hidden" 
          accept="video/*,audio/*,.mkv,.avi,.mp4,.mov,.webm"
          onChange={handleFileInput}
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 rounded-full bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
            <Film className="w-8 h-8 text-zinc-400 group-hover:text-red-500 transition-colors" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-2">
              <Sparkles className="w-3 h-3" />
              <span>Full Movie Recap & Long Video Engine</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-1">Upload Movie Recap Video</h3>
            <p className="text-zinc-400 text-sm">Drag & drop your movie recap video or audio file here</p>
            <p className="text-zinc-500 text-xs mt-2">
              MP4, MKV, MOV, WebM, MP3 &bull; Supports Full Length Movies & Recaps (10 min, 30 min, 1 hour+)
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        {/* YouTube URL Mock Input */}
        <div className="flex-1 flex items-center space-x-2 bg-zinc-900 border border-zinc-800 rounded-xl p-2 pl-4">
           <Youtube className="w-5 h-5 text-red-500 flex-shrink-0" />
           <input 
             type="text" 
             placeholder="Paste YouTube movie recap URL..." 
             className="bg-transparent border-none outline-none text-sm w-full text-zinc-300 placeholder-zinc-600"
             onFocus={() => setShowYoutubeAlert(true)}
           />
           <button 
             onClick={() => setShowYoutubeAlert(true)}
             className="px-4 py-2 bg-zinc-800 text-zinc-400 text-xs rounded-lg hover:bg-zinc-700 font-medium transition-colors"
           >
             Fetch
           </button>
        </div>

        {/* Load Project Button */}
        <div>
           <input 
            type="file" 
            id="projectInput" 
            className="hidden" 
            accept=".json"
            onChange={handleProjectInput}
          />
          <button 
            onClick={() => document.getElementById('projectInput')?.click()}
            className="flex items-center space-x-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-zinc-300 transition-colors text-sm font-medium"
          >
            <FileJson className="w-4 h-4" />
            <span>Load Project</span>
          </button>
        </div>
      </div>

      {showYoutubeAlert && (
        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start space-x-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-1">YouTube Direct Download Note</p>
            <p className="text-blue-200/70">
              Due to browser sandbox restrictions and YouTube CORS security policies, video files must be uploaded directly. 
              Please download the movie recap file locally, then drag & drop the video above.
            </p>
            <button 
              onClick={(e) => { e.stopPropagation(); setShowYoutubeAlert(false); }}
              className="mt-2 text-xs text-blue-400 hover:text-white underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;