import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, X } from 'lucide-react'; // Import Lucide icons
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export interface ModelConfig {
  provider: 'ollama' | 'groq' | 'claude' | 'openai';
  model: string;
  whisperModel: string;
  apiKey?: string | null;
}

interface OllamaModel {
  name: string;
  id: string;
  size: string;
  modified: string;
}

interface ModelSettingsModalProps {
  showModelSettings: boolean;
  setShowModelSettings: (show: boolean) => void;
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
  onSave: (config: ModelConfig) => void;
}

export function ModelSettingsModal({
  showModelSettings,
  setShowModelSettings,
  modelConfig,
  setModelConfig,
  onSave
}: ModelSettingsModalProps) {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [error, setError] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>(modelConfig.apiKey || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isApiKeyLocked, setIsApiKeyLocked] = useState<boolean>(true);
  const [isLockButtonVibrating, setIsLockButtonVibrating] = useState<boolean>(false);

  useEffect(() => {
    if (showModelSettings) {
      const fetchModelConfig = async () => {
        try {
          const response = await fetch('http://localhost:5167/get-model-config');
          const data = await response.json();
          if (data.provider !== null) {
            setModelConfig(data);
            setApiKey(data.apiKey || '');
          }
        } catch (error) {
          console.error('Failed to fetch model config:', error);
        }
      };

      fetchModelConfig();
    }
  }, [showModelSettings]);

  const fetchApiKey = async (provider: string) => {
    try {
      const response = await fetch('http://localhost:5167/get-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setApiKey(data || '');
    } catch (err) {
      console.error('Error fetching API key:', err);
      setApiKey('');
    }
  };

  const modelOptions = {
    ollama: models.map(model => model.name),
    // claude: ['claude-3-5-sonnet-latest'],
    claude: ['claude-3-5-sonnet-latest','claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20240620'],
    groq: ['llama-3.3-70b-versatile'],
    openai: [
      'gpt-4o',
      'gpt-4.1',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'gpt-4o-2024-11-20',
      'gpt-4o-2024-08-06',
      'gpt-4o-mini-2024-07-18',
      'gpt-4.1-2025-04-14',
      'gpt-4.1-nano-2025-04-14',
      'gpt-4.1-mini-2025-04-14',
      'o4-mini-2025-04-16',
      'o3-2025-04-16',
      'o3-mini-2025-01-31',
      'o1-2024-12-17',
      'o1-mini-2024-09-12',
      'gpt-4-turbo-2024-04-09',
      'gpt-4-0125-Preview',
      'gpt-4-vision-preview',
      'gpt-4-1106-Preview',
      'gpt-3.5-turbo-0125',
      'gpt-3.5-turbo-1106'
    ]
  };

  const requiresApiKey = modelConfig.provider === 'claude' || modelConfig.provider === 'groq' || modelConfig.provider === 'openai';
  const isDoneDisabled = requiresApiKey && !apiKey.trim();

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

  const handleSave = () => {
    const updatedConfig = { ...modelConfig, apiKey: apiKey.trim() };
    setModelConfig(updatedConfig);
    console.log('ModelSettingsModal - handleSave - Updated ModelConfig:', updatedConfig);
    setShowModelSettings(false);
    onSave(updatedConfig);
  };

  const handleInputClick = () => {
    if (isApiKeyLocked) {
      setIsLockButtonVibrating(true);
      setTimeout(() => setIsLockButtonVibrating(false), 500);
    }
  };

  if (!showModelSettings) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">Model Settings</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowModelSettings(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Summarization Model
            </label>
            <div className="flex space-x-2">
              <Select
                value={modelConfig.provider}
                onValueChange={(value: string) => {
                  const provider = value as ModelConfig['provider'];
                  setModelConfig({
                    ...modelConfig,
                    provider,
                    model: modelOptions[provider][0]
                  });
                  fetchApiKey(provider);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="ollama">Ollama</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={modelConfig.model}
                onValueChange={(value: string) => setModelConfig((prev: ModelConfig) => ({ ...prev, model: value }))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions[modelConfig.provider].map(model => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {requiresApiKey && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                API Key
              </label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
                  disabled={isApiKeyLocked}
                  className={`pr-24 ${
                    isApiKeyLocked ? 'bg-muted cursor-not-allowed' : ''
                  }`}
                  placeholder="Enter your API key"
                />
                {isApiKeyLocked && (
                  <div 
                    onClick={handleInputClick}
                    className="absolute inset-0 flex items-center justify-center bg-muted bg-opacity-50 rounded-md cursor-not-allowed"
                  />
                    
                  
                )}
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => setIsApiKeyLocked(!isApiKeyLocked)}
                    className={`text-muted-foreground hover:text-foreground transition-colors duration-200 ${
                      isLockButtonVibrating ? 'animate-vibrate text-destructive' : ''
                    }`}
                    title={isApiKeyLocked ? "Unlock to edit" : "Lock to prevent editing"}
                  >
                    {isApiKeyLocked ? (
                      <Lock className="h-5 w-5" />
                    ) : (
                      <Lock className="h-5 w-5" /> // Consider using an `Unlock` icon here if available in lucide-react
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {modelConfig.provider === 'ollama' && (
            <div>
              <h4 className="text-lg font-bold mb-4 text-foreground">Available Ollama Models</h4>
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive-foreground px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}
              <div className="grid gap-4 max-h-[400px] overflow-y-auto pr-2">
                {models.map((model) => (
                  <div 
                    key={model.id}
                    className={`bg-card p-4 rounded-lg shadow-sm cursor-pointer transition-colors border border-border ${
                      modelConfig.model === model.name ? 'ring-2 ring-primary/20 bg-primary/10' : 'hover:bg-secondary/10'
                    }`}
                    onClick={() => setModelConfig((prev: ModelConfig) => ({ ...prev, model: model.name }))}
                  >
                    <h3 className="font-bold text-foreground">{model.name}</h3>
                    <p className="text-muted-foreground">Size: {model.size}</p>
                    <p className="text-muted-foreground">Modified: {model.modified}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isDoneDisabled}
            className={`px-4 py-2 text-sm font-medium ${
              isDoneDisabled 
                ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
} 