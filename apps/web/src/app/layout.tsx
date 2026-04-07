import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GDCatalog Quality Control System — ระบบตรวจคุณภาพข้อมูล GDCatalog Smart Plus',
  description: 'ระบบตรวจคุณภาพข้อมูลเปิดภาครัฐ GDCatalog Smart Plus',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
