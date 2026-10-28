import React, { useState, useRef, useEffect } from 'react';
import { 
  ProcessingStatus, 
  TranscriptResult, 
  TranscriptSegment,
  SUPPORTED_LANGUAGES,
  SavedProject 
} from './types';
import FileUpload from './components/FileUpload';
import LanguageSelector from './components/LanguageSelector';
import TranscriptDisplay from './components/TranscriptDisplay';
import SaveModal from './components/SaveModal';
import { 
  formatFileSize, 
  downloadJson, 
  readJsonFile, 
  extractAndChunkMedia,
  formatSecondsToTime,
  parseTimeToSeconds
} from './utils/fileUtils';
import { generateTranscript, fetchModelInfo, ModelInfo } from './services/geminiService';
import { Bot, Loader2, PlayCircle, RefreshCw, AlertTriangle, Sparkles, ChevronLeft, Upload, Maximize2, GripVertical, Cpu, Film, CheckCircle2 } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [targetLang, setTargetLang] = useState<string>('my'); // Default to Burmese (my)
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [transcriptHeight, setTranscriptHeight] = useState(35); // Percentage height for transcript in fullscreen
  
  // Movie Recap Chunking Progress State
  const [processingStage, setProcessingStage] = useState<string>('Preparing Movie Recap...');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentChunk, setCurrentChunk] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);

  // Model Info State
  const [modelInfo, setModelInfo] = useState<ModelInfo>({
    model: 'gemini-3.8-flash',
    modelName: 'Gemini 3.8 Flash',
    status: 'active',
    description: 'Latest Google Gemini multimodal model for audio transcription and translation.'
  });

  // Split Pane State
  const [leftPaneWidth, setLeftPaneWidth] = useState(35); // Default percentage for video column
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const splitPaneRef = useRef<HTMLDivElement>(null);

  // Save Modal State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // State for loaded projects where video is missing
  const [missingVideoName, setMissingVideoName] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Fetch model information on mount
  useEffect(() => {
    fetchModelInfo().then(info => {
      if (info) setModelInfo(info);
    });
  }, []);

  // Fullscreen event listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Resizing logic for fullscreen vertical resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      const windowHeight = window.innerHeight;
      const mouseY = e.clientY;
      const newHeightPercentage = ((windowHeight - mouseY) / windowHeight) * 100;
      const clampedHeight = Math.max(20, Math.min(80, newHeightPercentage));
      setTranscriptHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  };

  // Resizing logic for horizontal split pane
  useEffect(() => {
    const handleSplitMouseMove = (e: MouseEvent) => {
      if (!isResizingSplit || !splitPaneRef.current) return;
      
      const containerRect = splitPaneRef.current.getBoundingClientRect();
      let newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      newWidth = Math.max(20, Math.min(70, newWidth));
      setLeftPaneWidth(newWidth);
    };

    const handleSplitMouseUp = () => {
      if (isResizingSplit) {
        setIsResizingSplit(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };

    if (isResizingSplit) {
      document.addEventListener('mousemove', handleSplitMouseMove);
      document.addEventListener('mouseup', handleSplitMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleSplitMouseMove);
      document.removeEventListener('mouseup', handleSplitMouseUp);
    };
  }, [isResizingSplit]);

  const startSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSplit(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setFilePreview(URL.createObjectURL(selectedFile));
    setMissingVideoName(null);
    setStatus(ProcessingStatus.IDLE);
    setResult(null);
    setError(null);
    setCurrentTime(0);
    setProgressPercent(0);
    setCurrentChunk(0);
    setTotalChunks(0);
  };

  const handleReset = () => {
    setFile(null);
    setFilePreview(null);
    setMissingVideoName(null);
    setStatus(ProcessingStatus.IDLE);
    setResult(null);
    setError(null);
    setCurrentTime(0);
    setProgressPercent(0);
    setCurrentChunk(0);
    setTotalChunks(0);
    if (filePreview) URL.revokeObjectURL(filePreview);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };

  const handleTranscriptUpdate = (updatedData: TranscriptResult) => {
    setResult(updatedData);
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;

    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const openSaveModal = () => {
    setIsSaveModalOpen(true);
  };

  const handleConfirmSave = (fileName: string, videoName: string) => {
    if (!result) return;
    
    const finalFileName = fileName.toLowerCase().endsWith('.json') ? fileName : `${fileName}.json`;

    const projectData: SavedProject = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      fileName: videoName,
      targetLang: targetLang,
      transcriptResult: result
    };
    
    downloadJson(projectData, finalFileName);
    setIsSaveModalOpen(false);
  };

  const handleLoadProject = async (projectFile: File) => {
    try {
      const data: SavedProject = await readJsonFile(projectFile);
      
      if (!data.transcriptResult || !data.transcriptResult.segments) {
        throw new Error("Invalid project file structure: missing transcriptResult segments.");
      }

      setResult(data.transcriptResult);
      setTargetLang(data.targetLang || 'my');
      setMissingVideoName(data.fileName || "Unknown Video");
      
      if (filePreview) URL.revokeObjectURL(filePreview);
      setFile(null);
      setFilePreview(null);
      
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      setError("Failed to load project file: " + err.message);
    }
  };

  const handleReuploadVideo = (uploadedFile: File) => {
    setFile(uploadedFile);
    setFilePreview(URL.createObjectURL(uploadedFile));
    setMissingVideoName(null);
  };

  // Movie Recap Progressive Long Video Processor
  const processVideo = async () => {
    if (!file) return;

    setStatus(ProcessingStatus.ANALYZING);
    setError(null);
    setProgressPercent(2);
    setProcessingStage('Analyzing movie file...');

    try {
      const targetLangName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || 'Burmese';

      // 1. Extract audio and slice into 3-minute chunks (bypassing any 413 or payload limits)
      const chunks = await extractAndChunkMedia(file, 180, (msg, pct) => {
        setProcessingStage(msg);
        if (pct) setProgressPercent(pct);
      });

      setTotalChunks(chunks.length);
      const accumulatedSegments: TranscriptSegment[] = [];
      let detectedOriginalLang = 'English';

      // 2. Transcribe each chunk sequentially, adjusting timestamps to absolute movie time
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setCurrentChunk(i + 1);

        const startTimeStr = formatSecondsToTime(chunk.startSec);
        const endTimeStr = formatSecondsToTime(chunk.endSec);
        
        setProcessingStage(`Transcribing Recap Part ${i + 1} of ${chunks.length} (${startTimeStr} - ${endTimeStr})...`);
        const chunkPercent = Math.round(((i) / chunks.length) * 100);
        setProgressPercent(chunkPercent);

        const chunkResult = await generateTranscript(chunk.base64, chunk.mimeType, targetLangName);
        if (chunkResult.originalLanguage) {
          detectedOriginalLang = chunkResult.originalLanguage;
        }

        // Offset timestamps to match movie timeline
        if (chunkResult.segments && chunkResult.segments.length > 0) {
          const offsetSegments: TranscriptSegment[] = chunkResult.segments.map(seg => {
            const segStartSec = parseTimeToSeconds(seg.startTime);
            const segEndSec = parseTimeToSeconds(seg.endTime);
            return {
              ...seg,
              startTime: formatSecondsToTime(chunk.startSec + segStartSec),
              endTime: formatSecondsToTime(chunk.startSec + segEndSec),
            };
          });

          accumulatedSegments.push(...offsetSegments);
        }

        // Progressive real-time update
        setResult({
          originalLanguage: detectedOriginalLang,
          translatedLanguage: targetLangName,
          segments: [...accumulatedSegments]
        });

        const completedPercent = Math.round(((i + 1) / chunks.length) * 100);
        setProgressPercent(completedPercent);
      }

      setProcessingStage('Movie recap transcription completed!');
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      console.error('Movie recap processing failed:', err);
      setError(err.message || "An error occurred while processing the movie recap.");
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const getDefaultSaveName = () => {
    return `movie_recap_${new Date().toISOString().slice(0, 10)}.json`;
  };

  const getDefaultVideoName = () => {
    return file ? file.name : (missingVideoName || "movie_recap.mp4");
  };

  const activeLanguageName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || 'Burmese';

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white selection:bg-red-500/30 flex flex-col justify-between">
      <SaveModal 
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onConfirm={handleConfirmSave}
        defaultFileName={getDefaultSaveName()}
        defaultVideoName={getDefaultVideoName()}
      />

      {/* Top Navbar */}
      <nav className="border-b border-zinc-800 bg-[#0f0f0f]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={handleReset}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-500 flex items-center justify-center shadow-lg shadow-red-900/30">
              <Film className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight">TubeScribe</span>
              <span className="text-xs text-red-400 font-semibold ml-2 uppercase tracking-wider hidden sm:inline">Movie Recap Studio</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
             <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-xs">
               <Cpu className="w-3.5 h-3.5 text-red-400" />
               <span className="text-zinc-400 font-medium">Model:</span>
               <span className="text-emerald-400 font-semibold">{modelInfo.modelName}</span>
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active"></span>
             </div>
             <a 
               href="https://ai.google.dev" 
               target="_blank" 
               rel="noreferrer" 
               className="text-xs font-medium text-zinc-400 hover:text-white transition-colors hidden md:block"
             >
               Google AI
             </a>
          </div>
        </div>
      </nav>

      <main className="max-w-[1920px] mx-auto px-4 py-6 w-full flex-1">
        
        {/* Header / Intro - Hide when Completed */}
        {status !== ProcessingStatus.COMPLETED && (
          <div className="flex flex-col items-center justify-center space-y-4 mb-8 py-6 text-center">
             <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
               <Film className="w-3.5 h-3.5" />
               <span>Full-Length Movie Recap & Narration Transcriber</span>
             </div>
             <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-b from-white via-zinc-100 to-zinc-400">
               Movie Recap to Burmese Subtitles & Script
             </h1>
             <p className="text-zinc-400 text-base md:text-lg max-w-3xl leading-relaxed">
               Built for movie recap creators. Drop any movie file (10 min, 30 min, 1 hour+ / 1GB+). Our engine chunks the narration, transcribes character dialogue with precise timestamps, and translates into natural Burmese (ရုပ်ရှင်ဇာတ်လမ်းပြော စတိုင်လ်).
             </p>
          </div>
        )}

        {/* Main Upload or Split View */}
        {!file && !result ? (
          <div className="max-w-5xl mx-auto">
            <FileUpload 
              onFileSelect={handleFileSelect} 
              onLoadProject={handleLoadProject}
            />
            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl text-center">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            
            {/* COMPLETED VIEW - Split Screen */}
            {status === ProcessingStatus.COMPLETED && result ? (
              <div 
                ref={splitPaneRef} 
                className="flex flex-col lg:flex-row gap-8 lg:gap-0"
              >
                {/* Left Column: Video Player OR Missing Video Prompt */}
                <div 
                  className="lg:shrink-0 w-full"
                  style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${leftPaneWidth}%` : '100%' }}
                >
                   <div className="lg:sticky lg:top-24 space-y-4 lg:pr-4">
                      
                      {/* Video Player */}
                      {filePreview ? (
                        <>
                          <div 
                            ref={playerContainerRef} 
                            className={`rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-2xl relative group
                              ${isFullscreen ? 'flex flex-col bg-black h-screen w-screen fixed top-0 left-0 z-50' : ''}`}
                          >
                            <div className={`${isFullscreen ? 'flex-1 min-h-0 flex items-center justify-center bg-black' : 'w-full'}`}>
                               <video
                                  ref={videoRef}
                                  src={filePreview || ""}
                                  controls
                                  className={`${isFullscreen ? 'h-full w-full object-contain' : 'w-full aspect-video object-contain'}`}
                                  onTimeUpdate={handleTimeUpdate}
                                />
                            </div>
                            
                            {!isFullscreen && (
                              <button 
                                onClick={toggleFullscreen}
                                className="absolute bottom-16 right-4 p-2 bg-black/60 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black/80 hidden md:block"
                                title="Fullscreen with Transcript"
                              >
                                <Maximize2 className="w-5 h-5" />
                              </button>
                            )}

                            {isFullscreen && (
                              <div 
                                className="h-4 bg-zinc-900 hover:bg-zinc-700 cursor-row-resize flex items-center justify-center z-30 border-t border-b border-zinc-800 flex-shrink-0 transition-colors"
                                onMouseDown={startResize}
                                title="Drag to resize transcript height"
                              >
                                <div className="w-12 h-1 bg-zinc-600 rounded-full" />
                              </div>
                            )}

                            {isFullscreen && (
                              <div 
                                style={{ height: `${transcriptHeight}vh` }}
                                className="bg-zinc-900 flex flex-col min-h-0"
                              >
                                 <div className="flex justify-between items-center p-2 px-4 bg-black/40 border-b border-zinc-800 flex-shrink-0">
                                   <h3 className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Movie Recap Subtitles</h3>
                                   <button 
                                     onClick={toggleFullscreen} 
                                     className="text-zinc-400 hover:text-white flex items-center space-x-1 text-xs"
                                   >
                                     <Maximize2 className="w-3 h-3" />
                                     <span>Exit Fullscreen</span>
                                   </button>
                                 </div>
                                 <div className="flex-1 overflow-hidden">
                                   <TranscriptDisplay 
                                      data={result} 
                                      currentTime={currentTime}
                                      onSeek={handleSeek}
                                      onUpdate={handleTranscriptUpdate}
                                      overlayMode={true}
                                   />
                                 </div>
                              </div>
                            )}
                          </div>
                          
                          {!isFullscreen && (
                            <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 backdrop-blur-sm">
                              <h3 className="font-medium text-white truncate text-base">{file?.name}</h3>
                              <div className="flex items-center justify-between mt-2 text-xs text-zinc-400">
                                <span>{file ? formatFileSize(file.size) : 'Unknown size'}</span>
                                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                   {file?.type?.split('/')[1]?.toUpperCase() || 'VIDEO'} &bull; {result.segments.length} Segments
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/30 p-8 text-center space-y-4 flex flex-col items-center justify-center min-h-[300px]">
                           <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                             <Upload className="w-8 h-8 text-zinc-400" />
                           </div>
                           <div>
                             <h3 className="text-xl font-bold text-white mb-2">Movie Video Needed</h3>
                             <p className="text-zinc-400 text-sm mb-4">
                               Project transcript loaded. Upload the matching movie recap video to sync playback.
                             </p>
                             <div className="bg-zinc-800 p-3 rounded-lg text-sm text-zinc-300 mb-4 inline-block font-mono">
                               Target: {missingVideoName}
                             </div>
                             <div>
                               <input 
                                 type="file" 
                                 id="reuploadInput" 
                                 className="hidden" 
                                 accept="video/*,audio/*"
                                 onChange={(e) => {
                                   if (e.target.files && e.target.files.length > 0) {
                                     handleReuploadVideo(e.target.files[0]);
                                   }
                                 }}
                               />
                               <button 
                                 onClick={() => document.getElementById('reuploadInput')?.click()}
                                 className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-colors"
                               >
                                 Upload Video
                               </button>
                             </div>
                           </div>
                        </div>
                      )}

                      {!isFullscreen && (
                        <button 
                          onClick={handleReset}
                          className="w-full p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all flex items-center justify-center space-x-2 text-sm font-medium border border-zinc-700/50 hover:border-zinc-600"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Process Another Movie</span>
                        </button>
                      )}
                   </div>
                </div>

                {/* Resizer Handle */}
                <div 
                  className="hidden lg:flex w-6 -ml-3 z-30 cursor-col-resize items-center justify-center group select-none sticky top-[40vh]"
                  onMouseDown={startSplitResize}
                  title="Drag to resize columns"
                >
                   <div className="w-1.5 h-16 bg-zinc-800 rounded-full group-hover:bg-red-500/80 transition-all shadow-lg flex items-center justify-center">
                      <GripVertical className="w-3 h-3 text-zinc-500 group-hover:text-white/80" />
                   </div>
                </div>

                {/* Right Column: Transcript */}
                <div className="flex-1 min-w-0 lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24 flex flex-col lg:pl-1">
                   <TranscriptDisplay 
                      data={result} 
                      currentTime={currentTime}
                      onSeek={handleSeek}
                      onSave={openSaveModal}
                      onUpdate={handleTranscriptUpdate}
                   />
                </div>
              </div>
            ) : (
              // ANALYZING / SETUP VIEW
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800 gap-4">
                   <div className="flex items-center space-x-4 w-full md:w-auto">
                      <div className="relative w-16 h-16 bg-black rounded-lg overflow-hidden flex-shrink-0 border border-zinc-800 group">
                        <video src={filePreview || ""} className="w-full h-full object-cover opacity-60" />
                        <PlayCircle className="absolute inset-0 m-auto w-6 h-6 text-white/80" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate max-w-[220px]">{file?.name}</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">{file ? formatFileSize(file.size) : ''}</p>
                      </div>
                   </div>

                   <div className="flex items-center space-x-4 w-full md:w-auto">
                      <div className="flex-1 md:w-64">
                         <LanguageSelector 
                           selectedCode={targetLang} 
                           onSelect={setTargetLang} 
                           disabled={status === ProcessingStatus.ANALYZING || status === ProcessingStatus.UPLOADING}
                         />
                      </div>
                      
                      {status === ProcessingStatus.IDLE || status === ProcessingStatus.ERROR ? (
                        <div className="flex space-x-2 pt-6">
                          <button 
                            onClick={handleReset}
                            className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                            title="Upload different movie"
                          >
                            <RefreshCw className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={processVideo}
                            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-900/20 flex items-center justify-center space-x-2"
                          >
                            <Film className="w-5 h-5" />
                            <span>Transcribe Movie Recap</span>
                          </button>
                        </div>
                      ) : null}
                   </div>
                </div>

                {/* Progressive Processing State with Detailed Movie Progress Bar */}
                {(status === ProcessingStatus.ANALYZING || status === ProcessingStatus.UPLOADING) && (
                  <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8">
                    <div className="relative">
                      <div className="absolute inset-0 bg-red-500/25 blur-2xl rounded-full animate-pulse"></div>
                      <Loader2 className="w-14 h-14 text-red-500 animate-spin relative z-10" />
                    </div>
                    
                    <div className="space-y-3 max-w-xl w-full">
                       <div className="flex items-center justify-between text-xs text-zinc-400 font-mono px-1">
                         <span>
                           {totalChunks > 0 ? `Part ${currentChunk} of ${totalChunks}` : 'Initializing'}
                         </span>
                         <span className="text-red-400 font-semibold">{progressPercent}%</span>
                       </div>

                       {/* Progress Bar */}
                       <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden border border-zinc-700/50">
                         <div 
                           className="bg-gradient-to-r from-red-600 to-amber-500 h-full rounded-full transition-all duration-300 ease-out"
                           style={{ width: `${Math.max(5, progressPercent)}%` }}
                         />
                       </div>

                       <h3 className="text-xl md:text-2xl font-bold text-white pt-2">
                          {processingStage}
                       </h3>
                       <p className="text-zinc-400 text-sm leading-relaxed">
                         Gemini 3.8 Flash is translating the narration and dialogue into <strong className="text-white">{activeLanguageName}</strong>. Automatic chunking allows complete processing of long movie recaps without timeouts or size errors.
                       </p>

                       {/* Live counter of generated segments */}
                       {result && result.segments.length > 0 && (
                         <div className="pt-2">
                           <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                             <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                             <span>{result.segments.length} dialogue segments transcribed so far</span>
                           </span>
                         </div>
                       )}
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {status === ProcessingStatus.ERROR && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex items-start space-x-4">
                     <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                     <div className="flex-1">
                       <h3 className="text-red-200 font-semibold text-base">Processing Error</h3>
                       <p className="text-red-300/80 text-sm mt-1">{error}</p>
                       <div className="mt-3 flex items-center space-x-3">
                         <button 
                           onClick={processVideo}
                           className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors"
                         >
                           Retry
                         </button>
                         <button 
                           onClick={handleReset}
                           className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
                         >
                           Choose Different Movie
                         </button>
                       </div>
                     </div>
                  </div>
                )}
              </div>
            )}
            
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 mt-16 py-6 text-center text-zinc-500 text-xs">
        <div className="max-w-[1920px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>&copy; {new Date().getFullYear()} TubeScribe Movie Recap Studio &mdash; Burmese & Global Subtitles.</p>
          <div className="flex items-center space-x-3">
            <span className="text-zinc-400">Model:</span>
            <span className="text-emerald-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{modelInfo.model}</span>
            <span>&bull;</span>
            <span>Long Movie Recap Chunking Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;