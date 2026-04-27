import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Noto_Sans_Thai, Noto_Sans } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from './_components/ThemeProvider'

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-noto-thai',
  display: 'swap',
})

const notoSans = Noto_Sans({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-noto',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'GDCatalog Quality Control System — ระบบตรวจคุณภาพข้อมูล GDCatalog Smart Plus',
  description: 'ระบบตรวจคุณภาพข้อมูลเปิดภาครัฐ GDCatalog Smart Plus',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning className={`${notoSansThai.variable} ${notoSans.variable}`}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
