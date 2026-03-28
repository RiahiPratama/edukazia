'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Download, Volume2 } from 'lucide-react';

type CEFRAudioPlayerProps = {
  material: {
    id: string;
    title: string;
    content_data: {
      audio_url?: string;
      transcript?: string;
      skill_focus?: string;
      duration?: number;
    };
  };
  onClose: () => void;
};

export default function CEFRAudioPlayer({ material, onClose }: CEFRAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  const data = material.content_data;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const handleSpeedChange = (speed: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    setCurrentTime(0);
  };

  const handleDownload = () => {
    if (data.audio_url) {
      window.open(data.audio_url, '_blank');
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (duration === 0) return 0;
    return (currentTime / duration) * 100;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{material.title}</h3>
            {data.skill_focus && (
              <p className="text-sm text-gray-500 mt-1">Skill: {data.skill_focus}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Audio Player */}
        <div className="p-6">
          <audio ref={audioRef} src={data.audio_url} preload="metadata" />

          {/* Waveform/Progress Bar */}
          <div className="bg-gray-100 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={togglePlayPause}
                className="w-14 h-14 bg-[#5C4FE5] text-white rounded-full flex items-center justify-center hover:bg-[#4a3ec7] transition-colors"
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
              </button>

              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #5C4FE5 0%, #5C4FE5 ${getProgressPercentage()}%, #d1d5db ${getProgressPercentage()}%, #d1d5db 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRestart}
                  className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Restart"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download size={18} />
                </button>
              </div>

              {/* Speed Control */}
              <div className="flex items-center gap-2">
                <Volume2 size={18} className="text-gray-600" />
                <div className="flex gap-1">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        playbackSpeed === speed
                          ? 'bg-[#5C4FE5] text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Transcript */}
          {data.transcript && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Transcript</h4>
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {data.transcript}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: Ikuti transcript sambil mendengarkan audio untuk meningkatkan pemahaman
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
