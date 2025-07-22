'use client';

import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Play, Pause, Square, Mic } from 'lucide-react';
import { ProcessRequest, SummaryResponse } from '@/types/summary';
import { Button } from "@/components/ui/button"; // Import Shadcn Button

interface RecordingControlsProps {
  isRecording: boolean;
  barHeights: string[];
  onRecordingStop: () => void;
  onRecordingStart: () => void;
  onTranscriptReceived: (summary: SummaryResponse) => void;
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  barHeights,
  onRecordingStop,
  onRecordingStart,
  onTranscriptReceived,
}) => {
  const [showPlayback, setShowPlayback] = useState(false);
  const [recordingPath, setRecordingPath] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [stopCountdown, setStopCountdown] = useState(5);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  const stopTimeoutRef = useRef<{ stop: () => void } | null>(null);
  const MIN_RECORDING_DURATION = 2000; // 2 seconds minimum recording time

  const currentTime = 0;
  const duration = 0;
  const isPlaying = false;
  const progress = 0;

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const checkTauri = async () => {
      try {
        const result = await invoke('is_recording');
        console.log('Tauri is initialized and ready, is_recording result:', result);
      } catch (error) {
        console.error('Tauri initialization error:', error);
        alert('Failed to initialize recording. Please check the console for details.');
      }
    };
    checkTauri();
  }, []);

  const handleStartRecording = useCallback(async () => {
    if (isStarting) return;
    console.log('Starting recording...');
    setIsStarting(true);
    setShowPlayback(false);
    setTranscript(''); // Clear any previous transcript
    
    try {
      await invoke('start_recording');
      console.log('Recording started successfully');
      setIsProcessing(false);
      onRecordingStart();
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Please check the console for details.');
    } finally {
      setIsStarting(false);
    }
  }, [onRecordingStart, isStarting]);

  const stopRecordingAction = useCallback(async () => {
    console.log('Executing stop recording...');
    try {
      setIsProcessing(true);
      const dataDir = await appDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const savePath = `${dataDir}/recording-${timestamp}.wav`;
      
      console.log('Saving recording to:', savePath);
      const result = await invoke('stop_recording', { 
        args: {
          save_path: savePath
        }
      });
      
      setRecordingPath(savePath);
      // setShowPlayback(true);
      setIsProcessing(false);
      onRecordingStop();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
        if (error.message.includes('No recording in progress')) {
          return;
        }
      } else if (typeof error === 'string' && error.includes('No recording in progress')) {
        return;
      } else if (error && typeof error === 'object' && 'toString' in error) {
        if (error.toString().includes('No recording in progress')) {
          return;
        }
      }
      setIsProcessing(false);
      onRecordingStop();
    } finally {
      setIsStopping(false);
    }
  }, [onRecordingStop]);

  const handleStopRecording = useCallback(async () => {
    if (!isRecording || isStarting || isStopping) return;
    
    console.log('Starting stop countdown...');
    setIsStopping(true);
    setStopCountdown(5);

    // Clear any existing intervals
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }

    // Create a controller for the stop action
    const controller = {
      stop: () => {
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
        }
        setIsStopping(false);
        setStopCountdown(5);
      }
    };
    stopTimeoutRef.current = controller;

    // Start countdown
    countdownInterval.current = setInterval(() => {
      setStopCountdown(prev => {
        if (prev <= 1) {
          // Clear interval first
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
          // Schedule stop action
          stopRecordingAction();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isRecording, isStarting, isStopping, stopRecordingAction]);

  const cancelStopRecording = useCallback(() => {
    if (stopTimeoutRef.current) {
      stopTimeoutRef.current.stop();
      stopTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      if (stopTimeoutRef.current) stopTimeoutRef.current.stop();
    };
  }, []);

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center space-x-2 bg-white rounded-full shadow-lg px-4 py-2">
        {isProcessing ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
            <span className="text-sm text-gray-600">Processing recording...</span>
          </div>
        ) : (
          <>
            {showPlayback ? (
              <>
                <Button
                  size="icon"
                  onClick={handleStartRecording}
                  className="w-10 h-10 flex items-center justify-center bg-primary rounded-full text-primary-foreground hover:bg-primary/90 transition-colors"
                  title="Start New Recording"
                >
                  <Mic size={16} />
                </Button>

                <div className="w-px h-6 bg-border mx-1" />

                <div className="flex items-center space-x-1 mx-2">
                  <div className="text-sm text-muted-foreground min-w-[40px]">
                    {formatTime(currentTime)}
                  </div>
                  <div 
                    className="relative w-24 h-1 bg-muted rounded-full"
                  >
                    <div 
                      className="absolute h-full bg-primary rounded-full" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground min-w-[40px]">
                    {formatTime(duration)}
                  </div>
                </div>

                <Button 
                  size="icon"
                  className="w-10 h-10 flex items-center justify-center bg-muted rounded-full text-muted-foreground cursor-not-allowed"
                  disabled
                  title="Play (Not implemented)"
                >
                  <Play size={16} />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  onClick={isRecording ? 
                    (isStopping ? cancelStopRecording : handleStopRecording) : 
                    handleStartRecording}
                  disabled={isStarting || isProcessing}
                  className={`w-14 h-14 flex items-center justify-center rounded-full text-primary-foreground relative transition-colors
                    ${isStarting || isProcessing 
                      ? 'bg-muted cursor-not-allowed' 
                      : isRecording 
                        ? 'bg-destructive hover:bg-destructive/90' // Red for stopping
                        : 'bg-primary hover:bg-primary/90' // Green for starting
                    }
                  `}
                  title={isRecording ? (isStopping ? "Cancel Stopping" : "Stop Recording") : "Start Recording"}
                >
                  {isRecording ? (
                    <>
                      <Square size={20} />
                      {isStopping && (
                        <div className="absolute -top-6 text-destructive font-medium text-xs">
                          {stopCountdown > 0 ? `${stopCountdown}s` : 'Stopping...'}
                        </div>
                      )}
                    </>
                  ) : (
                    <Mic size={20} />
                  )}
                </Button>

                <div className="flex items-center space-x-1 mx-4">
                  {barHeights.map((height, index) => (
                    <div
                      key={index}
                      className="w-1 bg-primary rounded-full transition-all duration-200"
                      style={{
                        height: isRecording ? height : '4px',
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {/* {showPlayback && recordingPath && (
        <div className="text-sm text-gray-600 px-4">
          Recording saved to: {recordingPath}
        </div>
      )} */}
    </div>
  );
};