"use client";
import { useState, useEffect, useCallback } from 'react';
import { Transcript, Summary, SummaryResponse } from '@/types';
import { EditableTitle } from '@/components/EditableTitle';
import { TranscriptView } from '@/components/TranscriptView';
import { AISummary } from '@/components/AISummary';
import { CurrentMeeting, useSidebar } from '@/components/Sidebar/SidebarProvider';
import { ModelSettingsModal, ModelConfig } from '@/components/ModelSettingsModal';
import { File, StickyNote } from 'lucide-react';
import { Button } from "@/components/ui/button"; // Import Shadcn Button

type SummaryStatus = 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';

export default function PageContent({ meeting, summaryData }: { meeting: any, summaryData: Summary }) {
  const [transcripts, setTranscripts] = useState<Transcript[]>(meeting.transcripts);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>('idle');
  const [meetingTitle, setMeetingTitle] = useState(meeting.title || '+ New Call');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [aiSummary, setAiSummary] = useState<Summary | null>(summaryData);
  const [summaryResponse, setSummaryResponse] = useState<SummaryResponse | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'ollama',
    model: 'llama3.2:latest',
    whisperModel: 'large-v3'
  });
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [originalTranscript, setOriginalTranscript] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { setCurrentMeeting, setMeetings } = useSidebar();

  useEffect(() => {
    const fetchModelConfig = async () => {
      try {
        const response = await fetch('http://localhost:5167/get-model-config');
        const data = await response.json();
        if (data.provider !== null) {
          setModelConfig(data);
        }
      } catch (error) {
        console.error('Failed to fetch model config:', error);
      }
    };

    fetchModelConfig();
  }, []);

  useEffect(() => {
    console.log('Model config:', modelConfig);
  }, [modelConfig]);

  const generateAISummary = useCallback(async () => {
    setSummaryStatus('processing');
    setSummaryError(null);

    try {
      const fullTranscript = transcripts?.map(t => t.text).join('\n');
      if (!fullTranscript.trim()) {
        throw new Error('No transcript text available. Please add some text first.');
      }

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
          meeting_id: meeting.id,
          chunk_size: 40000,
          overlap: 1000
        }),
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
            // Defensive: check if all sections are empty
            const summarySections = Object.entries(result.data).filter(([key]) => key !== 'MeetingName');
            const allEmpty = summarySections.every(([, section]) => !(section as any).blocks || (section as any).blocks.length === 0);
            if (allEmpty) {
              setSummaryError('Summary generation failed. Please check your model/API key settings.');
              setSummaryStatus('error');
              clearInterval(pollInterval);
              return;
            }
            clearInterval(pollInterval);

            // Remove MeetingName from data before formatting
            const { MeetingName, ...summaryData } = result.data;

            // Update meeting title if available
            if (MeetingName) {
              setMeetingTitle(MeetingName);
              setMeetings((prev: CurrentMeeting[]) => prev.map(m => m.id === meeting.id ? { ...m, title: MeetingName } : m));
              setCurrentMeeting({ id: meeting.id, title: MeetingName });
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
      }, 5000); // Poll every 5 seconds

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
  }, [transcripts, modelConfig, meeting.id]);

  const handleSummary = useCallback((summary: any) => {
    setAiSummary(summary);
  }, []);

  const handleSummaryChange = (newSummary: Summary) => {
    setAiSummary(newSummary);
  };

  const handleTitleChange = (newTitle: string) => {
    setMeetingTitle(newTitle);
  };

  const getSummaryStatusMessage = (status: SummaryStatus) => {
    switch (status) {
      case 'processing':
        return 'Processing transcript...';
      case 'summarizing':
        return 'Generating summary...';
      case 'regenerating':
        return 'Regenerating summary...';
      case 'completed':
        return 'Summary completed';
      case 'error':
        return 'Error generating summary';
      default:
        return '';
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
          meeting_id: meeting.id,
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
              setMeetings((prev: CurrentMeeting[]) => prev.map(m => m.id === meeting.id ? { ...m, title: MeetingName } : m));
              setCurrentMeeting({ id: meeting.id, title: MeetingName });
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
  }, [originalTranscript, modelConfig, meeting.id]);

  const handleCopyTranscript = useCallback(() => {
    const header = `# Transcript of the Meeting: ${meeting.id} - ${meetingTitle??meeting.title}\n\n`;
    const date = `## Date: ${new Date(meeting.created_at).toLocaleDateString()}\n\n`;
    const fullTranscript = transcripts
      .map(t => `${t.timestamp}: ${t.text}`)
      .join('\n');
    navigator.clipboard.writeText(header + date + fullTranscript);
  }, [transcripts, meeting, meetingTitle]);

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

  const handleSaveMeetingTitle = async () => {
    try {
      const payload = {
        meeting_id: meeting.id,
        title: meetingTitle
      };
      console.log('Saving meeting title with payload:', payload);
      
      const response = await fetch('http://localhost:5167/save-meeting-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Save meeting title failed:', errorData);
        console.error('Response status:', response.status);
        throw new Error(errorData.error || 'Failed to save meeting title');
      }
      
      const responseData = await response.json();
      console.log('Save meeting title success:', responseData);
      
      setMeetings((prev: CurrentMeeting[]) => prev.map(m => m.id === meeting.id ? { ...m, title: meetingTitle } : m));
      setCurrentMeeting({ id: meeting.id, title: meetingTitle });
    } catch (error) {
      console.error('Failed to save meeting title:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to save meeting title: Unknown error');
      }
    }
  };

  const handleSaveModelConfig = async (updatedConfig?: ModelConfig) => {
    try {
      const configToSave = updatedConfig || modelConfig;
      const payload = {
        provider: configToSave.provider,
        model: configToSave.model,
        whisperModel: configToSave.whisperModel,
        apiKey: configToSave.apiKey ?? null
      };
      console.log('Saving model config with payload:', payload);
      
      const response = await fetch('http://localhost:5167/save-model-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Save model config failed:', errorData);
        console.error('Response status:', response.status);
        throw new Error(errorData.error || 'Failed to save model config');
      }

      const responseData = await response.json();
      console.log('Save model config success:', responseData);

      setModelConfig(payload);
    } catch (error) {
      console.error('Failed to save model config:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to save model config: Unknown error');
      } 
    }
  };

  const isSummaryLoading = summaryStatus === 'processing' || summaryStatus === 'summarizing' || summaryStatus === 'regenerating';

  return (
    <div className="bg-card p-8 rounded-lg shadow-sm mb-6">
      <div className="flex items-center justify-between mb-6">
        <EditableTitle
          title={meetingTitle}
          isEditing={isEditingTitle}
          onStartEditing={() => setIsEditingTitle(true)}
          onFinishEditing={handleSaveMeetingTitle}
          onChange={setMeetingTitle}
        />
        <div className="flex space-x-3">
          <Button 
            variant="outline"
            onClick={handleCopyTranscript}
            className="flex items-center px-4 py-2 text-sm font-semibold text-secondary-foreground bg-white border border-border rounded-md hover:bg-secondary/10 transition-colors"
          >
            <File className="w-4 h-4 mr-2" />
            Copy Transcript
          </Button>
          <Button 
            variant="default"
            onClick={generateAISummary}
            disabled={summaryStatus === 'processing' || summaryStatus === 'summarizing' || summaryStatus === 'regenerating'}
            className={`flex items-center px-4 py-2 text-sm font-semibold text-primary-foreground rounded-md transition-colors ${summaryStatus === 'processing' || summaryStatus === 'summarizing' || summaryStatus === 'regenerating' ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}`}
          >
            {summaryStatus === 'processing' || summaryStatus === 'summarizing' || summaryStatus === 'regenerating' ? (
              <>
                <span className="loading-spinner mr-2"></span> Generating Note...
              </>
            ) : (
              <>
                <StickyNote className="w-4 h-4 mr-2" />
                Generate Note
              </>
            )}
          </Button>
          <ModelSettingsModal 
            showModelSettings={showModelSettings}
            setShowModelSettings={setShowModelSettings}
            onSave={handleSaveModelConfig}
            modelConfig={modelConfig}
            setModelConfig={setModelConfig} // Added missing prop
          />
        </div>
      </div>

      {summaryStatus === 'processing' || summaryStatus === 'summarizing' || summaryStatus === 'regenerating' ? (
        <p className="text-center text-gray-500 mt-4">{getSummaryStatusMessage(summaryStatus)}</p>
      ) : summaryError ? (
        <div className="text-red-500 text-center mt-4">Error: {summaryError}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Transcription with timestamps</h2>
          <TranscriptView transcripts={transcripts} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Summary of the meeting</h2>
          {aiSummary ? (
            <AISummary 
              summary={aiSummary}
              status={summaryStatus}
              error={summaryError}
              onSummaryChange={setAiSummary}
              onRegenerateSummary={generateAISummary}
            />
          ) : showSummary ? (
            <p className="text-gray-500">No summary generated yet. Click "Generate Note" to create one.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}



