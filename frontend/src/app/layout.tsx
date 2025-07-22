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
          <div className="titlebar h-8 w-full fixed top-0 left-0 bg-transparent" />
          <div className="flex h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
              <header className="flex items-center px-6 py-4 border-b border-border">
                <div className="relative w-[150px] h-[40px]"> {/* Adjusted dimensions for testing */}
                  <Image src="/Website_Logo.jpeg" alt="SageSure Company Logo" fill={true} objectFit="contain" />
                </div>
                <h1 className="text-2xl font-bold ml-4 text-foreground">AI Meeting Transcription and Note Taker</h1>
              </header>
              <MainContent>{children}</MainContent>
            </div>
          </div>
        </SidebarProvider>
      </body>
    </html>
  )
}
