'use client';

import { useState, useEffect, useContext, useCallback } from 'react';
import { Transcript, Summary, SummaryResponse } from '@/types';
import { EditableTitle } from '@/components/EditableTitle';
import { TranscriptView } from '@/components/TranscriptView';
import { RecordingControls } from '@/components/RecordingControls';
import { AISummary } from '@/components/AISummary';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { listen } from '@tauri-apps/api/event';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { downloadDir } from '@tauri-apps/api/path';
import { listenerCount } from 'process';
import { invoke } from '@tauri-apps/api/core';
import { useNavigation } from '@/hooks/useNavigation';
import { useRouter } from 'next/navigation';
import type { CurrentMeeting } from '@/components/Sidebar/SidebarProvider';
import { Button } from '@/components/ui/button';
import { Copy, StickyNote, Settings, Loader2 } from 'lucide-react';
import { ModelSettingsModal, ModelConfig } from '@/components/ModelSettingsModal'; // Import ModelConfig from here

interface TranscriptUpdate {
  text: string;
  timestamp: string;
  source: string;
}

type SummaryStatus = 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';

interface OllamaModel {
  name: string;
  id: string;
  size: string;
  modified: string;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>('idle');
  const [barHeights, setBarHeights] = useState(['58%', '76%', '58%']);
  const [meetingTitle, setMeetingTitle] = useState('+ New Call');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [aiSummary, setAiSummary] = useState<Summary | null>({
    key_points: { title: "Key Points", blocks: [] },
    action_items: { title: "Action Items", blocks: [] },
    decisions: { title: "Decisions", blocks: [] },
    main_topics: { title: "Main Topics", blocks: [] }
  });
  const [summaryResponse, setSummaryResponse] = useState<SummaryResponse | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'ollama',
    model: 'llama3.2:latest',
    whisperModel: 'large-v3'
  });
  const [originalTranscript, setOriginalTranscript] = useState<string>('');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [error, setError] = useState<string>('');
  const [showModelSettings, setShowModelSettings] = useState(false);

  const { setCurrentMeeting, setMeetings ,meetings, isMeetingActive, setIsMeetingActive, currentMeeting} = useSidebar();
  const handleNavigation = useNavigation('', ''); // Initialize with empty values
  const router = useRouter();

  const modelOptions = {
    ollama: models.map(model => model.name),
    claude: ['claude-3-5-sonnet-latest'],
    groq: ['llama-3.3-70b-versatile'],
  };

  useEffect(() => {
    if (models.length > 0 && modelConfig.provider === 'ollama') {
      setModelConfig(prev => ({
        ...prev,
        model: models[0].name
      }));
    }
  }, [models]);

  const whisperModels = [
    'tiny',
    'tiny.en',
    'tiny-q5_1',
    'tiny.en-q5_1',
    'tiny-q8_0',
    'base',
    'base.en',
    'base-q5_1',
    'base.en-q5_1',
    'base-q8_0',
    'small',
    'small.en',
    'small.en-tdrz',
    'small-q5_1',
    'small.en-q5_1',
    'small-q8_0',
    'medium',
    'medium.en',
    'medium-q5_0',
    'medium.en-q5_0',
    'medium-q8_0',
    'large-v1',
    'large-v2',
    'large-v2-q5_0',
    'large-v2-q8_0',
    'large-v3',
    'large-v3-q5_0',
    'large-v3-turbo',
    'large-v3-turbo-q5_0',
    'large-v3-turbo-q8_0'
  ];

  useEffect(() => {
    setCurrentMeeting({ id: 'intro-call', title: meetingTitle });
  }, [meetingTitle, setCurrentMeeting]);

  useEffect(() => {
    const checkRecordingState = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const isCurrentlyRecording = await invoke('is_recording');
        
        if (isCurrentlyRecording && !isRecording) {
          console.log('Recording is active in backend but not in UI, synchronizing state...');
          setIsRecording(true);
          setIsMeetingActive(true);
        } else if (!isCurrentlyRecording && isRecording) {
          console.log('Recording is inactive in backend but active in UI, synchronizing state...');
          setIsRecording(false);
        }
      } catch (error) {
        console.error('Failed to check recording state:', error);
      }
    };

    checkRecordingState();
    
    // Set up a polling interval to periodically check recording state
    const interval = setInterval(checkRecordingState, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [isRecording, setIsMeetingActive]);

  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setBarHeights(prev => {
          const newHeights = [...prev];
          newHeights[0] = Math.random() * 20 + 10 + 'px';
          newHeights[1] = Math.random() * 20 + 10 + 'px';
          newHeights[2] = Math.random() * 20 + 10 + 'px';
          return newHeights;
        });
      }, 300);

      return () => clearInterval(interval);
    }
  }, [isRecording]);

  useEffect(() => {
    let unlistenFn: (() => void) | undefined;
    let transcriptCounter = 0;  // Counter for unique IDs

    const setupListener = async () => {
      try {
        console.log('Setting up transcript listener...');
        unlistenFn = await listen<TranscriptUpdate>('transcript-update', (event) => {
          console.log('Received transcript update:', event.payload);
          const newTranscript = {
            id: `${Date.now()}-${transcriptCounter++}`,  // Combine timestamp with counter for uniqueness
            text: event.payload.text,
            timestamp: event.payload.timestamp,
          };
          setTranscripts(prev => {
            // Check if this transcript already exists
            const exists = prev.some(
              t => t.text === event.payload.text && t.timestamp === event.payload.timestamp
            );
            if (exists) {
              console.log('Duplicate transcript, skipping:', newTranscript);
              return prev;
            }
            console.log('Adding new transcript:', newTranscript);
            return [...prev, newTranscript];
          });
        });
        console.log('Transcript listener setup complete');
      } catch (error) {
        console.error('Failed to setup transcript listener:', error);
        alert('Failed to setup transcript listener. Check console for details.');
      }
    };

    setupListener();
    console.log('Started listener setup');

    return () => {
      console.log('Cleaning up transcript listener...');
      if (unlistenFn) {
        unlistenFn();
        console.log('Transcript listener cleaned up');
      }
    };
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch('http://localhost:11434/api/tags', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const modelList = data.models.map((model: any) => ({
          name: model.name,
          id: model.model,
          size: formatSize(model.size),
          modified: model.modified_at
        }));
        setModels(modelList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Ollama models');
        console.error('Error loading models:', err);
      }
    };

    loadModels();
  }, []);

  const formatSize = (size: number): string => {
    if (size < 1024) {
      return `${size} B`;
    } else if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    } else if (size < 1024 * 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  };

  const handleRecordingStart = async () => {
    try {
      console.log('Starting recording...');
      const { invoke } = await import('@tauri-apps/api/core');
      const randomTitle = `Meeting ${Math.random().toString(36).substring(2, 8)}`;
      setMeetingTitle(randomTitle);
      
      // Only check if we're already recording, but don't try to stop it first
      const isCurrentlyRecording = await invoke('is_recording');
      if (isCurrentlyRecording) {
        console.log('Already recording, cannot start a new recording');
        return; // Just return without starting a new recording
      }

      // Start new recording with whisper model
      await invoke('start_recording', {
        args: {
          whisper_model: modelConfig.whisperModel
        }
      });
      console.log('Recording started successfully');
      setIsRecording(true);
      setTranscripts([]); // Clear previous transcripts when starting new recording
      setIsMeetingActive(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Check console for details.');
      setIsRecording(false); // Reset state on error
    }
  };

  const handleRecordingStop = async () => {
    try {
      console.log('Stopping recording...');
      const { invoke } = await import('@tauri-apps/api/core');
      const { appDataDir } = await import('@tauri-apps/api/path');
      
      const dataDir = await appDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const transcriptPath = `${dataDir}transcript-${timestamp}.txt`;
      const audioPath = `${dataDir}recording-${timestamp}.wav`;

      // Stop recording and save audio
      await invoke('stop_recording', { 
        args: { 
          save_path: audioPath,
          model_config: modelConfig
        }
      });
      console.log('Recording stopped successfully');

      // Format and save transcript
      const formattedTranscript = transcripts
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(t => `[${t.timestamp}] ${t.text}`)
        .join('\n\n');

      // const documentContent = `Meeting Title: ${meetingTitle}\nDate: ${new Date().toLocaleString()}\n\nTranscript:\n${formattedTranscript}`;

      // await invoke('save_transcript', { 
      //   filePath: transcriptPath,
      //   content: documentContent
      // });
      // console.log('Transcript saved to:', transcriptPath);

      setIsRecording(false);
      
      // Show summary button if we have transcript content
      if (formattedTranscript.trim()) {
        setShowSummary(true);
      } else {
        console.log('No transcript content available');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
      }
      alert('Failed to stop recording. Check console for details.');
      setIsRecording(false); // Reset state on error
    }
  };

  const handleRecordingStop2 = async (isCallApi: boolean) => {
    try {
      console.log('Stopping recording (new implementation)...');
      const { invoke } = await import('@tauri-apps/api/core');
      const { appDataDir } = await import('@tauri-apps/api/path');
      
      const dataDir = await appDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const transcriptPath = `${dataDir}transcript-${timestamp}.txt`;
      const audioPath = `${dataDir}recording-${timestamp}.wav`;
      
      // Stop recording and get audio path
      await invoke('stop_recording', { 
        args: { 
          model_config: modelConfig,
          save_path: audioPath
        }
      });
      console.log('Recording stopped successfully');

      // Save to SQLite
      if (isCallApi) {
        console.log('Saving transcript to database...', transcripts);
        const response = await fetch('http://localhost:5167/save-transcript', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            meeting_title: meetingTitle,
            transcripts: transcripts
          })
        });

        if (!response.ok) {
          setIsRecording(false);
          throw new Error('Failed to save transcript to database');
        }

        const responseData = await response.json();
        const meetingId = responseData.meeting_id;
        setMeetings((prev: CurrentMeeting[]) => [{ id: meetingId, title: meetingTitle }, ...prev]);
        
        // Set current meeting and navigate
        setCurrentMeeting({ id: meetingId, title: meetingTitle });
        setIsMeetingActive(false);
        router.push('/meeting-details');
      }

      setIsRecording(false);
      
      // Show summary button if we have transcript content
      if (transcripts.length > 0) {
        setShowSummary(true);
      } else {
        console.log('No transcript content available');
      }
    } catch (error) {
      console.error('Error in handleRecordingStop2:', error);
      setIsRecording(false);
    }
  };

  const handleTranscriptUpdate = (update: any) => {
    console.log('Handling transcript update:', update);
    const newTranscript = {
      id: Date.now().toString(),
      text: update.text,
      timestamp: update.timestamp,
    };
    setTranscripts(prev => {
      // Check if this transcript already exists
      const exists = prev.some(
        t => t.text === update.text && t.timestamp === update.timestamp
      );
      if (exists) {
        return prev;
      }
      return [...prev, newTranscript];
    });
  };

  const generateAISummary = useCallback(async () => {
    setSummaryStatus('processing');
    setSummaryError(null);

    try {
      const fullTranscript = transcripts.map(t => t.text).join('\n');
      if (!fullTranscript.trim()) {
        throw new Error('No transcript text available. Please add some text first.');
      }
      
      // Store the original transcript for regeneration
      setOriginalTranscript(fullTranscript);
      
      console.log('Generating summary for transcript length:', fullTranscript.length);
      
      // Process transcript and get process_id
      console.log('Processing transcript...');
      const response = await fetch('http://localhost:5167/process-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullTranscript,
          model: modelConfig.provider,
          model_name: modelConfig.model,
          chunk_size: 40000,
          overlap: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Process transcript failed:', errorData);
        setSummaryError(errorData.error || 'Failed to process transcript');
        setSummaryStatus('error');
        return;
      }

      const { process_id } = await response.json();
      console.log('Process ID:', process_id);
   

      // Poll for summary status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`http://localhost:5167/get-summary/${process_id}`);
          
          if (!statusResponse.ok) {
            const errorData = await statusResponse.json();
            console.error('Get summary failed:', errorData);
            setSummaryError(errorData.error || 'Unknown error');
            setSummaryStatus('error');
            clearInterval(pollInterval);
            return;
          }

          const result = await statusResponse.json();
          console.log('Summary status:', result);

          if (result.status === 'error') {
            setSummaryError(result.error || 'Unknown error');
            setSummaryStatus('error');
            clearInterval(pollInterval);
            return;
          }

          if (result.status === 'completed' && result.data) {
            clearInterval(pollInterval);
            
            // Remove MeetingName from data before formatting
            const { MeetingName, ...summaryData } = result.data;
            
            // Update meeting title if available
            if (MeetingName) {
              setMeetingTitle(MeetingName);
            }

            // Format the summary data with consistent styling
            const formattedSummary = Object.entries(summaryData).reduce((acc: Summary, [key, section]: [string, any]) => {
              acc[key] = {
                title: section.title,
                blocks: section.blocks.map((block: any) => ({
                  ...block,
                  type: 'bullet',
                  color: 'default',
                  content: block.content.trim() // Remove trailing newlines
                }))
              };
              return acc;
            }, {} as Summary);

            setAiSummary(formattedSummary);
            setSummaryStatus('completed');
          }
        } catch (error) {
          console.error('Failed to get summary status:', error);
          if (error instanceof Error) {
            setSummaryError(`Failed to get summary status: ${error.message}`);
          } else {
            setSummaryError('Failed to get summary status: Unknown error');
          }
          setSummaryStatus('error');
          clearInterval(pollInterval);
        }
      }, 5000); // Poll every 30 seconds

      // Cleanup interval on component unmount
      return () => clearInterval(pollInterval);
      
    } catch (error) {
      console.error('Failed to generate summary:', error);
      if (error instanceof Error) {
        setSummaryError(`Failed to generate summary: ${error.message}`);
      } else {
        setSummaryError('Failed to generate summary: Unknown error');
      }
      setSummaryStatus('error');
    }
  }, [transcripts, modelConfig]);

  const handleSummary = useCallback((summary: any) => {
    setAiSummary(summary);
  }, []);

  const handleSummaryChange = (newSummary: Summary) => {
    console.log('Summary changed:', newSummary);
    setAiSummary(newSummary);
  };

  const handleTitleChange = (newTitle: string) => {
    setMeetingTitle(newTitle);
    setCurrentMeeting({ id: 'intro-call', title: newTitle });
  };

  const getSummaryStatusMessage = (status: SummaryStatus) => {
    switch (status) {
      case 'idle':
        return 'Ready to generate summary';
      case 'processing':
        return 'Processing transcript...';
      case 'summarizing':
        return 'Generating AI summary...';
      case 'regenerating':
        return 'Regenerating AI summary...';
      case 'completed':
        return 'Summary generated successfully!';
      case 'error':
        return summaryError || 'An error occurred';
      default:
        return '';
    }
  };

  const handleDownloadTranscript = async () => {
    try {
      // Create transcript object with metadata
      const transcriptData = {
        title: meetingTitle,
        timestamp: new Date().toISOString(),
        transcripts: transcripts
      };

      // Generate filename
      const sanitizedTitle = meetingTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${sanitizedTitle}_transcript.json`;
      
      // Get download directory path
      const downloadPath = await downloadDir();
      
      // Write file to downloads directory
      await writeTextFile(`${downloadPath}/${filename}`, JSON.stringify(transcriptData, null, 2));

      console.log('Transcript saved successfully to:', `${downloadPath}/${filename}`);
      alert('Transcript downloaded successfully!');
    } catch (error) {
      console.error('Failed to save transcript:', error);
      alert('Failed to save transcript. Please try again.');
    }
  };

  const handleUploadTranscript = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate the uploaded file structure
      if (!data.transcripts || !Array.isArray(data.transcripts)) {
        throw new Error('Invalid transcript file format');
      }

      // Update state with uploaded data
      setMeetingTitle(data.title || 'Uploaded Transcript');
      setTranscripts(data.transcripts);
      
      // Generate summary for the uploaded transcript
      handleSummary(data.transcripts);
    } catch (error) {
      console.error('Error uploading transcript:', error);
      alert('Failed to upload transcript. Please make sure the file format is correct.');
    }
  };

  const handleRegenerateSummary = useCallback(async () => {
    if (!originalTranscript.trim()) {
      console.error('No original transcript available for regeneration');
      return;
    }

    setSummaryStatus('regenerating');
    setSummaryError(null);

    try {
      console.log('Regenerating summary with original transcript...');
      
      // Process transcript and get process_id
      console.log('Processing transcript...');
      const response = await fetch('http://localhost:5167/process-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: originalTranscript,
          model: modelConfig.provider,
          model_name: modelConfig.model,
          chunk_size: 40000,
          overlap: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Process transcript failed:', errorData);
        throw new Error(errorData.error || 'Failed to process transcript');
      }

      const { process_id } = await response.json();
      console.log('Process ID:', process_id);

      // Poll for summary status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`http://localhost:5167/get-summary/${process_id}`);
          
          if (!statusResponse.ok) {
            const errorData = await statusResponse.json();
            console.error('Get summary failed:', errorData);
            throw new Error(errorData.error || 'Failed to get summary status');
          }

          const result = await statusResponse.json();
          console.log('Summary status:', result);

          if (result.status === 'error') {
            setSummaryError(result.error || 'Unknown error');
            setSummaryStatus('error');
            clearInterval(pollInterval);
            return;
          }

          if (result.status === 'completed' && result.data) {
            clearInterval(pollInterval);
            
            // Remove MeetingName from data before formatting
            const { MeetingName, ...summaryData } = result.data;
            
            // Update meeting title if available
            if (MeetingName) {
              setMeetingTitle(MeetingName);
            }

            // Format the summary data with consistent styling
            const formattedSummary = Object.entries(summaryData).reduce((acc: Summary, [key, section]: [string, any]) => {
              acc[key] = {
                title: section.title,
                blocks: section.blocks.map((block: any) => ({
                  ...block,
                  type: 'bullet',
                  color: 'default',
                  content: block.content.trim()
                }))
              };
              return acc;
            }, {} as Summary);

            setAiSummary(formattedSummary);
            setSummaryStatus('completed');
          } else if (result.status === 'error') {
            clearInterval(pollInterval);
            throw new Error(result.error || 'Failed to generate summary');
          }
        } catch (error) {
          clearInterval(pollInterval);
          console.error('Failed to get summary status:', error);
          if (error instanceof Error) {
            setSummaryError(error.message);
          } else {
            setSummaryError('An unexpected error occurred');
          }
          setSummaryStatus('error');
          setAiSummary(null);
        }
      }, 10000);

      return () => clearInterval(pollInterval);
    } catch (error) {
      console.error('Failed to regenerate summary:', error);
      if (error instanceof Error) {
        setSummaryError(error.message);
      } else {
        setSummaryError('An unexpected error occurred');
      }
      setSummaryStatus('error');
      setAiSummary(null);
    }
  }, [originalTranscript, modelConfig]);

  const handleCopyTranscript = useCallback(() => {
    const fullTranscript = transcripts
      .map(t => `${t.timestamp}: ${t.text}`)
      .join('\n');
    navigator.clipboard.writeText(fullTranscript);
  }, [transcripts]);

  const handleGenerateSummary = useCallback(async () => {
    if (!transcripts.length) {
      console.log('No transcripts available for summary');
      return;
    }
    
    try {
      await generateAISummary();
    } catch (error) {
      console.error('Failed to generate summary:', error);
      if (error instanceof Error) {
        setSummaryError(error.message);
      } else {
        setSummaryError('Failed to generate summary: Unknown error');
      }
    }
  }, [transcripts, generateAISummary]);

  const isSummaryLoading = summaryStatus === 'processing' || summaryStatus === 'summarizing' || summaryStatus === 'regenerating';

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex flex-1 overflow-hidden">
        {/* Left side - Transcript */}
        <div className="w-1/2 min-w-[400px] border-r border-border bg-card flex flex-col relative p-6">
          {/* Title area */}
          <div className="mb-6">
            <div className="flex flex-col space-y-3">
              <div className="flex items-center">
                <EditableTitle
                  title={meetingTitle}
                  isEditing={isEditingTitle}
                  onStartEditing={() => setIsEditingTitle(true)}
                  onFinishEditing={() => setIsEditingTitle(false)}
                  onChange={handleTitleChange}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleCopyTranscript}
                  disabled={transcripts.length === 0}
                  variant="outline"
                  className="inline-flex items-center gap-2"
                  title={transcripts.length === 0 ? 'No transcript available' : 'Copy Transcript'}
                >
                  <Copy className="h-4 w-4" />
                  <span className="text-sm">Copy Transcript</span>
                </Button>
                {showSummary && !isRecording && (
                  <>
                    <Button
                      onClick={handleGenerateSummary}
                      disabled={summaryStatus === 'processing'}
                      className={`inline-flex items-center gap-2 ${
                        summaryStatus === 'processing'
                          ? 'bg-primary/70 cursor-not-allowed'
                          : transcripts.length === 0
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      }`}
                      title={
                        summaryStatus === 'processing'
                          ? 'Generating summary...'
                          : transcripts.length === 0
                          ? 'No transcript available'
                          : 'Generate AI Summary'
                      }
                    >
                      {summaryStatus === 'processing' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Processing...</span>
                        </>
                      ) : (
                        <>
                          <StickyNote className="h-4 w-4" />
                          <span className="text-sm">Generate Note</span>
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setShowModelSettings(true)}
                      variant="outline"
                      className="inline-flex items-center gap-2"
                      title="Model Settings"
                    >
                      <Settings className="h-4 w-4" />
                      <span className="text-sm">Model Settings</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Transcript content */}
          <div className="flex-1 overflow-y-auto pt-4 pb-32">
            <TranscriptView transcripts={transcripts} />
          </div>

          {/* Recording controls */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
            <div className="bg-card rounded-full shadow-lg flex items-center border border-border">
              <RecordingControls
                isRecording={isRecording}
                onRecordingStop={() => handleRecordingStop2(true)}
                onRecordingStart={handleRecordingStart}
                onTranscriptReceived={handleTranscriptUpdate}
                barHeights={barHeights}
              />
            </div>
          </div>

          {/* Model Settings Modal is now rendered via ModelSettingsModal component directly */}
          {showModelSettings && (
            <ModelSettingsModal
              showModelSettings={showModelSettings}
              setShowModelSettings={setShowModelSettings}
              modelConfig={modelConfig}
              setModelConfig={setModelConfig}
              onSave={(config) => {
                setModelConfig(config);
                // You might want to trigger a save to backend here as well
              }}
            />
          )}
        </div>

        {/* Right side - AI Summary */}
        <div className="flex-1 overflow-y-auto bg-background p-6">
          {isSummaryLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="inline-block animate-spin h-12 w-12 text-primary mb-4" />
                <p className="text-muted-foreground">Generating AI Summary...</p>
              </div>
            </div>
          ) : showSummary && (
            <div className="max-w-4xl w-full mx-auto">
              
              <div className="flex-1 overflow-y-auto">
                <AISummary 
                  summary={aiSummary} 
                  status={summaryStatus} 
                  error={summaryError}
                  onSummaryChange={handleSummaryChange}
                  onRegenerateSummary={handleRegenerateSummary}
                  meeting={{
                    id: currentMeeting?.id || 'unknown',
                    title: currentMeeting?.title || 'Untitled Meeting',
                    created_at: new Date().toISOString(),
                  }} // Pass meeting prop
                />
              </div>
              {summaryStatus !== 'idle' && (
                <div className={`mt-6 p-4 rounded-lg border ${
                  summaryStatus === 'error' ? 'bg-destructive/10 text-destructive-foreground border-destructive/20' :
                  summaryStatus === 'completed' ? 'bg-primary/10 text-primary-foreground border-primary/20' :
                  'bg-secondary/10 text-secondary-foreground border-secondary/20'
                }`}>
                  <p className="text-sm font-medium">{getSummaryStatusMessage(summaryStatus)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
