// ─── Grade thresholds ─────────────────────────────────
export function scoreToGrade(score: number | null): string {
  if (score === null || score === undefined) return '?'
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

export function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    A: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    B: 'text-blue-700 bg-blue-50 border-blue-200',
    C: 'text-amber-700 bg-amber-50 border-amber-200',
    D: 'text-orange-700 bg-orange-50 border-orange-200',
    F: 'text-red-700 bg-red-50 border-red-200',
    '?': 'text-gray-500 bg-gray-50 border-gray-200',
  }
  return map[grade] || map['?']
}

// ─── Timeliness labels ────────────────────────────────
export function timelinessLabel(status: string | null): string {
  const map: Record<string, string> = {
    up_to_date: 'ทันสมัย',
    warning: 'ใกล้หมดอายุ',
    outdated: 'ล้าสมัย',
    unknown: 'ไม่ทราบ',
  }
  return map[status || 'unknown'] || 'ไม่ทราบ'
}

export function timelinessColor(status: string | null): string {
  const map: Record<string, string> = {
    up_to_date: 'text-emerald-700 bg-emerald-50',
    warning: 'text-amber-700 bg-amber-50',
    outdated: 'text-red-700 bg-red-50',
    unknown: 'text-gray-500 bg-gray-50',
  }
  return map[status || 'unknown'] || 'text-gray-500 bg-gray-50'
}

// ─── Structured status labels ─────────────────────────
export function structuredLabel(status: string | null): string {
  const map: Record<string, string> = {
    structured: 'มีโครงสร้าง',
    semi_structured: 'กึ่งโครงสร้าง',
    unstructured: 'ไม่มีโครงสร้าง',
    unknown: 'ไม่ทราบ',
  }
  return map[status || 'unknown'] || 'ไม่ทราบ'
}

// ─── Machine readable labels ──────────────────────────
export function machineReadableLabel(status: string | null): string {
  const map: Record<string, string> = {
    fully_machine_readable: 'อ่านได้ทั้งหมด',
    partially_machine_readable: 'อ่านได้บางส่วน',
    not_machine_readable: 'เครื่องอ่านไม่ได้',
    unknown: 'ไม่ทราบ',
  }
  return map[status || 'unknown'] || 'ไม่ทราบ'
}

export function machineReadableColor(status: string | null): string {
  const map: Record<string, string> = {
    fully_machine_readable: 'text-emerald-700 bg-emerald-50',
    partially_machine_readable: 'text-amber-700 bg-amber-50',
    not_machine_readable: 'text-red-700 bg-red-50',
    unknown: 'text-gray-500 bg-gray-50',
  }
  return map[status || 'unknown'] || 'text-gray-500 bg-gray-50'
}

// ─── Severity label ───────────────────────────────────
export function severityLabel(severity: string | null): string {
  const map: Record<string, string> = {
    ok: 'ผ่าน',
    low: 'ต่ำ',
    medium: 'ปานกลาง',
    high: 'สูง',
    critical: 'วิกฤต',
  }
  return map[severity || ''] || '-'
}

export function severityColor(severity: string | null): string {
  const map: Record<string, string> = {
    ok: 'text-emerald-700 bg-emerald-50',
    low: 'text-blue-700 bg-blue-50',
    medium: 'text-amber-700 bg-amber-50',
    high: 'text-orange-700 bg-orange-50',
    critical: 'text-red-700 bg-red-50',
  }
  return map[severity || ''] || 'text-gray-500 bg-gray-50'
}

// ─── Score bar width ──────────────────────────────────
export function scoreBarColor(score: number | null): string {
  if (score === null) return 'bg-gray-200'
  if (score >= 90) return 'bg-emerald-500'
  if (score >= 75) return 'bg-blue-500'
  if (score >= 60) return 'bg-amber-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

// ─── Format score for display ─────────────────────────
export function fmt(score: number | null | undefined, decimals = 1): string {
  if (score === null || score === undefined) return '-'
  return score.toFixed(decimals)
}
