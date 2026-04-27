'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/* ── Types ── */
interface OrgStat { id: string; name: string; count: number }
interface DatasetStat {
  id: string; title: string | null; overallScore: number | null
  qualityGrade: string | null; lastScanAt?: string | null
  organization: { name: string; title: string | null } | null
  ckanSource?: {
    division?: { name: string; department?: { name: string; ministry?: { name: string } | null } | null } | null
    department?: { name: string; ministry?: { name: string } | null } | null
    ministry?: { name: string } | null
  } | null
}
interface PublicStats {
  totalDatasets: number; totalResources: number; avgScore: number | null
  topOrgs: OrgStat[]; topScannedOrgs: OrgStat[]
  topByScore: DatasetStat[]; recentlyScanned: DatasetStat[]
}

/* ── Helpers ── */
function fmt(v: number | null | undefined, d = 1) { return v == null ? '—' : v.toFixed(d) }
function getOrgHierarchy(ds: DatasetStat) {
  const src = ds.ckanSource
  if (!src) return ds.organization?.title || ds.organization?.name || '-'
  const div  = src.division?.name || null
  const dept = src.division?.department?.name || src.department?.name || null
  const min  = src.division?.department?.ministry?.name || src.department?.ministry?.name || src.ministry?.name || null
  return [div, dept, min].filter(Boolean).join(' · ') || ds.organization?.title || ds.organization?.name || '-'
}

/* ── Constants ── */
const STEPS = [
  {
    n: 1, title: 'Collector', sub: 'ดึงข้อมูลจาก CKAN API',
    color: '#3B82F6', gradient: 'linear-gradient(135deg,#3B82F6,#60A5FA)',
    glow: 'rgba(59,130,246,0.22)',
    desc: 'ซิงค์ชุดข้อมูลและ metadata ทั้งหมดจาก gdcatalog.go.th\nเก็บลง PostgreSQL พร้อม snapshot อัตโนมัติ',
  },
  {
    n: 2, title: 'Analyzer', sub: 'Python Workers ตรวจสอบ',
    color: '#8B5CF6', gradient: 'linear-gradient(135deg,#8B5CF6,#A78BFA)',
    glow: 'rgba(139,92,246,0.22)',
    desc: 'HTTP check, format detection, Frictionless validation\nทำงานแบบ queue ผ่าน Redis Worker แบบ concurrent',
  },
  {
    n: 3, title: 'Dashboard', sub: 'แสดงผลแบบ real-time',
    color: '#10B981', gradient: 'linear-gradient(135deg,#10B981,#34D399)',
    glow: 'rgba(16,185,129,0.22)',
    desc: 'Next.js dashboard แสดงคะแนน เกรด trend และ export\nCSV/XLSX สำหรับผู้บริหารและเจ้าหน้าที่',
  },
]

