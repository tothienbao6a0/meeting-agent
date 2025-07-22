import React, { useEffect } from 'react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2 } from 'lucide-react';

interface AudioPlayerProps {
  audioPath: string | null;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioPath }) => {
  const { isPlaying, currentTime, duration, error, play, pause, seek } = useAudioPlayer(audioPath);

  const formatTime = (time: number) => {
    if (isNaN(time) || time < 0) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center space-x-4 bg-card p-4 rounded-lg shadow-sm border border-border mt-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={isPlaying ? pause : play}
        disabled={!audioPath || duration === 0 || !!error}
        className="text-foreground hover:bg-secondary/10"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </Button>

      <div className="flex-1 flex items-center space-x-2">
        <span className="text-sm text-muted-foreground w-10 text-right">{formatTime(currentTime)}</span>
        <Slider
          value={[currentTime]}
          max={duration}
          step={1}
          onValueChange={([value]) => seek(value)}
          className="w-full [&_span]:bg-primary [&_span]:shadow-none [&_[data-state=active]]:ring-0 [&_[data-state=active]]:ring-offset-0 [&_[data-state=active]]:focus:ring-0 [&_[data-state=active]]:focus:ring-offset-0"
          thumbClassName="bg-primary border-primary"
          trackClassName="bg-muted-foreground/30"
          disabled={!audioPath || duration === 0 || !!error}
        />
        <span className="text-sm text-muted-foreground w-10">{formatTime(duration)}</span>
      </div>

      {/* Future: Volume Control */}
      {/* <Button variant="ghost" size="icon" className="text-muted-foreground">
        <Volume2 className="h-5 w-5" />
      </Button> */}

      {error && <p className="text-destructive text-sm ml-4">Error: {error}</p>}
    </div>
  );
};
