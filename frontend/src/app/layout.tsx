import './globals.css'
import { Source_Sans_3 } from 'next/font/google'
import Sidebar from '@/components/Sidebar'
import { SidebarProvider } from '@/components/Sidebar/SidebarProvider'
import MainContent from '@/components/MainContent'
import Image from 'next/image'

const sourceSans3 = Source_Sans_3({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source-sans-3',
})

export { metadata } from './metadata'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${sourceSans3.variable} font-sans`}>
        <SidebarProvider>
          <div className="titlebar h-8 w-full fixed top-0 left-0 bg-transparent z-50" /> {/* Ensure titlebar is on top */}
          <div className="flex h-screen pt-8"> {/* Add top padding to account for titlebar */}
            <Sidebar />
            <div className="flex-1 flex flex-col">
             
              <MainContent>{children}</MainContent>
            </div>
          </div>
        </SidebarProvider>
      </body>
    </html>
  )
}
