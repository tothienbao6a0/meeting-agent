'use client';

import React from 'react';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';

interface MainContentProps {
  children: React.ReactNode;
}

const MainContent: React.FC<MainContentProps> = ({ children }) => {
  const { isCollapsed } = useSidebar();
  
  return (
    <main 
      className={`flex-1 transition-all duration-300 bg-background p-6 ${
        isCollapsed ? 'ml-16' : 'ml-56'
      }`}
    >
      {/* Removed pl-8 from here to allow more granular control in children components */}
      <div>
        {children}
      </div>
    </main>
  );
};

export default MainContent;
