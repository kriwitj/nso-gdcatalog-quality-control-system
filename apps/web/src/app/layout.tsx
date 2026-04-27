import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { ThemeProvider } from './_components/ThemeProvider'

export const metadata: Metadata = {
  title: 'GDCatalog Quality Control System — ระบบตรวจคุณภาพข้อมูล GDCatalog Smart Plus',
  description: 'ระบบตรวจคุณภาพข้อมูลเปิดภาครัฐ GDCatalog Smart Plus',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
