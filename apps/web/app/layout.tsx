import type { Metadata } from 'next'
import { Bebas_Neue, Syne, JetBrains_Mono, Instrument_Serif } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { Toaster } from 'sonner'
import { CommandPalette } from '@/components/CommandPalette'
import './globals.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-ui',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RepoMind',
  description: 'AI-powered repository intelligence — AMD Developer Hackathon',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${syne.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster theme="dark" position="bottom-right" />
          <CommandPalette />
        </Providers>
      </body>
    </html>
  )
}
