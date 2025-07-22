'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, File, Settings, ChevronLeftCircle, ChevronRightCircle, Calendar, StickyNote, Home, Delete } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSidebar } from './SidebarProvider';
import type { CurrentMeeting } from '@/components/Sidebar/SidebarProvider';
import { ConfirmationModal } from '../ConfirmationModel/confirmation-modal';
import { Button } from "@/components/ui/button"; // Import Shadcn Button
import Image from 'next/image'; // Import Image component

interface SidebarItem {
  id: string;
  title: string;
  type: 'folder' | 'file';
  children?: SidebarItem[];
}

const Sidebar: React.FC = () => {
  const router = useRouter();
  const { sidebarItems, isCollapsed, toggleCollapse, setCurrentMeeting, currentMeeting, setMeetings, isMeetingActive } = useSidebar();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['meetings', 'notes']));
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; itemId: string | null }>({ isOpen: false, itemId: null });


  const handleDelete = async (itemId: string) => {
    console.log('Deleting item:', itemId);
    const payload = {
      meeting_id: itemId
    };
    const response = await fetch('http://localhost:5167/delete-meeting', {
      cache: 'no-store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('Meeting deleted successfully');
      setMeetings((prev: CurrentMeeting[]) => prev.filter(m => m.id !== itemId));
      
      // If deleting the active meeting, navigate to home
      if (currentMeeting?.id === itemId) {
        setCurrentMeeting({ id: 'intro-call', title: '+ New Call' });
        router.push('/');
      }
    } else {
      console.error('Failed to delete meeting');
    }
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const renderCollapsedIcons = () => {
    if (!isCollapsed) return null;

    return (
      <div className="flex flex-col items-center space-y-4 mt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (isCollapsed) toggleCollapse();
            setCurrentMeeting({ id: 'intro-call', title: '+ New Call' });
            router.push('/');
          }}
          title="New Call"
        >
          <Home className="w-5 h-5 text-primary" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (isCollapsed) toggleCollapse();
            toggleFolder('meetings');
          }}
          title="Meetings"
        >
          <Calendar className="w-5 h-5 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (isCollapsed) toggleCollapse();
            toggleFolder('notes');
          }}
          title="Notes"
        >
          <StickyNote className="w-5 h-5 text-gray-600" />
        </Button>
      </div>
    );
  };

  const renderItem = (item: SidebarItem, depth = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    const paddingLeft = `${depth * 12 + 12}px`;
    const isActive = item.type === 'file' && currentMeeting?.id === item.id;
    const isMeetingItem = item.id.includes('-') && !item.id.startsWith('intro-call');
    const isDisabled = isMeetingActive && isMeetingItem;

    if (isCollapsed) return null;

    return (
      <div key={item.id}>
        <div
          className={`flex items-center px-3 py-2 hover:bg-secondary/20 text-xs group ${
            isActive ? 'bg-secondary/50' : ''
          } ${
            isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          style={{ paddingLeft }}
          onClick={() => {
            if (item.type === 'folder') {
              toggleFolder(item.id);
            } else {
              // Prevent navigation to meeting-details if a meeting is active
              if (isDisabled) {
                return;
              }
              
              setCurrentMeeting({ id: item.id, title: item.title });
              const basePath = item.id.startsWith('intro-call') ? '/' : 
                item.id.includes('-') ? '/meeting-details' : `/notes/${item.id}`;
              router.push(basePath);
            }
          }}
        >
          {item.type === 'folder' ? (
            <>
              {item.id === 'meetings' ? (
                <Calendar className="w-4 h-4 mr-2 text-gray-600" />
              ) : item.id === 'notes' ? (
                <StickyNote className="w-4 h-4 mr-2 text-gray-600" />
              ) : null}
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 mr-1 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-1 text-gray-600" />
              )}
              <span className="text-gray-600">{item.title}</span>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <File className={`w-4 h-4 mr-1 ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`} />
                <span className={isDisabled ? 'text-gray-400' : 'text-gray-700'}>{item.title}</span>
              </div>
              {isMeetingItem && !isDisabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteModalState({ isOpen: true, itemId: item.id });
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive p-1 rounded-md"
                  title="Delete Meeting"
                >
                  <Delete className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        {item.type === 'folder' && isExpanded && item.children && (
          <div>
            {item.children.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed top-0 left-0 h-screen z-40">
      {/* Floating collapse button */}
      {/* Removed as per SageSure UI */}
      
      <div 
        className={`h-screen bg-background border-r flex flex-col transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Header with traffic light spacing */}
        <div className="h-12 flex items-center border-b border-border">
          {/* Traffic light spacing placeholder */}
          <div className="w-20 h-12" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
          
          {/* Removed Meetily Title */}
          <div className="flex-1"></div>
        </div>

        {/* SageSure Logo at the top of the sidebar */}
        <div className="p-4 border-b border-border flex items-center justify-center">
          {isCollapsed ? (
            <Image src="/Website_Logo.jpeg" alt="SageSure Logo" width={40} height={40} objectFit="contain" />
          ) : (
            <Image src="/Website_Logo.jpeg" alt="SageSure Logo" width={150} height={40} objectFit="contain" />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto pt-4">
          {!isCollapsed && (
            <div className="px-3 pb-2">
              <Button
                variant="default"
                className="w-full flex items-center justify-center px-4 py-2 text-sm font-bold bg-white border border-primary text-primary rounded-md shadow-sm hover:bg-primary/10 transition-colors"
                onClick={() => {
                  if (isCollapsed) toggleCollapse();
                  setCurrentMeeting({ id: 'intro-call', title: '+ New Call' });
                  router.push('/');
                }}
              >
                <Home className="w-4 h-4 mr-2" />
                <span>+ New Call</span>
              </Button>
            </div>
          )}
          {renderCollapsedIcons()}
          {sidebarItems.map(item => renderItem(item))}
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-border">
            <Button 
              variant="ghost"
              className="w-full flex items-center px-3 py-2 text-sm text-gray-600 rounded-md hover:bg-secondary/20"
              onClick={() => router.push('/settings')}
            >
              <Settings className="w-4 h-4 mr-3 text-gray-600" />
              <span>Settings</span>
            </Button>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        onConfirm={() => {
          if (deleteModalState.itemId) {
            handleDelete(deleteModalState.itemId);
          }
          setDeleteModalState({ isOpen: false, itemId: null });
        }}
        onCancel={() => setDeleteModalState({ isOpen: false, itemId: null })}
        text="Are you sure you want to delete this meeting? This action cannot be undone."
      />
    </div>
  );
};

export default Sidebar;
