import React, { useState, useEffect } from 'react';
import { X, Save, FileVideo } from 'lucide-react';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fileName: string, videoName: string) => void;
  defaultFileName: string;
  defaultVideoName: string;
}

const SaveModal: React.FC<SaveModalProps> = ({ 
  isOpen, onClose, onConfirm, defaultFileName, defaultVideoName 
}) => {
  const [fileName, setFileName] = useState(defaultFileName);
  const [videoName, setVideoName] = useState(defaultVideoName);

  useEffect(() => {
    if (isOpen) {
      setFileName(defaultFileName);
      setVideoName(defaultVideoName);
    }
  }, [isOpen, defaultFileName, defaultVideoName]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-white">Save Project</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 block">Project File Name</label>
            <input 
              type="text" 
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-red-500/50 outline-none"
              placeholder="my_transcript.json"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 block flex items-center gap-2">
              <FileVideo className="w-4 h-4" />
              Video Source Name
            </label>
            <p className="text-xs text-zinc-500">
              The name of the video file associated with this transcript.
            </p>
            <input 
              type="text" 
              value={videoName}
              onChange={(e) => setVideoName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-red-500/50 outline-none"
              placeholder="video.mp4"
            />
          </div>
        </div>

        <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onConfirm(fileName, videoName)}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveModal;