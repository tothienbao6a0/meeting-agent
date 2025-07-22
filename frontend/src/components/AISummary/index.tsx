'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Summary, Block } from '@/types';
import { Section } from './Section';
import { EditableTitle } from '../EditableTitle';
import { ExclamationTriangleIcon, CheckCircleIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { Undo, Redo, Plus, Copy, RotateCcw } from 'lucide-react'; // Import new icons
import { Button } from "@/components/ui/button"; // Import Shadcn Button
import { Trash } from 'lucide-react'; // Import Trash icon for context menu

interface Props {
  summary: Summary | null;
  status: 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';
  error: string | null;
  onSummaryChange: (summary: Summary) => void;
  onRegenerateSummary: () => void;
  meeting?: {
    id: string;
    title: string;
    created_at: string;
  };
}

export const AISummary = ({ summary, status, error, onSummaryChange, onRegenerateSummary, meeting }: Props) => {
  const generateUniqueId = (sectionKey: string) => {
    return `${sectionKey}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const ensureUniqueBlockIds = (summary: Summary): Summary => {
    const updatedSummary = { ...summary };
    
    Object.entries(updatedSummary).forEach(([sectionKey, section]) => {
      section.blocks = section.blocks.map(block => ({
        ...block,
        id: block.id.includes(sectionKey) ? block.id : generateUniqueId(sectionKey)
      }));
    });
    
    return updatedSummary;
  };

  const currentSummary = useMemo(() => {
    if (!summary) {
      return {
        Agenda: { title: "Agenda", blocks: [] },
        Decisions: { title: "Decisions", blocks: [] },
        ActionItems: { title: "Action Items", blocks: [] },
        ClosingRemarks: { title: "Closing Remarks", blocks: [] }
      };
    }
    return ensureUniqueBlockIds(summary);
  }, [summary]);

  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [lastSelectedBlock, setLastSelectedBlock] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartBlock, setDragStartBlock] = useState<string | null>(null);
  const hiddenInputRef = useRef<HTMLTextAreaElement>(null);

  // History management
  const [history, setHistory] = useState<Summary[]>([currentSummary]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [isUndoRedoing, setIsUndoRedoing] = useState(false);

  // Add to history when summary changes
  useEffect(() => {
    if (!isUndoRedoing && summary) {  // Only update history if summary is not null
      const newHistory = history.slice(0, currentHistoryIndex + 1);
      newHistory.push(summary);
      setHistory(newHistory);
      setCurrentHistoryIndex(newHistory.length - 1);
    }
    setIsUndoRedoing(false);
  }, [summary]);

  const handleUndo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      setIsUndoRedoing(true);
      const newIndex = currentHistoryIndex - 1;
      setCurrentHistoryIndex(newIndex);
      onSummaryChange(history[newIndex]);
    }
  }, [currentHistoryIndex, history, onSummaryChange]);

  const handleRedo = useCallback(() => {
    if (currentHistoryIndex < history.length - 1) {
      setIsUndoRedoing(true);
      const newIndex = currentHistoryIndex + 1;
      setCurrentHistoryIndex(newIndex);
      onSummaryChange(history[newIndex]);
    }
  }, [currentHistoryIndex, history, onSummaryChange]);

  const getAllBlocks = () => {
    const allBlocks: { id: string; sectionKey: string }[] = [];
    Object.entries(currentSummary).forEach(([sectionKey, section]) => {
      section.blocks.forEach(block => {
        allBlocks.push({ id: block.id, sectionKey });
      });
    });
    return allBlocks;
  };

  const findBlockAndSection = (blockId: string) => {
    for (const [sectionKey, section] of Object.entries(currentSummary)) {
      const block = section.blocks.find(b => b.id === blockId);
      if (block) {
        return { block, sectionKey };
      }
    }
    return null;
  };

  const handleBlockNavigate = (blockId: string, direction: 'up' | 'down') => {
    const allBlocks = getAllBlocks();
    const currentIndex = allBlocks.findIndex(b => b.id === blockId);
    
    if (currentIndex === -1) return;
    
    let targetIndex: number;
    if (direction === 'up') {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
    } else {
      targetIndex = currentIndex < allBlocks.length - 1 ? currentIndex + 1 : currentIndex;
    }
    
    if (targetIndex !== currentIndex) {
      const targetBlock = allBlocks[targetIndex];
      setSelectedBlocks([targetBlock.id]);
      setLastSelectedBlock(targetBlock.id);
    }
  };

  const getBlockRange = (startId: string, endId: string) => {
    const allBlocks = getAllBlocks();
    const startIndex = allBlocks.findIndex(b => b.id === startId);
    const endIndex = allBlocks.findIndex(b => b.id === endId);
    
    if (startIndex === -1 || endIndex === -1) return [];
    
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    
    return allBlocks.slice(start, end + 1).map(b => b.id);
  };

  const handleBlockMouseDown = (blockId: string, sectionKey: keyof Summary, e: React.MouseEvent<HTMLDivElement>) => {
    if (!e.shiftKey) {
      setDragStartBlock(blockId);
      setLastSelectedBlock(blockId);
      setSelectedBlocks([blockId]);
    }
    setIsDragging(true);
  };

  const handleBlockMouseEnter = (blockId: string, sectionKey: keyof Summary) => {
    if (isDragging && dragStartBlock) {
      const range = getBlockRange(dragStartBlock, blockId);
      setSelectedBlocks(range);
    }
  };

  const handleBlockMouseUp = (blockId: string, sectionKey: keyof Summary, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.shiftKey && lastSelectedBlock) {
      const range = getBlockRange(lastSelectedBlock, blockId);
      setSelectedBlocks(range);
    }
    setIsDragging(false);
  };

  const handleBlockChange = (sectionKey: keyof Summary, blockId: string, newContent: string) => {
    onSummaryChange({
      ...currentSummary,
      [sectionKey]: {
        ...currentSummary[sectionKey],
        blocks: currentSummary[sectionKey].blocks.map(block => 
          block.id === blockId ? { ...block, content: newContent } : block
        )
      }
    });
  };

  const handleBlockTypeChange = (blockId: string, newType: Block['type']) => {
    // Find the section key for this block
    let blockSectionKey: string | null = null;
    for (const [sectionKey, section] of Object.entries(currentSummary)) {
      if (section.blocks.some(b => b.id === blockId)) {
        blockSectionKey = sectionKey;
        break;
      }
    }

    if (!blockSectionKey) return;

    onSummaryChange({
      ...currentSummary,
      [blockSectionKey]: {
        ...currentSummary[blockSectionKey],
        blocks: currentSummary[blockSectionKey].blocks.map(block => 
          block.id === blockId ? { ...block, type: newType } : block
        )
      }
    });
  };

  const handleTitleChange = (sectionKey: keyof Summary, newTitle: string) => {
    console.log('Title change:', { sectionKey, newTitle });
    const updatedSummary = {
      ...currentSummary,
      [sectionKey]: {
        ...currentSummary[sectionKey],
        title: newTitle
      }
    };
    console.log('Updated summary:', updatedSummary);
    onSummaryChange(updatedSummary);
  };

  const handleKeyDown = (e: React.KeyboardEvent, blockId: string) => {
    // Find the section key for this block
    let blockSectionKey: string | null = null;
    let currentBlockIndex = -1;
    
    for (const [sectionKey, section] of Object.entries(currentSummary)) {
      currentBlockIndex = section.blocks.findIndex(b => b.id === blockId);
      if (currentBlockIndex !== -1) {
        blockSectionKey = sectionKey;
        break;
      }
    }

    if (!blockSectionKey) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const currentBlock = currentSummary[blockSectionKey].blocks[currentBlockIndex];
      
      if (!currentBlock) return;
      
      const newId = generateUniqueId(blockSectionKey);
      const textarea = e.target as HTMLTextAreaElement;
      const newBlockContent = textarea.dataset.newBlockContent || '';
      
      // Update the blocks array for the specific section
      const updatedBlocks = [...currentSummary[blockSectionKey].blocks];
      
      // Get the type of the current block for the new block
      const newBlockType = currentBlock.type === 'bullet' ? 'bullet' : 'text';
      
      // Insert new block after current block
      updatedBlocks.splice(currentBlockIndex + 1, 0, {
        id: newId,
        type: newBlockType,
        content: newBlockContent,
        color: currentBlock.color || 'default'
      });
      
      onSummaryChange({
        ...currentSummary,
        [blockSectionKey]: {
          ...currentSummary[blockSectionKey],
          blocks: updatedBlocks
        }
      });
      
      // Focus and select the new block
      setSelectedBlocks([newId]);
      setLastSelectedBlock(newId);
      
      // Use setTimeout to ensure the textarea is mounted
      setTimeout(() => {
        const newTextarea = document.querySelector(`[data-block-id="${newId}"]`) as HTMLTextAreaElement;
        if (newTextarea) {
          newTextarea.focus();
          newTextarea.setSelectionRange(0, 0);
        }
      }, 0);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlocks.length > 1) {
      e.preventDefault();
      handleDeleteSelectedBlocks();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const cursorPosition = (e.target as HTMLTextAreaElement).selectionStart;
      const isAtStart = cursorPosition === 0;
      const isAtEnd = cursorPosition === (e.target as HTMLTextAreaElement).value.length;

      if ((e.key === 'ArrowUp' && isAtStart) || (e.key === 'ArrowDown' && isAtEnd)) {
        e.preventDefault();
        handleBlockNavigate(blockId, e.key === 'ArrowUp' ? 'up' : 'down');
      }
    }
  };

  const handleBlockDelete = (blockId: string, mergeContent?: string) => {
    // Find the section key for this block
    let blockSectionKey: string | null = null;
    let currentBlockIndex = -1;

    for (const [sectionKey, section] of Object.entries(currentSummary)) {
      currentBlockIndex = section.blocks.findIndex(b => b.id === blockId);
      if (currentBlockIndex !== -1) {
        blockSectionKey = sectionKey;
        break;
      }
    }

    if (!blockSectionKey) return;

    const updatedBlocks = [...currentSummary[blockSectionKey].blocks];
    
    // If there's content to merge and a previous block exists
    if (mergeContent && currentBlockIndex > 0) {
      const previousBlock = updatedBlocks[currentBlockIndex - 1];
      const previousContent = previousBlock.content;
      const cursorPosition = previousContent.length;
      
      // Update previous block with merged content
      updatedBlocks[currentBlockIndex - 1] = {
        ...previousBlock,
        content: previousContent + mergeContent
      };
      
      // Remove current block
      updatedBlocks.splice(currentBlockIndex, 1);
      
      onSummaryChange({
        ...currentSummary,
        [blockSectionKey]: {
          ...currentSummary[blockSectionKey],
          blocks: updatedBlocks
        }
      });

      // Select the previous block and set cursor at merge point
      setSelectedBlocks([previousBlock.id]);
      setLastSelectedBlock(previousBlock.id);
      
      // Use setTimeout to ensure the textarea is mounted
      setTimeout(() => {
        const textarea = document.querySelector(`[data-block-id="${previousBlock.id}"]`) as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(cursorPosition, cursorPosition);
        }
      }, 0);
    } else {
      // Just remove the block if no content to merge
      updatedBlocks.splice(currentBlockIndex, 1);
      
      onSummaryChange({
        ...currentSummary,
        [blockSectionKey]: {
          ...currentSummary[blockSectionKey],
          blocks: updatedBlocks
        }
      });

      // Select the previous block if it exists, otherwise the next block
      if (updatedBlocks.length > 0) {
        const newSelectedBlock = updatedBlocks[Math.max(0, currentBlockIndex - 1)];
        setSelectedBlocks([newSelectedBlock.id]);
        setLastSelectedBlock(newSelectedBlock.id);
      } else {
        setSelectedBlocks([]);
        setLastSelectedBlock(null);
      }
    }
  };

  const getSelectedBlocksContent = useCallback(() => {
    return selectedBlocks
      .map(blockId => {
        for (const [sectionKey, section] of Object.entries(currentSummary)) {
          const block = section.blocks.find(b => b.id === blockId);
          if (block) {
            return block.content;
          }
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }, [selectedBlocks, currentSummary]);

  useEffect(() => {
    if (hiddenInputRef.current && selectedBlocks.length > 1) {
      const content = getSelectedBlocksContent();
      hiddenInputRef.current.value = content;
      hiddenInputRef.current.select();
    }
  }, [selectedBlocks, getSelectedBlocksContent]);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey)) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (e.key === 'c') {
          const blockContents = selectedBlocks.map(blockId => {
            for (const [sectionKey, section] of Object.entries(currentSummary)) {
              const block = section.blocks.find(b => b.id === blockId);
              if (block) {
                return block.content;
              }
            }
            return '';
          }).filter(Boolean);

          navigator.clipboard.writeText(blockContents.join('\n'));
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlocks.length > 1) {
        e.preventDefault();
        handleDeleteSelectedBlocks();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedBlocks, currentSummary, handleUndo, handleRedo]);

  const handleDeleteSelectedBlocks = () => {
    // Group selected blocks by section
    const blocksBySection = new Map<string, string[]>();
    selectedBlocks.forEach(blockId => {
      Object.entries(currentSummary).forEach(([sectionKey, section]) => {
        if (section.blocks.some(b => b.id === blockId)) {
          const blocks = blocksBySection.get(sectionKey) || [];
          blocks.push(blockId);
          blocksBySection.set(sectionKey, blocks);
        }
      });
    });

    // Create new summary with blocks removed
    const newSummary = { ...currentSummary };
    blocksBySection.forEach((blockIds, sectionKey) => {
      newSummary[sectionKey] = {
        ...newSummary[sectionKey],
        blocks: newSummary[sectionKey].blocks.filter(b => !blockIds.includes(b.id))
      };
    });

    onSummaryChange(newSummary);
    setSelectedBlocks([]);
    setLastSelectedBlock(null);
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      visible: true
    });
  };

  const handleCopyBlocks = useCallback(() => {
    const content = getSelectedBlocksContent();
    navigator.clipboard.writeText(content);
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, [getSelectedBlocksContent]);

  const handleDeleteBlocks = () => {
    handleDeleteSelectedBlocks();
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleSectionDelete = (sectionKey: keyof Summary) => {
    const newSummary = { ...currentSummary };
    delete newSummary[sectionKey];
    onSummaryChange(newSummary);
  };

  const handleAddSection = () => {
    const newSectionKey = `section${Object.keys(currentSummary).length + 1}`;
    const newBlockId = Date.now().toString();
    const newSummary: Summary = {
      ...currentSummary,
      [newSectionKey]: {
        title: 'New Section',
        blocks: [{
          id: newBlockId,
          type: 'text' as const,
          content: '',
          color: 'default' as const
        }]
      }
    };
    onSummaryChange(newSummary);
    
    // Select the new block
    setSelectedBlocks([newBlockId]);
    setLastSelectedBlock(newBlockId);
  };

  const convertToMarkdown = () => {
    let markdown = `# AI Generated Summary of Meeting: ${meeting?.id || 'Unknown'} - ${meeting?.title || 'Untitled Meeting'}\n\n`;
    markdown += `## Date: ${meeting?.created_at ? new Date(meeting.created_at).toLocaleDateString() : new Date().toLocaleDateString()}\n\n`;
    
    Object.entries(currentSummary).forEach(([key, section]) => {
      if (key === 'title') {
        markdown = `# ${section.title || 'AI Enhanced Summary'}\n\n`;
      } else {
        markdown += `## ${section.title || key}\n\n`;
        section.blocks.forEach(block => {
          switch (block.type) {
            case 'heading1':
              markdown += `### ${block.content}\n\n`;
              break;
            case 'heading2':
              markdown += `#### ${block.content}\n\n`;
              break;
            case 'bullet':
              markdown += `- ${block.content}\n`;
              break;
            case 'text':
            default:
              markdown += `${block.content}\n\n`;
          }
        });
        // Add an extra newline after bullet lists
        if (section.blocks.some(block => block.type === 'bullet')) {
          markdown += '\n';
        }
      }
    });
    
    return markdown;
  };

  const handleExport = () => {
    const markdown = convertToMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSummary.title || 'ai-summary'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderErrorState = () => (
    <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center mb-2">
        <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
        <h3 className="text-red-700 font-medium">Error Generating Summary</h3>
      </div>
      <p className="text-red-600 text-sm">{error}</p>
      <p className="text-red-500 text-xs mt-2">Please try again or contact support if the issue persists.</p>
    </div>
  );

  const renderLoadingState = () => (
    <div className="w-full p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
        <div>
          <h3 className="text-blue-700 font-medium">
            {status === 'processing' ? 'Processing Transcript' : 'Generating Summary'}
          </h3>
          <p className="text-blue-600 text-sm">
            {status === 'processing' 
              ? 'Analyzing your transcript...' 
              : 'Creating a detailed summary of your meeting...'}
          </p>
        </div>
      </div>
    </div>
  );

  if (error) {
    return renderErrorState();
  }

  if (status === 'processing' || status === 'summarizing' || status === 'regenerating') {
    return renderLoadingState();
  }

  const hasContent = Object.values(currentSummary).some(section => section?.blocks?.length > 0);

  if (!hasContent && status === 'completed') {
    return (
      <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-gray-600">No summary content available.</p>
        <p className="text-gray-500 text-sm mt-1">Try generating a new summary.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex justify-end mb-4 space-x-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleUndo}
          disabled={currentHistoryIndex === 0}
          title="Undo"
        >
          <Undo className="w-4 h-4 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRedo}
          disabled={currentHistoryIndex === history.length - 1}
          title="Redo"
        >
          <Redo className="w-4 h-4 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleAddSection}
          title="Add new section"
        >
          <Plus className="w-4 h-4 text-gray-600" />
        </Button>
      </div>
      
      {selectedBlocks.length > 1 && (
        <textarea
          ref={hiddenInputRef}
          className="sr-only"
          readOnly
          value={getSelectedBlocksContent()}
          tabIndex={-1}
        />
      )}
      
      {/* Context Menu */}
      {contextMenu.visible && selectedBlocks.length > 0 && (
        <div
          className="fixed z-50 bg-white shadow-lg rounded-lg py-1 min-w-[160px] border border-gray-200"
          style={{ 
            left: contextMenu.x, 
            top: contextMenu.y,
            transform: 'translate(-50%, -50%)'
          }}
          onClick={e => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            className="w-full justify-start px-4 py-2 text-left hover:bg-secondary/10 flex items-center space-x-2"
            onClick={handleCopyBlocks}
          >
            <Copy className="w-4 h-4 text-gray-600" />
            <span>Copy {selectedBlocks.length > 1 ? `${selectedBlocks.length} blocks` : 'block'}</span>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start px-4 py-2 text-left hover:bg-destructive/10 text-destructive flex items-center space-x-2"
            onClick={handleDeleteBlocks}
          >
            <Trash className="w-4 h-4" />
            <span>Delete {selectedBlocks.length > 1 ? `${selectedBlocks.length} blocks` : 'block'}</span>
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2 flex-shrink-0">
          <span className="text-2xl">✨</span>
          <h2 className="text-2xl font-bold text-foreground whitespace-nowrap">
            AI Enhanced Summary
          </h2>
        </div>
        <div className="flex space-x-2 ml-4 md:ml-auto">
          <Button
            variant="outline"
            onClick={() => {
              const markdown = convertToMarkdown();
              navigator.clipboard.writeText(markdown);
            }}
            className="flex items-center px-4 py-2 text-sm font-semibold text-secondary-foreground"
          >
            <Copy className="w-4 h-4 mr-2" />
            <span>Copy as Markdown</span>
          </Button>
          {/* <button
            onClick={handleExport}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center space-x-1"
          >
            <span>📝</span>
            <span>Export as Markdown</span>
          </button> */}
          <Button
            variant="outline"
            onClick={onRegenerateSummary}
            className="flex items-center px-4 py-2 text-sm font-semibold text-secondary-foreground"
            title="Regenerate Summary"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            <span className="ml-0">Regenerate</span>
          </Button>
        </div>
      </div>

      {Object.entries(currentSummary).map(([key, section]) => (
        <Section
          key={key}
          section={section}
          sectionKey={key}
          selectedBlocks={selectedBlocks}
          onBlockTypeChange={handleBlockTypeChange}
          onBlockChange={(blockId, content) => handleBlockChange(key, blockId, content)}
          onBlockMouseDown={(blockId, e) => handleBlockMouseDown(blockId, key, e)}
          onBlockMouseEnter={(blockId) => handleBlockMouseEnter(blockId, key)}
          onBlockMouseUp={(blockId, e) => handleBlockMouseUp(blockId, key, e)}
          onKeyDown={handleKeyDown}
          onTitleChange={handleTitleChange}
          onSectionDelete={handleSectionDelete}
          onBlockDelete={(blockId, mergeContent) => handleBlockDelete(blockId, mergeContent)}
          onContextMenu={handleContextMenu}
          onBlockNavigate={(blockId, direction) => handleBlockNavigate(blockId, direction)}
        />
      ))}
    </div>
  );
};
