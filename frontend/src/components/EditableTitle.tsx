'use client';

import { useRef } from 'react';
import { Pencil, Trash } from 'lucide-react'; // Import Lucide icons
import { Button } from '@/components/ui/button'; // Import Shadcn Button

interface EditableTitleProps {
  title: string;
  isEditing: boolean;
  onStartEditing: () => void;
  onFinishEditing: () => void;
  onChange: (value: string) => void;
  onDelete?: () => void;
}

export const EditableTitle: React.FC<EditableTitleProps> = ({
  title,
  isEditing,
  onStartEditing,
  onFinishEditing,
  onChange,
  onDelete,
}) => {
  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onFinishEditing();
    }
  };

  return isEditing ? (
    <input
      ref={titleInputRef}
      type="text"
      value={title}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onFinishEditing}
      onKeyDown={handleKeyDown}
      className="text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary rounded px-1 text-foreground"
      autoFocus
    />
  ) : (
    <div className="group flex items-center space-x-2">
      <h1
        className="text-xl font-bold cursor-pointer hover:bg-secondary/10 rounded px-2 py-1 text-foreground"
        onClick={onStartEditing}
      >
        {title}
      </h1>
      <div className="flex space-x-1">
        <Button 
          variant="ghost"
          size="icon"
          onClick={onStartEditing}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-secondary/10 rounded"
          title="Edit section title"
        >
          <Pencil className="w-4 h-4 text-gray-600" />
        </Button>
        {onDelete && (
          <Button 
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-destructive/10 rounded text-destructive"
            title="Delete section"
          >
            <Trash className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
