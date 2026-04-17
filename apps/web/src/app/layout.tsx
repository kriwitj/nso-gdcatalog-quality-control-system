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
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
