/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Play, Pause, Download, Loader2, Sparkles, Languages, Mic2 } from 'lucide-react';

const VOICES = [
  { id: 'Kore', name: 'Kore', description: 'Energetic & Technical', gender: 'F' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Smooth & Calm', gender: 'M' },
  { id: 'Puck', name: 'Puck', description: 'Friendly & Casual', gender: 'M' },
  { id: 'Charon', name: 'Charon', description: 'Deep & Authoritative', gender: 'M' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Warm & Natural', gender: 'M' },
];

export default function App() {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;

    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);
    setProgress(0);
    setCurrentTime(0);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceName: selectedVoice }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
        if (data.error?.includes("blocked") || data.error?.includes("candidates")) {
          throw new Error('The AI was unable to generate this voiceover. This may be due to content restrictions or temporary service limits. Please try a different text or voice.');
        }
        throw new Error(data.error || 'Failed to generate audio');
      }

      // Gemini TTS returns raw PCM (16-bit, mono, 24kHz)
      // To play it easily, we can wrap it in a WAV header
      const pcmData = atob(data.audio);
      const wavHeader = createWavHeader(pcmData.length, 24000);
      
      const wavBlob = new Blob([wavHeader, Uint8Array.from(pcmData, c => c.charCodeAt(0))], { type: 'audio/wav' });
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const createWavHeader = (dataLength: number, sampleRate: number) => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    /* RIFF identifier */
    view.setUint32(0, 0x52494646, false); // "RIFF"
    /* file length */
    view.setUint32(4, 36 + dataLength, true);
    /* RIFF type */
    view.setUint32(8, 0x57415645, false); // "WAVE"
    /* format chunk identifier */
    view.setUint32(12, 0x666d7420, false); // "fmt "
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true); // PCM
    /* channel count */
    view.setUint16(22, 1, true); // Mono
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    view.setUint32(36, 0x64617461, false); // "data"
    /* data chunk length */
    view.setUint32(40, dataLength, true);

    return buffer;
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // If we are at the end, restart
      if (audioRef.current.ended) {
        audioRef.current.currentTime = 0;
      }
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let rafId: number;

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(100); // Ensure it stays at 100% when finished
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const updateProgress = () => {
      if (audio && !audio.paused) {
        setCurrentTime(audio.currentTime);
        setProgress((audio.currentTime / audio.duration) * 100);
        rafId = requestAnimationFrame(updateProgress);
      }
    };

    const handlePlay = () => {
      rafId = requestAnimationFrame(updateProgress);
    };

    const handlePause = () => {
      cancelAnimationFrame(rafId);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    // Initial load sync
    if (audio.duration) setDuration(audio.duration);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      cancelAnimationFrame(rafId);
    };
  }, [audioUrl]);

  const SAMPLES = [
    "The way to get started is to quit talking and begin doing.",
    "Your time is limited, so don't waste it living someone else's life.",
    "If life were predictable it would cease to be life, and be without flavor.",
    "Design is not just what it looks like and feels like. Design is how it works."
  ];

  const insertSample = () => {
    const randomSample = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
    setText(randomSample);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-primary rounded-full shadow-lg shadow-indigo-500/50" />
          <h1 className="font-bold text-xl tracking-tight text-slate-800">EchoVoice AI</h1>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-sm font-medium text-slate-500 hover:text-primary transition-colors">History</button>
          <button className="text-sm font-medium text-slate-500 hover:text-primary transition-colors">Pro Plan</button>
          <button className="text-sm font-semibold text-primary px-4 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 transition-colors">Account</button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="main-layout selection:bg-indigo-100">
        <section className="content-area">
          <div className="glass-card flex-1 flex flex-col p-8 overflow-hidden group focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all duration-300">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-6 flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Text to Speech Engine
            </label>
            <textarea
              id="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste your English text here..."
              className="flex-1 w-full bg-transparent text-xl font-normal leading-relaxed resize-none focus:outline-none placeholder:text-slate-200 text-slate-700 font-sans"
            />
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-500 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {error}
              </div>
            )}
            <div className="flex items-center justify-between pt-6 mt-4 border-t border-slate-100/60 font-sans">
              <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                <div className="flex gap-4 items-center">
                  <span>{text.length} characters</span>
                  <span>{text.trim() === '' ? 0 : text.trim().split(/\s+/).length} words</span>
                  <button 
                    onClick={insertSample}
                    className="flex items-center gap-1.5 text-primary/70 hover:text-primary transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    Try a sample
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setText("")}
                className="text-xs font-medium text-slate-300 hover:text-slate-500 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </section>

        <aside className="sidebar">
          {/* Voice Profile */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-semibold text-slate-600">Voice Profile</label>
              <Mic2 className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 appearance-none focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all cursor-pointer font-medium"
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.description})
                </option>
              ))}
            </select>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs px-1">
                <label className="font-semibold text-slate-600">Speaking Rate</label>
                <span className="font-bold text-primary bg-indigo-50 px-2 py-0.5 rounded text-[10px]">1.0x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                defaultValue="1.0"
                className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-primary" 
              />
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs px-1">
                <label className="font-semibold text-slate-600">Pitch Variation</label>
                <span className="font-bold text-primary bg-indigo-50 px-2 py-0.5 rounded text-[10px]">0%</span>
              </div>
              <input 
                type="range" 
                min="-50" 
                max="50" 
                defaultValue="0"
                className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-primary" 
              />
            </div>
          </div>

          <button
            id="generate-button"
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim()}
            className={`w-full group mt-auto flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-sm shadow-indigo-600/10 shadow-lg transition-all duration-300 ${
              isGenerating || !text.trim()
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-hover active:scale-[0.98]'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>Generate Voiceover</span>
              </>
            )}
          </button>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 leading-relaxed font-medium">
            <span className="text-primary font-bold">Pro Tip:</span> Use double dashes "--" to create natural pauses in your speech generation.
          </div>
        </aside>
      </main>

      {/* Footer / Player */}
      <footer className="footer">
        <button
          id="play-pause-button"
          onClick={togglePlayback}
          disabled={!audioUrl}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            audioUrl 
              ? 'bg-indigo-50 text-primary hover:bg-indigo-100 active:scale-95' 
              : 'bg-slate-50 text-slate-300 cursor-not-allowed'
          }`}
        >
          {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 ml-1 fill-current" />}
        </button>

        <div className="flex-1 flex flex-col gap-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>{audioUrl ? `Now Playing: ${VOICES.find(v => v.id === selectedVoice)?.name} (Studio)` : "No audio generated"}</span>
            <span>{audioUrl ? `${formatTime(currentTime)} / ${formatTime(duration)}` : "--:-- / --:--" }</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
            <motion.div 
              className="absolute inset-y-0 left-0 bg-primary rounded-full z-10"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "linear", duration: 0 }}
            />
            {/* Visual Bars Mock */}
            <div className="absolute inset-0 flex items-center gap-[2px] px-1 pointer-events-none opacity-20">
               {[...Array(60)].map((_, i) => (
                 <div key={i} className="flex-1 bg-primary rounded-full" style={{ height: `${Math.random() * 80 + 20}%` }} />
               ))}
            </div>
          </div>
        </div>

        {audioUrl && (
          <a
            id="download-link"
            href={audioUrl}
            download="speech.wav"
            className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 font-semibold text-xs transition-all flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Download WAV
          </a>
        )}
        <audio ref={audioRef} src={audioUrl || undefined} className="hidden" />
      </footer>
    </div>
  );
}

