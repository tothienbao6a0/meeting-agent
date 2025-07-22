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
      {transcripts?.map((transcript, index) => (
        <div 
          key={transcript.id || `transcript-${index}`} // Use transcript.id if available, otherwise fallback to index
          className="mb-3 py-3 px-4 bg-card rounded-lg border border-border shadow-sm"
        >
          <span className="text-xs text-muted-foreground font-medium block mb-1">{transcript.timestamp}</span>
          <p className="text-sm text-foreground leading-relaxed">{transcript.text}</p> {/* Added leading-relaxed */}
        </div>
      ))}
    </div>
  );
};
