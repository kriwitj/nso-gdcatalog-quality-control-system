'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function LandingPage() {
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      try {
        const u = JSON.parse(localStorage.getItem('user') || 'null')
        setUsername(u?.username ?? null)
      } catch { /* ignore */ }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full flex items-center justify-between px-8 py-5 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            GQC
          </div>
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 leading-none">ระบบตรวจคุณภาพ</div>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">GDCatalog Quality Control System</div>
          </div>
        </div>

        {username ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:block">
              ยินดีต้อนรับ <span className="font-semibold text-gray-800 dark:text-gray-100">{username}</span>
            </span>
            <Link href="/dashboard" className="btn-primary text-sm px-5 py-2">
              เข้าสู่ Portal
            </Link>
          </div>
        ) : (
          <Link href="/login" className="btn-primary text-sm px-5 py-2">
            เข้าสู่ระบบ
          </Link>
        )}
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
          ข้อมูลเปิดภาครัฐ — Open Government Data
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight mb-4 max-w-3xl">
          GDCatalog Quality Control System
          <br />
          <span className="text-blue-600 dark:text-blue-400">ระบบตรวจคุณภาพข้อมูล GDCatalog Smart Plus</span>
        </h1>

        <p className="text-gray-500 dark:text-gray-400 text-lg max-w-xl mb-10 leading-relaxed">
          ตรวจสอบและประเมินคุณภาพข้อมูลจาก CKAN Catalog ใน 5 มิติ
          พร้อมรายงานและ Dashboard สำหรับผู้บริหาร
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-16">
          {username ? (
            <Link href="/dashboard" className="btn-primary px-8 py-3 text-base">
              ไปยัง Dashboard
            </Link>
          ) : (
            <Link href="/login" className="btn-primary px-8 py-3 text-base">
              เข้าสู่ Portal
            </Link>
          )}
          <Link href="/dashboard" className="btn-secondary px-8 py-3 text-base">
            ดู Dashboard
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-5xl w-full text-left">
          {FEATURES.map(f => (
            <div key={f.title} className="card p-4">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="text-sm font-semibold text-gray-800 mb-1 dark:text-gray-200">{f.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed dark:text-gray-400">{f.desc}</div>
              <div className="text-xs text-blue-600 font-medium mt-2">{f.weight}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100 dark:border-gray-800">
        GDCatalog Quality Control System — ระบบตรวจคุณภาพข้อมูล GDCatalog Smart Plus
        <br />
        พัฒนาโดย สำนักงานสถิติจังหวัดสระบุรี © 2026
      </footer>
    </div>
  )
}

const FEATURES = [
  { icon: '📋', title: 'Completeness',     weight: '20%', desc: 'ความสมบูรณ์ของ Metadata เช่น ชื่อ, คำอธิบาย, tag, license' },
  { icon: '⏱', title: 'Timeliness',       weight: '20%', desc: 'ความทันสมัยของข้อมูลเทียบกับความถี่ที่ระบุ' },
  { icon: '🔗', title: 'Accessibility',    weight: '15%', desc: 'ดาวน์โหลดได้จริงหรือไม่ และ HTTP status' },
  { icon: '🤖', title: 'Machine Readable', weight: '20%', desc: 'รูปแบบไฟล์ CSV/JSON/XLSX vs PDF/DOC' },
  { icon: '✔',  title: 'Validity',         weight: '25%', desc: 'ความถูกต้องของข้อมูลตาราง (Frictionless)' },
]