/* ─────────────────────────────────────────── */
export default function LandingPage() {
  const [username, setUsername] = useState<string | null>(null)
  const [stats, setStats]       = useState<PublicStats | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem('user') || 'null'); setUsername(u?.username ?? null) } catch { /**/ }
    fetch('/api/public-stats').then(r => r.ok ? r.json() : null).then(d => setStats(d)).catch(() => null)
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* animated counter */
  useEffect(() => {
    if (!stats) return
    const els = heroRef.current?.querySelectorAll<HTMLElement>('[data-count]')
    els?.forEach(el => {
      const target = parseFloat(el.dataset.count!)
      const decimal = el.dataset.decimal === '1'
      const dur = 1600; const start = Date.now()
      const tick = () => {
        const t = Math.min((Date.now() - start) / dur, 1)
        const ease = 1 - Math.pow(1 - t, 3)
        el.textContent = decimal ? (target * ease).toFixed(1) : Math.floor(target * ease).toLocaleString()
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }, [stats])

  /* scroll-reveal */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible')
      }),
      { threshold: 0.12, rootMargin: '-30px' }
    )
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [stats])

  return (
    <div style={{ color:'#111827', overflowX:'hidden' }}>

      {/* ════════════════════════ NAV ════════════════════════ */}
      <nav style={{
        position:'fixed', top:0, left:0, right:0, zIndex:100, height:60,
        background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.92)',
        backdropFilter:'blur(16px)',
        borderBottom: scrolled ? '1px solid #E5E7EB' : '1px solid rgba(229,231,235,0.6)',
        boxShadow: scrolled ? '0 2px 16px rgba(0,0,0,0.07)' : 'none',
        display:'flex', alignItems:'center', gap:8, padding:'0 40px',
        transition:'all .25s ease',
      }}>
        <a href="#" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', marginRight:8 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#0F2349,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
            </svg>
          </div>
          <div style={{ display:'flex', flexDirection:'column', lineHeight:1.15 }}>
            <strong style={{ fontSize:13.5, fontWeight:800, color:'#0F2349' }}>GDCatalog QC</strong>
            <span style={{ fontSize:10, color:'#9CA3AF' }}>ระบบตรวจคุณภาพข้อมูลภาครัฐ</span>
          </div>
        </a>

        <div style={{ display:'flex', gap:2, marginLeft:16 }}>
          {[['#features','คุณภาพข้อมูล'],['#how','การทำงาน'],['#stats','สถิติ'],['#api','API']].map(([href,label])=>(
            <a key={href} href={href} style={{ padding:'6px 13px', borderRadius:8, fontSize:13, fontWeight:500, color:'#6B7280', textDecoration:'none', transition:'all .15s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background='#F3F4F6';(e.currentTarget as HTMLAnchorElement).style.color='#111827'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background='transparent';(e.currentTarget as HTMLAnchorElement).style.color='#6B7280'}}>
              {label}
            </a>
          ))}
        </div>

        <div style={{ flex:1 }} />

        {username
          ? <Link href="/dashboard" style={{ padding:'8px 20px', borderRadius:9, background:'#0F2349', color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none', transition:'all .2s', boxShadow:'0 2px 8px rgba(15,35,73,0.25)' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background='#1B3A6B'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background='#0F2349'}}>
              เข้าสู่ Portal →
            </Link>
          : <Link href="/login" style={{ padding:'8px 20px', borderRadius:9, background:'#0F2349', color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none', transition:'all .2s', boxShadow:'0 2px 8px rgba(15,35,73,0.25)' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background='#1B3A6B'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background='#0F2349'}}>
              เข้าสู่ระบบ →
            </Link>
        }
      </nav>

      {/* ════════════════════════ HERO ════════════════════════ */}
      <section ref={heroRef} style={{
        minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        padding:'120px 40px 80px', textAlign:'center', position:'relative', overflow:'hidden',
        background:'linear-gradient(155deg,#0a1628 0%,#0F2349 35%,#1B3A6B 65%,#0d2b5a 100%)',
      }}>
        {/* Grid bg */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(59,130,246,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.05) 1px,transparent 1px)', backgroundSize:'60px 60px' }}/>
        {/* Glow orbs */}
        <div style={{ position:'absolute', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,0.13) 0%,transparent 65%)', top:-200, right:-150, pointerEvents:'none', animation:'floatOrb 8s ease-in-out infinite' }}/>
        <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.1) 0%,transparent 65%)', bottom:-100, left:-100, pointerEvents:'none', animation:'floatOrb 10s ease-in-out infinite reverse' }}/>
        <div style={{ position:'absolute', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(16,185,129,0.07) 0%,transparent 65%)', top:'40%', left:'20%', pointerEvents:'none', animation:'floatOrb 12s ease-in-out infinite' }}/>

        <div style={{ position:'relative', maxWidth:780, width:'100%' }}>
          {/* Badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 18px', borderRadius:100, border:'1px solid rgba(59,130,246,0.35)', background:'rgba(59,130,246,0.12)', color:'#93C5FD', fontSize:12, fontWeight:600, marginBottom:28, letterSpacing:'0.03em', animation:'fadeSlideDown 0.8s ease both' }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#60A5FA', animation:'pulse 2s infinite', flexShrink:0 }}/>
            ระบบ Collector → Analyzer → Dashboard
          </div>

          {/* Headline */}
          <h1 style={{ fontSize:'clamp(36px,5.5vw,64px)', fontWeight:900, color:'#fff', lineHeight:1.12, letterSpacing:'-0.03em', margin:'0 0 16px', animation:'fadeSlideUp 0.9s ease 0.1s both' }}>
            ตรวจสอบคุณภาพข้อมูล<br/>
            <span style={{ background:'linear-gradient(135deg,#60A5FA 0%,#A78BFA 50%,#34D399 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              เปิดภาครัฐ
            </span>{' '}อัตโนมัติ
          </h1>

          {/* Sub */}
          <p style={{ fontSize:'clamp(14px,2vw,18px)', color:'rgba(255,255,255,0.62)', lineHeight:1.75, marginBottom:44, maxWidth:560, marginLeft:'auto', marginRight:'auto', animation:'fadeSlideUp 0.9s ease 0.2s both' }}>
            Government Data Quality Control สำหรับ{' '}
            <strong style={{ color:'rgba(255,255,255,0.88)' }}>gdcatalog.go.th</strong>
            <br/>วิเคราะห์ 5 มิติคุณภาพ · ตรวจสอบอัตโนมัติ · รองรับทุกหน่วยงาน
          </p>

          {/* CTA buttons */}
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:64, animation:'fadeSlideUp 0.9s ease 0.3s both' }}>
            <Link href={username ? '/dashboard' : '/login'} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'14px 32px', borderRadius:12, background:'#3B82F6', color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none', boxShadow:'0 8px 24px rgba(59,130,246,0.4)', transition:'all .2s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.transform='translateY(-2px)';(e.currentTarget as HTMLAnchorElement).style.boxShadow='0 12px 32px rgba(59,130,246,0.5)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.transform='none';(e.currentTarget as HTMLAnchorElement).style.boxShadow='0 8px 24px rgba(59,130,246,0.4)'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
              {username ? 'ไปยัง Dashboard' : 'เข้าสู่ระบบ'}
            </Link>
            <a href="#features" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'14px 32px', borderRadius:12, background:'rgba(255,255,255,0.08)', color:'#fff', fontSize:14, fontWeight:600, textDecoration:'none', border:'1px solid rgba(255,255,255,0.2)', transition:'all .2s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background='rgba(255,255,255,0.14)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background='rgba(255,255,255,0.08)'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              ดูสถิติสาธารณะ
            </a>
          </div>

          {/* Stats grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderRadius:20, overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', backdropFilter:'blur(12px)', gap:'1px', animation:'fadeSlideUp 0.9s ease 0.4s both' }}>
            {[
              { label:'Total Datasets', sub:'ชุดข้อมูล',    val: stats?.totalDatasets,  decimal:false },
              { label:'Resources',      sub:'ทรัพยากร',     val: stats?.totalResources, decimal:false },
              { label:'Avg. Score',     sub:'คะแนนเฉลี่ย', val: stats?.avgScore,        decimal:true  },
              { label:'Organizations',  sub:'หน่วยงาน',     val: stats?.topOrgs?.length || null, decimal:false },
            ].map((s,i)=>(
              <div key={i} style={{ padding:'22px 16px', textAlign:'center', background:'rgba(255,255,255,0.04)' }}>
                <div
                  style={{ fontSize:'clamp(24px,3.5vw,38px)', fontWeight:900, color:'#fff', lineHeight:1, letterSpacing:'-0.03em' }}
                  data-count={s.val ?? undefined}
                  data-decimal={s.decimal ? '1' : undefined}
                >
                  {s.val == null ? '—' : s.decimal ? fmt(s.val as number) : (s.val as number).toLocaleString()}
                </div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginTop:6, letterSpacing:'0.07em', textTransform:'uppercase' }}>{s.label}</div>
                <div style={{ fontSize:11, color:'#60A5FA', marginTop:2, fontWeight:600 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position:'absolute', bottom:32, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:4, color:'rgba(255,255,255,0.3)', fontSize:11, animation:'fadeSlideUp 1s ease 1s both' }}>
          <span>เลื่อนดูเพิ่มเติม</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ animation:'bounce 2s infinite' }}><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </section>

      {/* ════════════════════════ FEATURES (BENTO) ════════════════════════ */}
      <section id="features" style={{ padding:'100px 40px', background:'#F8FAFC' }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div className="reveal" style={{ textAlign:'center', marginBottom:56 }}>
            <span style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#3B82F6', background:'#EFF6FF', borderRadius:100, padding:'4px 16px', marginBottom:14 }}>
              5 มิติคุณภาพข้อมูล
            </span>
            <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, color:'#0F2349', letterSpacing:'-0.03em', margin:'0 0 10px' }}>
              วัดคุณภาพอย่างรอบด้าน
            </h2>
            <p style={{ fontSize:15, color:'#6B7280', maxWidth:480, margin:'0 auto', lineHeight:1.7 }}>
              แต่ละมิติมีน้ำหนักต่างกัน รวม 100 คะแนน ตรวจสอบโดยอัตโนมัติทุกรอบ
            </p>
          </div>

          {/* Bento grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:16 }}>
            {/* Large card — Validity (most weight) */}
            <div className="reveal" data-d="1" style={{ gridColumn:'span 5', background:'#fff', borderRadius:20, padding:32, border:'1px solid #E5E7EB', boxShadow:'0 1px 4px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column', justifyContent:'space-between', minHeight:240, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'#EF4444', borderRadius:'20px 20px 0 0' }}/>
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                  <div style={{ width:48, height:48, borderRadius:14, background:'#FEF2F2', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:100, background:'#FEF2F2', color:'#EF4444' }}>25%</span>
                </div>
                <h3 style={{ fontSize:18, fontWeight:800, color:'#0F2349', margin:'0 0 6px' }}>Validity</h3>
                <p style={{ fontSize:12, color:'#6B7280', lineHeight:1.65, margin:0 }}>ความถูกต้องของข้อมูล · Frictionless validation ตรวจ schema, type, constraint ทุก resource</p>
              </div>
              <div style={{ marginTop:20 }}>
                <div style={{ height:6, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:'61%', background:'linear-gradient(90deg,#EF4444,#F97316)', borderRadius:3 }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                  <span style={{ fontSize:11, color:'#9CA3AF' }}>คะแนนเฉลี่ย</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'#EF4444' }}>61.2</span>
                </div>
              </div>
            </div>

            {/* Medium — Completeness */}
            <div className="reveal" data-d="2" style={{ gridColumn:'span 4', background:'#fff', borderRadius:20, padding:28, border:'1px solid #E5E7EB', boxShadow:'0 1px 4px rgba(0,0,0,0.05)', position:'relative', overflow:'hidden', minHeight:200 }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'#3B82F6', borderRadius:'20px 20px 0 0' }}/>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <div style={{ width:42, height:42, borderRadius:12, background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                </div>
                <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:100, background:'#EFF6FF', color:'#3B82F6' }}>20%</span>
              </div>
              <h3 style={{ fontSize:16, fontWeight:800, color:'#0F2349', margin:'0 0 6px' }}>Completeness</h3>
              <p style={{ fontSize:12, color:'#6B7280', lineHeight:1.65, margin:'0 0 16px' }}>ชื่อ คำอธิบาย แท็ก ใบอนุญาต และความถี่การอัปเดต</p>
              <ScoreBar pct={72} color="#3B82F6" />
            </div>

            {/* Small — Timeliness */}
            <div className="reveal" data-d="3" style={{ gridColumn:'span 3', background:'linear-gradient(135deg,#1B3A6B,#0F2349)', borderRadius:20, padding:28, border:'none', boxShadow:'0 4px 20px rgba(15,35,73,0.3)', position:'relative', overflow:'hidden', minHeight:200, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div>
                <div style={{ width:42, height:42, borderRadius:12, background:'rgba(139,92,246,0.2)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <h3 style={{ fontSize:16, fontWeight:800, color:'#fff', margin:'0 0 6px' }}>Timeliness</h3>
                <p style={{ fontSize:11.5, color:'rgba(255,255,255,0.55)', lineHeight:1.65, margin:0 }}>ความทันสมัยเทียบกับความถี่ที่กำหนด</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:16 }}>
                <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.08em' }}>น้ำหนัก</span>
                <span style={{ fontSize:22, fontWeight:900, color:'#A78BFA' }}>20%</span>
              </div>
            </div>

            {/* Small — Accessibility */}
            <div className="reveal" data-d="2" style={{ gridColumn:'span 3', background:'#fff', borderRadius:20, padding:28, border:'1px solid #E5E7EB', boxShadow:'0 1px 4px rgba(0,0,0,0.05)', position:'relative', overflow:'hidden', minHeight:180 }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'#10B981', borderRadius:'20px 20px 0 0' }}/>
              <div style={{ width:42, height:42, borderRadius:12, background:'#ECFDF5', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              </div>
              <h3 style={{ fontSize:15, fontWeight:800, color:'#0F2349', margin:'0 0 4px' }}>Accessibility</h3>
              <p style={{ fontSize:11.5, color:'#6B7280', lineHeight:1.65, margin:'0 0 12px' }}>ดาวน์โหลดได้จริง ผ่าน HTTP</p>
              <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:100, background:'#ECFDF5', color:'#10B981' }}>15% น้ำหนัก</span>
            </div>

            {/* Small — Machine Readable */}
            <div className="reveal" data-d="3" style={{ gridColumn:'span 4', background:'#FFFBEB', borderRadius:20, padding:28, border:'1px solid #FDE68A', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', position:'relative', overflow:'hidden', minHeight:180 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <div style={{ width:42, height:42, borderRadius:12, background:'rgba(245,158,11,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4"/></svg>
                </div>
                <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:100, background:'rgba(245,158,11,0.15)', color:'#D97706' }}>20%</span>
              </div>
              <h3 style={{ fontSize:15, fontWeight:800, color:'#92400E', margin:'0 0 4px' }}>Machine Readable</h3>
              <p style={{ fontSize:11.5, color:'#78350F', lineHeight:1.65, margin:'0 0 14px' }}>CSV / XLSX / JSON vs PDF / DOC</p>
              <ScoreBar pct={64} color="#F59E0B" />
            </div>

            {/* Grade scale card */}
            <div className="reveal" data-d="4" style={{ gridColumn:'span 5', background:'linear-gradient(135deg,#3B82F6,#8B5CF6)', borderRadius:20, padding:28, boxShadow:'0 8px 32px rgba(59,130,246,0.25)', minHeight:180 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)', letterSpacing:'0.08em', textTransform:'uppercase', margin:'0 0 16px' }}>เกณฑ์คะแนน</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
                {[{g:'A',r:'90+',c:'#D1FAE5',tc:'#065F46'},{g:'B',r:'75+',c:'#DBEAFE',tc:'#1E40AF'},{g:'C',r:'60+',c:'#FEF9C3',tc:'#78350F'},{g:'D',r:'40+',c:'#FFEDD5',tc:'#9A3412'},{g:'F',r:'0+',c:'#FEE2E2',tc:'#991B1B'}].map(({g,r,c,tc})=>(
                  <div key={g} style={{ background:c, borderRadius:10, padding:'10px 4px', textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:900, color:tc }}>{g}</div>
                    <div style={{ fontSize:9, color:tc, opacity:0.75, marginTop:1 }}>{r}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:11, color:'rgba(255,255,255,0.55)', margin:'14px 0 0', textAlign:'center' }}>คะแนนเต็ม 100 คะแนน รวม 5 มิติ</p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════ HOW IT WORKS ════════════════════════ */}
      <section id="how" style={{ padding:'100px 40px', background:'#EEF2FF' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>

          {/* Section header */}
          <div className="reveal" style={{ textAlign:'center', marginBottom:72 }}>
            <div style={{ fontSize:12, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'#6366F1', marginBottom:16 }}>
              HOW IT WORKS · วิธีการทำงาน
            </div>
            <h2 style={{ fontSize:'clamp(32px,5vw,52px)', fontWeight:900, color:'#0F2349', letterSpacing:'-0.03em', margin:'0 0 14px', lineHeight:1.15 }}>
              ระบบ 3 ชั้น อัตโนมัติ
            </h2>
            <p style={{ fontSize:15, color:'#6B7280', maxWidth:520, margin:'0 auto', lineHeight:1.75 }}>
              Collector → Analyzer → Dashboard ทำงานต่อเนื่องโดยไม่ต้องแทรกแซง
            </p>
          </div>

          {/* Steps — circles + connector */}
          <div style={{ position:'relative', marginBottom:52 }}>
            {/* Horizontal connector line through circle centers */}
            <div style={{
              position:'absolute', top:45, left:'16.67%', right:'16.67%',
              height:2,
              background:'linear-gradient(90deg,#3B82F6,#8B5CF6,#10B981)',
              borderRadius:1, zIndex:0,
            }}/>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:32 }}>
              {STEPS.map((s, i) => (
                <div
                  key={i}
                  className="reveal"
                  data-d={String(i + 1) as '1' | '2' | '3'}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', position:'relative', zIndex:1 }}
                >
                  {/* Circle with gradient border */}
                  <div style={{
                    width:90, height:90, borderRadius:'50%', flexShrink:0,
                    background:`linear-gradient(white,white) padding-box, ${s.gradient} border-box`,
                    border:'3px solid transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    marginBottom:28, position:'relative',
                    boxShadow:`0 8px 32px ${s.glow}, 0 0 0 8px ${s.glow}`,
                    transition:'transform .25s ease, box-shadow .25s ease',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.08)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 14px 40px ${s.glow}, 0 0 0 10px ${s.glow}` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${s.glow}, 0 0 0 8px ${s.glow}` }}
                  >
                    <span style={{
                      fontSize:32, fontWeight:900, lineHeight:1,
                      background:s.gradient, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                    }}>{s.n}</span>
                  </div>

                  <h3 style={{ fontSize:18, fontWeight:800, color:'#0F2349', margin:'0 0 6px', textAlign:'center' }}>{s.title}</h3>
                  <p style={{ fontSize:12, fontWeight:600, color:s.color, textAlign:'center', margin:'0 0 14px', letterSpacing:'0.01em' }}>{s.sub}</p>
                  <p style={{ fontSize:13, color:'#6B7280', lineHeight:1.8, textAlign:'center', margin:0, maxWidth:220, whiteSpace:'pre-line' }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tech Stack */}
          <div className="reveal" style={{ background:'#fff', borderRadius:16, border:'1px solid #E2E8F0', padding:'20px 32px', display:'flex', flexWrap:'wrap', gap:0, alignItems:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#9CA3AF', marginRight:20, flexShrink:0 }}>Tech Stack:</span>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 24px', flex:1 }}>
              {[
                ['Next.js 15','#3B82F6'],['PostgreSQL 16','#336791'],['Redis 7','#DC2626'],
                ['Python 3.11','#F59E0B'],['Frictionless','#10B981'],['Prisma 7','#8B5CF6'],
                ['Docker','#2496ED'],['Nginx','#009639'],
              ].map(([n,c])=>(
                <div key={n} style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, fontWeight:500, color:'#374151', padding:'4px 0' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:c, flexShrink:0 }}/>
                  {n}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════ STATS / SOCIAL PROOF ════════════════════════ */}
      <section id="stats" style={{ padding:'100px 40px', background:'#F8FAFC' }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div className="reveal" style={{ textAlign:'center', marginBottom:56 }}>
            <span style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#10B981', background:'#ECFDF5', borderRadius:100, padding:'4px 16px', marginBottom:14 }}>
              ข้อมูลจริงจากระบบ
            </span>
            <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, color:'#0F2349', letterSpacing:'-0.03em', margin:'0 0 10px' }}>
              ตัวเลขจากการใช้งานจริง
            </h2>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:32 }}>
            {[
              { val: stats ? stats.totalDatasets.toLocaleString() : '—', label:'ชุดข้อมูลที่ตรวจสอบ', color:'#3B82F6', icon:'M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7' },
              { val: stats ? stats.totalResources.toLocaleString() : '—', label:'ทรัพยากรข้อมูล', color:'#8B5CF6', icon:'M9 12h6M9 16h4M9 8h1' },
              { val: fmt(stats?.avgScore), label:'คะแนนเฉลี่ยรวม', color:'#10B981', icon:'M9 12l2 2 4-4' },
              { val: stats ? `${stats.topOrgs?.length ?? 0}+` : '—', label:'หน่วยงานที่เชื่อมต่อ', color:'#F59E0B', icon:'M3 21h18M6 21V7l6-4 6 4v14' },
            ].map((s,i)=>(
              <div
                key={i}
                className="reveal"
                data-d={String(i + 1) as '1' | '2' | '3' | '4'}
                style={{ background:'#fff', borderRadius:18, padding:'28px 24px', border:'1px solid #E5E7EB', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', textAlign:'center', transition:'all .2s' }}
                onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.transform='translateY(-4px)';(e.currentTarget as HTMLDivElement).style.boxShadow='0 12px 32px rgba(0,0,0,0.1)'}}
                onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.transform='none';(e.currentTarget as HTMLDivElement).style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'}}>
                <div style={{ width:48, height:48, borderRadius:14, background:`${s.color}15`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d={s.icon}/>
                  </svg>
                </div>
                <div style={{ fontSize:32, fontWeight:900, color:'#0F2349', letterSpacing:'-0.03em', lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:12, color:'#9CA3AF', marginTop:6 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Top datasets table */}
          {stats && stats.topByScore.length > 0 && (
            <div className="reveal" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <TableCard title="🏆 คะแนนสูงสุด 5 อันดับ" rows={stats.topByScore} />
              <TableCard title="🔍 ตรวจสอบล่าสุด 5 อันดับ" rows={stats.recentlyScanned} showTime />
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════ CTA DARK ════════════════════════ */}
      <section id="api" style={{ padding:'100px 40px', background:'linear-gradient(135deg,#0F2349 0%,#1B3A6B 50%,#0d2b5a 100%)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'linear-gradient(rgba(59,130,246,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.05) 1px,transparent 1px)', backgroundSize:'48px 48px' }}/>
        <div style={{ maxWidth:1140, margin:'0 auto', position:'relative', display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center' }}>
          <div className="reveal">
            <span style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#93C5FD', background:'rgba(59,130,246,0.15)', borderRadius:100, padding:'4px 16px', marginBottom:20 }}>
              API & Export
            </span>
            <h2 style={{ fontSize:'clamp(26px,4vw,40px)', fontWeight:900, color:'#fff', letterSpacing:'-0.03em', margin:'0 0 16px', lineHeight:1.2 }}>
              เชื่อมต่อและดาวน์โหลด<br/>ข้อมูลคุณภาพ
            </h2>
            <p style={{ fontSize:14, color:'rgba(255,255,255,0.6)', lineHeight:1.8, margin:'0 0 32px' }}>
              REST API พร้อม Bearer token · Export CSV และ XLSX ทุกหน้า<br/>ไม่จำกัด pagination · รองรับ filter ทุกรูปแบบ
            </p>
            <Link href={username ? '/dashboard' : '/login'} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 28px', borderRadius:11, background:'#3B82F6', color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none', boxShadow:'0 6px 20px rgba(59,130,246,0.4)', transition:'all .2s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background='#2563EB'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background='#3B82F6'}}>
              {username ? 'เข้าสู่ Dashboard' : 'เริ่มต้นใช้งาน'} →
            </Link>
          </div>

          <div className="reveal" data-d="2" style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { method:'GET',  path:'/api/datasets',        desc:'รายการชุดข้อมูล · filter, search, paginate',        badge:'#22C55E' },
              { method:'GET',  path:'/api/datasets/export', desc:'Export ทั้งหมด · CSV & XLSX (2 sheets)',            badge:'#F59E0B' },
              { method:'GET',  path:'/api/stats',           desc:'Dashboard overview · grade distribution',            badge:'#3B82F6' },
              { method:'POST', path:'/api/scan',            desc:'เริ่ม quality scan · single or full',               badge:'#8B5CF6' },
            ].map(api=>(
              <div key={api.path} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderRadius:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', transition:'all .15s', cursor:'default' }}
                onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.09)';(e.currentTarget as HTMLDivElement).style.transform='translateX(4px)'}}
                onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.05)';(e.currentTarget as HTMLDivElement).style.transform='none'}}>
                <span style={{ fontSize:10, fontWeight:800, padding:'3px 7px', borderRadius:6, background:`${api.badge}22`, color:api.badge, flexShrink:0, minWidth:36, textAlign:'center' }}>{api.method}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#fff', fontFamily:'monospace' }}>{api.path}</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:1 }}>{api.desc}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════ FOOTER ════════════════════════ */}
      <footer style={{ background:'#0a1628', padding:'56px 40px 28px', color:'rgba(255,255,255,0.5)' }}>
        <div style={{ maxWidth:1140, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:48, marginBottom:48 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:'linear-gradient(135deg,#1B3A6B,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
                </div>
                <span style={{ fontSize:14, fontWeight:800, color:'#fff' }}>GDCatalog Quality Control</span>
              </div>
              <p style={{ fontSize:12, lineHeight:1.8, maxWidth:260, margin:0 }}>
                ระบบตรวจสอบคุณภาพข้อมูลเปิดภาครัฐ 3 ขั้นตอน พัฒนาโดยสำนักงานสถิติจังหวัดสระบุรี
              </p>
            </div>
            {[
              { title:'ระบบ', links:[['#features','คุณภาพข้อมูล'],['#how','การทำงาน'],['#stats','สถิติ'],['#api','API Docs']] },
              { title:'หน่วยงาน', links:[['https://gdcatalog.go.th','gdcatalog.go.th'],['https://data.go.th','data.go.th'],['https://www.nso.go.th','สำนักงานสถิติแห่งชาติ']] },
              { title:'ช่วยเหลือ', links:[['#','คู่มือการใช้งาน'],['#','ติดต่อทีมงาน'],['#','นโยบายความเป็นส่วนตัว']] },
            ].map(col=>(
              <div key={col.title}>
                <div style={{ fontSize:10, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.75)', marginBottom:14 }}>{col.title}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                  {col.links.map(([href,label])=>(
                    <a key={label} href={href} style={{ fontSize:12, color:'rgba(255,255,255,0.45)', textDecoration:'none', transition:'color .15s' }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.color='#fff'}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.color='rgba(255,255,255,0.45)'}}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <span style={{ fontSize:11 }}>© 2569 สำนักงานสถิติจังหวัดสระบุรี · GDCatalog Quality Control System</span>
            <div style={{ display:'flex', gap:8 }}>
              {['Next.js 15','Open Source','v1.0.0'].map(b=>(
                <span key={b} style={{ fontSize:10, padding:'3px 9px', borderRadius:5, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.35)' }}>{b}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse      { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes bounce     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
        @keyframes floatOrb   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-30px)} }
        @keyframes fadeSlideDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeSlideUp   { from{opacity:0;transform:translateY(28px)}  to{opacity:1;transform:translateY(0)} }
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  )
}

/* ── Mini components ── */
function ScoreBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div>
      <div style={{ height:5, background:'#F3F4F6', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3 }}/>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
        <span style={{ fontSize:10, color:'#9CA3AF' }}>คะแนนเฉลี่ย</span>
        <span style={{ fontSize:10, fontWeight:700, color }}>{pct}</span>
      </div>
    </div>
  )
}

function TableCard({ title, rows, showTime }: { title: string; rows: DatasetStat[]; showTime?: boolean }) {
  const GRADE_CLS2: Record<string,string> = {
    A:'bg-emerald-100 text-emerald-700 border-emerald-200',
    B:'bg-blue-100 text-blue-700 border-blue-200',
    C:'bg-amber-100 text-amber-700 border-amber-200',
    D:'bg-orange-100 text-orange-700 border-orange-200',
    F:'bg-red-100 text-red-700 border-red-200',
    '?':'bg-gray-100 text-gray-400 border-gray-200',
  }
  return (
    <div style={{ background:'#fff', borderRadius:18, border:'1px solid #E5E7EB', padding:24, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
      <h3 style={{ fontSize:13, fontWeight:700, color:'#0F2349', marginBottom:16 }}>{title}</h3>
      <div>
        {rows.map((d, i) => {
          const grade = d.qualityGrade || '?'
          return (
            <div key={d.id} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 0', borderBottom: i < rows.length-1 ? '1px solid #F9FAFB' : 'none' }}>
              <span style={{ fontSize:13, fontWeight:900, color:'#E5E7EB', width:20, textAlign:'center', flexShrink:0, marginTop:1 }}>{i+1}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.title || '-'}</div>
                <div style={{ fontSize:11, color:'#9CA3AF', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>{getOrgHierarchy(d)}</div>
                {showTime && d.lastScanAt && (
                  <div style={{ fontSize:10, color:'#D1D5DB', marginTop:1 }}>
                    {new Date(d.lastScanAt).toLocaleString('th-TH', { dateStyle:'short', timeStyle:'short' })}
                  </div>
                )}
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, flexShrink:0 }}>
                <span className={`text-xs font-bold border px-1.5 py-0.5 rounded ${GRADE_CLS2[grade] || GRADE_CLS2['?']}`}>{grade}</span>
                <span style={{ fontSize:11, color:'#9CA3AF' }}>{fmt(d.overallScore)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
