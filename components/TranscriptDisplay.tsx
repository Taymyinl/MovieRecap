import React, { useState, useEffect, useRef } from 'react';
import { TranscriptResult, TranscriptSegment } from '../types';
import { Copy, Check, Download, Clock, Play, Save, Edit2, X, BookOpen, Pause, FastForward } from 'lucide-react';

interface TranscriptDisplayProps {
  data: TranscriptResult;
  currentTime?: number;
  onSeek?: (time: number) => void;
  onSave?: () => void;
  onUpdate?: (updatedData: TranscriptResult) => void;
  overlayMode?: boolean;
}

const parseTimestamp = (timeStr: string): number => {
  if (!timeStr) return 0;
  const normalizedStr = timeStr.replace(',', '.');
  const parts = normalizedStr.split(':').map(Number);
  if (parts.some(isNaN)) return NaN;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
};

const formatTimestamp = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return "00:00,000";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 1000);
  const msStr = ms.toString().padStart(3, '0');
  
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${msStr}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${msStr}`;
};

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({ 
  data, 
  currentTime = 0, 
  onSeek,
  onSave,
  onUpdate,
  overlayMode = false
}) => {
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedTranslated, setCopiedTranslated] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [localSegments, setLocalSegments] = useState<TranscriptSegment[]>(data.segments);
  const [shiftTimestamps, setShiftTimestamps] = useState(true);
  const [focusTime, setFocusTime] = useState<number | null>(null);
  
  // Reader Mode State
  const [isReaderMode, setIsReaderMode] = useState(false);
  const [isReaderScrolling, setIsReaderScrolling] = useState(false);
  const [readerSpeed, setReaderSpeed] = useState(1); // 1 = slow, 5 = fast

  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync local state when data changes externally (unless we are in the middle of editing)
  useEffect(() => {
    if (!isEditing) {
      setLocalSegments(data.segments);
    }
  }, [data, isEditing]);

  // Find active segment
  const activeIndex = localSegments.findIndex((seg, index) => {
    const start = parseTimestamp(seg.startTime);
    const nextSeg = localSegments[index + 1];
    const end = nextSeg ? parseTimestamp(nextSeg.startTime) : parseTimestamp(seg.endTime);
    return currentTime >= start && currentTime < end;
  });

  // Auto-focus on Edit Mode
  useEffect(() => {
    if (isEditing && activeIndex !== -1) {
      setTimeout(() => {
        const el = document.getElementById(`original-text-${activeIndex}`);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [isEditing]); // Only run when entering edit mode

  // Standard Auto-scroll effect (Sync with video)
  useEffect(() => {
    if (autoScroll && !isReaderMode && activeIndex !== -1 && activeSegmentRef.current && !isEditing) {
      activeSegmentRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [activeIndex, autoScroll, isEditing, isReaderMode]);

  // Reader Mode Teleprompter Scroll
  useEffect(() => {
    let animationFrameId: number;
    let lastTime: number = 0;

    const animateScroll = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      
      if (isReaderScrolling && containerRef.current && deltaTime >= 16) { // ~60fps
         // Speed factor: 1 = 0.5px/frame, 10 = 5px/frame
         // Reduced to ~70% of previous 0.3 value (0.21)
         const pxPerFrame = readerSpeed * 0.21;
         containerRef.current.scrollTop += pxPerFrame;
         lastTime = timestamp;
      }
      
      if (isReaderScrolling) {
        animationFrameId = requestAnimationFrame(animateScroll);
      }
    };

    if (isReaderScrolling) {
      animationFrameId = requestAnimationFrame(animateScroll);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isReaderScrolling, readerSpeed]);

  const handleSegmentChange = (index: number, field: keyof TranscriptSegment, value: string) => {
    const newSegments = [...localSegments];
    newSegments[index] = { ...newSegments[index], [field]: value };
    setLocalSegments(newSegments);
  };

  const handleTimestampFocus = (timeStr: string) => {
    const time = parseTimestamp(timeStr);
    if (!isNaN(time)) {
      setFocusTime(time);
    }
  };

  const handleTimestampBlur = (index: number, field: 'startTime' | 'endTime', value: string) => {
    if (focusTime === null) return;
    
    const newTime = parseTimestamp(value);
    
    // If invalid format, revert to original focus time
    if (isNaN(newTime)) {
      const newSegments = [...localSegments];
      newSegments[index] = { ...newSegments[index], [field]: formatTimestamp(focusTime) };
      setLocalSegments(newSegments);
      setFocusTime(null);
      return;
    }

    const delta = newTime - focusTime;
    
    // If no change, do nothing
    if (delta === 0) {
      setFocusTime(null);
      return;
    }

    // Apply updates
    const newSegments = [...localSegments];
    
    // Format the current field correctly
    newSegments[index] = { ...newSegments[index], [field]: formatTimestamp(newTime) };

    if (shiftTimestamps) {
      // If editing StartTime: Shift EndTime of current + Start/End of all subsequent
      if (field === 'startTime') {
        const currentEnd = parseTimestamp(newSegments[index].endTime);
        if (!isNaN(currentEnd)) {
           newSegments[index].endTime = formatTimestamp(currentEnd + delta);
        }
      }
      
      // Shift all subsequent segments
      for (let i = index + 1; i < newSegments.length; i++) {
        const sStart = parseTimestamp(newSegments[i].startTime);
        const sEnd = parseTimestamp(newSegments[i].endTime);
        
        if (!isNaN(sStart)) newSegments[i].startTime = formatTimestamp(sStart + delta);
        if (!isNaN(sEnd)) newSegments[i].endTime = formatTimestamp(sEnd + delta);
      }
    }
    
    setLocalSegments(newSegments);
    setFocusTime(null);
  };

  const saveEdits = () => {
    // Filter out segments where both text fields are empty
    const validSegments = localSegments.filter(seg => 
      seg.originalText.trim().length > 0 || seg.translatedText.trim().length > 0
    );

    if (onUpdate) {
      onUpdate({ ...data, segments: validSegments });
    }
    
    setLocalSegments(validSegments);
    setIsEditing(false);
  };

  const cancelEdits = () => {
    setLocalSegments(data.segments);
    setIsEditing(false);
  };

  const getFullText = (isOriginal: boolean) => {
    return localSegments
      .map(s => isOriginal ? s.originalText : s.translatedText)
      .join('\n');
  };

  const copyToClipboard = async (isOriginal: boolean) => {
    try {
      const text = getFullText(isOriginal);
      await navigator.clipboard.writeText(text);
      if (isOriginal) {
        setCopiedOriginal(true);
        setTimeout(() => setCopiedOriginal(false), 2000);
      } else {
        setCopiedTranslated(true);
        setTimeout(() => setCopiedTranslated(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const downloadSRT = () => {
    let srtContent = '';
    localSegments.forEach((segment, index) => {
      const formatSrtTimestamp = (time: string) => {
        const totalSeconds = parseTimestamp(time);
        if (isNaN(totalSeconds)) return "00:00:00,000";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        const ms = Math.floor((totalSeconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
      };
      srtContent += `${index + 1}\n`;
      srtContent += `${formatSrtTimestamp(segment.startTime)} --> ${formatSrtTimestamp(segment.endTime)}\n`;
      srtContent += `${segment.originalText}\n`;
      srtContent += `${segment.translatedText}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${data.originalLanguage}_to_${data.translatedLanguage}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`w-full flex flex-col h-full bg-[#0f0f0f] ${overlayMode ? 'text-sm' : ''}`}>
      {/* Header Toolbar - Fixed Top */}
      <div className={`flex flex-wrap justify-between items-center gap-4 flex-shrink-0 mb-4 bg-[#0f0f0f] z-30 py-2 ${overlayMode ? 'sticky top-0 px-2' : 'sticky top-16'}`}>
        {!overlayMode && <h2 className="text-xl font-bold text-white">Transcript</h2>}
        
        <div className="flex flex-wrap gap-2 ml-auto items-center">
          
          {/* Reader Mode Toggle */}
          {!isEditing && (
            <button
              onClick={() => {
                setIsReaderMode(!isReaderMode);
                setIsReaderScrolling(false); // Stop auto scroll when switching modes
              }}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border
                ${isReaderMode 
                  ? 'bg-amber-600/20 border-amber-500/50 text-amber-400 hover:bg-amber-600/30' 
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                }`}
            >
              <BookOpen className="w-3 h-3" />
              <span className="hidden sm:inline">Reader Mode</span>
            </button>
          )}

          {/* Reader Mode Controls */}
          {isReaderMode && (
             <div className="flex items-center space-x-2 bg-zinc-900 rounded-lg p-1 border border-zinc-700 mr-2">
                <button
                  onClick={() => setIsReaderScrolling(!isReaderScrolling)}
                  className={`p-1 rounded ${isReaderScrolling ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'}`}
                  title={isReaderScrolling ? "Pause Scroll" : "Auto Scroll"}
                >
                  {isReaderScrolling ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </button>
                <div className="flex items-center space-x-2 px-2 border-l border-zinc-700">
                   <FastForward className="w-3 h-3 text-zinc-500" />
                   <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    step="0.5"
                    value={readerSpeed} 
                    onChange={(e) => setReaderSpeed(parseFloat(e.target.value))}
                    className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    title="Scroll Speed"
                   />
                </div>
             </div>
          )}

          {/* Edit Controls */}
          {onUpdate && !isEditing && !isReaderMode && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors border border-zinc-700"
            >
              <Edit2 className="w-3 h-3" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          {isEditing && (
            <div className="flex items-center space-x-2 bg-zinc-900 rounded-lg p-1 border border-zinc-700 mr-2">
              <label className="flex items-center space-x-2 px-2 py-1 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={shiftTimestamps} 
                  onChange={(e) => setShiftTimestamps(e.target.checked)}
                  className="rounded bg-zinc-700 border-zinc-600 text-red-600 focus:ring-red-500/50"
                />
                <span className="text-xs text-zinc-300 whitespace-nowrap" title="Automatically adjust subsequent timestamps when you edit a time">Shift Following</span>
              </label>
            </div>
          )}

          {isEditing && (
            <>
              <button
                onClick={saveEdits}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors"
              >
                <Check className="w-3 h-3" />
                <span>Done</span>
              </button>
              <button
                onClick={cancelEdits}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs font-medium text-zinc-300 transition-colors"
              >
                <X className="w-3 h-3" />
                <span>Cancel</span>
              </button>
            </>
          )}

          {/* Existing Controls - Hide some in overlay mode or edit mode to save space */}
          {!isEditing && (
            <>
              {!overlayMode && onSave && (
                <button
                  onClick={onSave}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition-colors shadow-lg shadow-emerald-900/20 mr-2"
                >
                  <Save className="w-3 h-3" />
                  <span className="hidden sm:inline">Save</span>
                </button>
              )}

              {!isReaderMode && (
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    autoScroll 
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 hover:bg-blue-600/30' 
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                  }`}
                  title="Toggle Auto-Scroll"
                >
                  {autoScroll ? 'Scroll On' : 'Scroll Off'}
                </button>
              )}
              
              {!overlayMode && !isReaderMode && (
                <>
                  <button onClick={() => copyToClipboard(true)} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700" title="Copy Original">
                    {copiedOriginal ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <button onClick={() => copyToClipboard(false)} className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700" title="Copy Translation">
                    {copiedTranslated ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <button onClick={downloadSRT} className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500" title="Download SRT">
                    <Download className="w-3 h-3" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className={`rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0 shadow-xl border
        ${overlayMode ? 'bg-black/50 border-white/10' : 'bg-zinc-900 border-zinc-800'}`}>
        
        {/* Table Header - Hide in Reader Mode */}
        {!isReaderMode && (
          <div className={`grid grid-cols-12 gap-4 p-4 border-b font-semibold text-zinc-500 uppercase tracking-wider sticky top-0 z-20 backdrop-blur-md
            ${overlayMode ? 'bg-black/80 border-white/10 text-[10px]' : 'bg-black/40 border-zinc-800 text-xs'}`}>
            <div className="col-span-2 text-center">Time</div>
            <div className={`${overlayMode ? 'hidden' : 'col-span-5'} pl-2`}>{data.originalLanguage || 'Original'}</div>
            <div className={`${overlayMode ? 'col-span-10 text-lg' : 'col-span-5'} pl-2 text-red-400`}>{data.translatedLanguage}</div>
          </div>
        )}

        {/* Scrollable Content */}
        <div ref={containerRef} className="overflow-y-auto custom-scrollbar flex-1 relative bg-[#0f0f0f]">
          {localSegments.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
              <Clock className="w-8 h-8 mb-3 opacity-50" />
              <p>No speech detected.</p>
            </div>
          ) : (
            isReaderMode ? (
              // Reader Mode View
              <div className="p-8 md:p-12 max-w-4xl mx-auto space-y-10">
                 {localSegments.map((segment, index) => {
                   const isActive = index === activeIndex;
                   return (
                     <div 
                      key={index} 
                      ref={isActive ? activeSegmentRef : null}
                      onClick={() => onSeek && onSeek(parseTimestamp(segment.startTime))}
                      className={`transition-all duration-300 cursor-pointer
                        ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'}
                      `}
                     >
                       <div className={`text-xs font-mono mb-3 tracking-wide flex items-center gap-2
                         ${isActive ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>
                         <span>{segment.startTime}</span>
                       </div>
                       <p className="text-2xl md:text-3xl leading-[2.5] text-zinc-100 font-medium">
                         {segment.translatedText}
                       </p>
                     </div>
                   );
                 })}
                 {/* Spacer for bottom scrolling */}
                 <div className="h-[50vh]"></div>
              </div>
            ) : (
              // Standard Table View
              localSegments.map((segment, index) => {
                const isActive = index === activeIndex;
                return (
                  <div 
                    key={index}
                    ref={isActive ? activeSegmentRef : null}
                    onClick={() => !isEditing && onSeek && onSeek(parseTimestamp(segment.startTime))}
                    className={`grid grid-cols-12 gap-4 p-4 border-b transition-all duration-300 group
                      ${overlayMode ? 'border-white/5 py-3' : 'border-zinc-800/50'}
                      ${isActive 
                        ? (overlayMode ? 'bg-red-500/20 border-l-2 border-l-red-500' : 'bg-red-500/10 border-l-4 border-l-red-500') 
                        : (isEditing ? '' : 'hover:bg-zinc-800/40 cursor-pointer border-l-4 border-l-transparent')
                      }`}
                  >
                    {/* Timestamp */}
                    <div className="col-span-2 flex flex-col items-center pt-1 gap-1">
                      {isEditing ? (
                        <>
                          <input 
                            type="text"
                            className="w-full text-center bg-zinc-800/80 text-white rounded border border-zinc-700 focus:border-red-500 outline-none text-[10px] md:text-xs py-1"
                            value={segment.startTime}
                            onFocus={() => handleTimestampFocus(segment.startTime)}
                            onBlur={(e) => handleTimestampBlur(index, 'startTime', e.target.value)}
                            onChange={(e) => handleSegmentChange(index, 'startTime', e.target.value)}
                          />
                          <div className="text-[9px] text-zinc-600">to</div>
                          <input 
                            type="text"
                            className="w-full text-center bg-zinc-800/80 text-zinc-400 rounded border border-zinc-700 focus:border-red-500 outline-none text-[10px] md:text-xs py-1"
                            value={segment.endTime}
                            onFocus={() => handleTimestampFocus(segment.endTime)}
                            onBlur={(e) => handleTimestampBlur(index, 'endTime', e.target.value)}
                            onChange={(e) => handleSegmentChange(index, 'endTime', e.target.value)}
                          />
                        </>
                      ) : (
                        <div className={`flex items-center space-x-1 font-mono rounded transition-colors
                          ${overlayMode ? 'text-[10px] px-1' : 'text-xs px-2 py-1'}
                          ${isActive ? 'text-red-300 bg-red-500/20' : 'text-zinc-500 bg-zinc-800/50'}`}>
                          {!overlayMode && <Play className={`w-2 h-2 ${isActive ? 'fill-current' : 'hidden group-hover:block'}`} />}
                          <span>{segment.startTime}</span>
                        </div>
                      )}
                    </div>

                    {/* Original Text */}
                    <div className={`${overlayMode ? 'hidden' : 'col-span-5'} pl-2 leading-relaxed transition-colors
                      ${overlayMode ? 'text-xs' : 'text-sm md:text-base'}
                      ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                      {isEditing ? (
                        <textarea 
                          id={`original-text-${index}`}
                          className="w-full bg-zinc-800/50 text-white p-3 rounded-xl border border-zinc-700 focus:border-red-500 outline-none resize-y text-base leading-relaxed"
                          rows={10}
                          value={segment.originalText}
                          onChange={(e) => handleSegmentChange(index, 'originalText', e.target.value)}
                        />
                      ) : (
                        segment.originalText
                      )}
                    </div>

                    {/* Translated Text */}
                    <div className={`${overlayMode ? 'col-span-10 text-xl md:text-2xl' : 'col-span-5 text-sm md:text-base'} pl-2 leading-relaxed font-medium transition-colors
                      ${isActive ? 'text-red-100' : 'text-zinc-200 group-hover:text-white'}`}>
                      {isEditing ? (
                        <textarea 
                          className="w-full bg-zinc-800/50 text-white p-3 rounded-xl border border-zinc-700 focus:border-red-500 outline-none resize-y text-xl leading-relaxed"
                          rows={10}
                          value={segment.translatedText}
                          onChange={(e) => handleSegmentChange(index, 'translatedText', e.target.value)}
                        />
                      ) : (
                        segment.translatedText
                      )}
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptDisplay;