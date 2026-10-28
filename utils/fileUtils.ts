export interface AudioChunk {
  index: number;
  total: number;
  startSec: number;
  endSec: number;
  base64: string;
  mimeType: string;
}

export const formatSecondsToTime = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const parseTimeToSeconds = (timeStr: string): number => {
  if (!timeStr) return 0;
  const normalized = timeStr.replace(',', '.');
  const parts = normalized.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const downloadJson = (data: object, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const readJsonFile = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json);
      } catch (err) {
        reject(new Error("Invalid JSON file"));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Encodes an AudioBuffer into a 16kHz mono WAV Blob.
 */
export const audioBufferToWav = (buffer: AudioBuffer, targetSampleRate = 16000): Blob => {
  const numChannels = buffer.numberOfChannels;
  const originalSampleRate = buffer.sampleRate;
  const length = Math.round((buffer.length * targetSampleRate) / originalSampleRate);
  
  const monoData = new Float32Array(length);
  const ratio = originalSampleRate / targetSampleRate;

  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < length; i++) {
    const srcIndex = Math.min(Math.floor(i * ratio), buffer.length - 1);
    let sum = 0;
    for (let c = 0; c < numChannels; c++) {
      sum += channelData[c][srcIndex];
    }
    monoData[i] = sum / numChannels;
  }

  const dataByteLength = length * 2; // 16-bit PCM = 2 bytes per sample
  const bufferArray = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(bufferArray);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, monoData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
};

/**
 * Extracts and chunks media into 3-minute speech-optimized audio segments.
 * This enables full-length movie recaps (10 min, 30 min, 1 hour+) of ANY file size
 * (500MB, 1GB+) to be transcribed without ever triggering HTTP 413 or payload limits.
 */
export const extractAndChunkMedia = async (
  file: File,
  chunkDurationSec = 180, // 3-minute chunks for ideal accuracy, speed, and safety
  onProgress?: (message: string, percent?: number) => void
): Promise<AudioChunk[]> => {
  onProgress?.(`Reading media file (${formatFileSize(file.size)})...`, 5);
  
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const audioCtx = new AudioCtxClass();

  try {
    onProgress?.('Extracting audio track from movie recap video...', 15);
    const arrayBuffer = await file.arrayBuffer();

    onProgress?.('Decoding audio stream for movie recap...', 30);
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const duration = audioBuffer.duration;
    const totalChunks = Math.max(1, Math.ceil(duration / chunkDurationSec));
    
    onProgress?.(
      `Audio extracted (${formatSecondsToTime(duration)}). Splitting into ${totalChunks} movie recap segments...`,
      45
    );

    const chunks: AudioChunk[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const startSec = i * chunkDurationSec;
      const endSec = Math.min((i + 1) * chunkDurationSec, duration);
      const sampleStart = Math.floor(startSec * audioBuffer.sampleRate);
      const sampleEnd = Math.floor(endSec * audioBuffer.sampleRate);
      const sampleLength = sampleEnd - sampleStart;

      if (sampleLength <= 0) continue;

      const subBuffer = audioCtx.createBuffer(
        audioBuffer.numberOfChannels,
        sampleLength,
        audioBuffer.sampleRate
      );

      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const channelData = audioBuffer.getChannelData(c);
        const subChannel = channelData.subarray(sampleStart, sampleEnd);
        subBuffer.copyToChannel(subChannel, c);
      }

      const wavBlob = audioBufferToWav(subBuffer, 16000);
      const base64 = await blobToBase64(wavBlob);

      chunks.push({
        index: i,
        total: totalChunks,
        startSec,
        endSec,
        base64,
        mimeType: 'audio/wav',
      });

      const pct = 45 + Math.round(((i + 1) / totalChunks) * 45);
      onProgress?.(`Prepared movie recap part ${i + 1} of ${totalChunks}...`, pct);
    }

    return chunks;
  } finally {
    audioCtx.close().catch(() => {});
  }
};