'use client';

import { Transcript } from '@/types';
import { useEffect, useRef } from 'react';

interface TranscriptViewProps {
  transcripts: Transcript[];
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({ transcripts }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcripts]);

  return (
    <div ref={containerRef} className="h-full overflow-y-auto pr-4 pt-2">
      {transcripts?.map((transcript) => (
        <div key={transcript.id + Math.random().toString(36).substring(2, 9)} className="mb-2 p-3 bg-secondary/10 rounded-md border border-border">
          <span className="text-xs text-muted-foreground font-medium block mb-1">{transcript.timestamp}</span>
          <p className="text-sm text-foreground">{transcript.text}</p>
        </div>
      ))}
    </div>
  );
};
