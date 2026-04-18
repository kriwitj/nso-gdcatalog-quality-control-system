import {
  scoreToGrade,
  gradeColor,
  timelinessLabel,
  timelinessColor,
  machineReadableLabel,
  machineReadableColor,
  structuredLabel,
  severityLabel,
  severityColor,
  scoreBarColor,
  fmt,
} from '../scoring'

// ── scoreToGrade ─────────────────────────────────────────────────────
describe('scoreToGrade', () => {
  test('returns ? for null', () => expect(scoreToGrade(null)).toBe('?'))
  test('returns A at 90', () => expect(scoreToGrade(90)).toBe('A'))
  test('returns A at 100', () => expect(scoreToGrade(100)).toBe('A'))
  test('returns B at 75', () => expect(scoreToGrade(75)).toBe('B'))
  test('returns B at 89.9', () => expect(scoreToGrade(89.9)).toBe('B'))
  test('returns C at 60', () => expect(scoreToGrade(60)).toBe('C'))
  test('returns C at 74.9', () => expect(scoreToGrade(74.9)).toBe('C'))
  test('returns D at 40', () => expect(scoreToGrade(40)).toBe('D'))
  test('returns D at 59.9', () => expect(scoreToGrade(59.9)).toBe('D'))
  test('returns F at 39.9', () => expect(scoreToGrade(39.9)).toBe('F'))
  test('returns F at 0', () => expect(scoreToGrade(0)).toBe('F'))
  // boundary: exactly at each threshold
  test('boundary 90 is A not B', () => expect(scoreToGrade(90)).toBe('A'))
  test('boundary 75 is B not C', () => expect(scoreToGrade(75)).toBe('B'))
  test('boundary 60 is C not D', () => expect(scoreToGrade(60)).toBe('C'))
  test('boundary 40 is D not F', () => expect(scoreToGrade(40)).toBe('D'))
})

// ── gradeColor ───────────────────────────────────────────────────────
describe('gradeColor', () => {
  test('A returns emerald classes', () =>
    expect(gradeColor('A')).toContain('emerald'))
  test('B returns blue classes', () =>
    expect(gradeColor('B')).toContain('blue'))
  test('C returns amber classes', () =>
    expect(gradeColor('C')).toContain('amber'))
  test('D returns orange classes', () =>
    expect(gradeColor('D')).toContain('orange'))
  test('F returns red classes', () =>
    expect(gradeColor('F')).toContain('red'))
  test('unknown grade returns gray fallback', () =>
    expect(gradeColor('X')).toContain('gray'))
  test('? returns gray classes', () =>
    expect(gradeColor('?')).toContain('gray'))
})

// ── timelinessLabel ──────────────────────────────────────────────────
describe('timelinessLabel', () => {
  test('up_to_date → ทันสมัย', () =>
    expect(timelinessLabel('up_to_date')).toBe('ทันสมัย'))
  test('warning → ใกล้หมดอายุ', () =>
    expect(timelinessLabel('warning')).toBe('ใกล้หมดอายุ'))
  test('outdated → ล้าสมัย', () =>
    expect(timelinessLabel('outdated')).toBe('ล้าสมัย'))
  test('unknown → ไม่ทราบ', () =>
    expect(timelinessLabel('unknown')).toBe('ไม่ทราบ'))
  test('null → ไม่ทราบ', () =>
    expect(timelinessLabel(null)).toBe('ไม่ทราบ'))
  test('garbage string → ไม่ทราบ', () =>
    expect(timelinessLabel('xyz')).toBe('ไม่ทราบ'))
})

// ── timelinessColor ──────────────────────────────────────────────────
describe('timelinessColor', () => {
  test('up_to_date → emerald', () =>
    expect(timelinessColor('up_to_date')).toContain('emerald'))
  test('warning → amber', () =>
    expect(timelinessColor('warning')).toContain('amber'))
  test('outdated → red', () =>
    expect(timelinessColor('outdated')).toContain('red'))
  test('null → gray', () =>
    expect(timelinessColor(null)).toContain('gray'))
})

// ── structuredLabel ───────────────────────────────────────────────────
describe('structuredLabel', () => {
  test('structured → มีโครงสร้าง', () =>
    expect(structuredLabel('structured')).toBe('มีโครงสร้าง'))
  test('semi_structured → กึ่งโครงสร้าง', () =>
    expect(structuredLabel('semi_structured')).toBe('กึ่งโครงสร้าง'))
  test('unstructured → ไม่มีโครงสร้าง', () =>
    expect(structuredLabel('unstructured')).toBe('ไม่มีโครงสร้าง'))
  test('null → ไม่ทราบ', () =>
    expect(structuredLabel(null)).toBe('ไม่ทราบ'))
})

// ── machineReadableLabel ─────────────────────────────────────────────
describe('machineReadableLabel', () => {
  test('fully_machine_readable → อ่านได้ทั้งหมด', () =>
    expect(machineReadableLabel('fully_machine_readable')).toBe('อ่านได้ทั้งหมด'))
  test('partially_machine_readable → อ่านได้บางส่วน', () =>
    expect(machineReadableLabel('partially_machine_readable')).toBe('อ่านได้บางส่วน'))
  test('not_machine_readable → เครื่องอ่านไม่ได้', () =>
    expect(machineReadableLabel('not_machine_readable')).toBe('เครื่องอ่านไม่ได้'))
  test('null → ไม่ทราบ', () =>
    expect(machineReadableLabel(null)).toBe('ไม่ทราบ'))
})

// ── machineReadableColor ─────────────────────────────────────────────
describe('machineReadableColor', () => {
  test('fully_machine_readable → emerald', () =>
    expect(machineReadableColor('fully_machine_readable')).toContain('emerald'))
  test('partially_machine_readable → amber', () =>
    expect(machineReadableColor('partially_machine_readable')).toContain('amber'))
  test('not_machine_readable → red', () =>
    expect(machineReadableColor('not_machine_readable')).toContain('red'))
  test('null → gray', () =>
    expect(machineReadableColor(null)).toContain('gray'))
})

// ── severityLabel ─────────────────────────────────────────────────────
describe('severityLabel', () => {
  test('ok → ผ่าน', () => expect(severityLabel('ok')).toBe('ผ่าน'))
  test('low → ต่ำ', () => expect(severityLabel('low')).toBe('ต่ำ'))
  test('medium → ปานกลาง', () => expect(severityLabel('medium')).toBe('ปานกลาง'))
  test('high → สูง', () => expect(severityLabel('high')).toBe('สูง'))
  test('critical → วิกฤต', () => expect(severityLabel('critical')).toBe('วิกฤต'))
  test('null → -', () => expect(severityLabel(null)).toBe('-'))
  test('unknown string → -', () => expect(severityLabel('unknown')).toBe('-'))
})

// ── severityColor ─────────────────────────────────────────────────────
describe('severityColor', () => {
  test('ok → emerald', () => expect(severityColor('ok')).toContain('emerald'))
  test('low → blue', () => expect(severityColor('low')).toContain('blue'))
  test('medium → amber', () => expect(severityColor('medium')).toContain('amber'))
  test('high → orange', () => expect(severityColor('high')).toContain('orange'))
  test('critical → red', () => expect(severityColor('critical')).toContain('red'))
  test('null → gray', () => expect(severityColor(null)).toContain('gray'))
})

// ── scoreBarColor ─────────────────────────────────────────────────────
describe('scoreBarColor', () => {
  test('null → gray', () => expect(scoreBarColor(null)).toBe('bg-gray-200'))
  test('score 90 → emerald', () => expect(scoreBarColor(90)).toBe('bg-emerald-500'))
  test('score 100 → emerald', () => expect(scoreBarColor(100)).toBe('bg-emerald-500'))
  test('score 75 → blue', () => expect(scoreBarColor(75)).toBe('bg-blue-500'))
  test('score 60 → amber', () => expect(scoreBarColor(60)).toBe('bg-amber-500'))
  test('score 40 → orange', () => expect(scoreBarColor(40)).toBe('bg-orange-500'))
  test('score 39 → red', () => expect(scoreBarColor(39)).toBe('bg-red-500'))
  test('score 0 → red', () => expect(scoreBarColor(0)).toBe('bg-red-500'))
})

// ── fmt ───────────────────────────────────────────────────────────────
describe('fmt', () => {
  test('null → -', () => expect(fmt(null)).toBe('-'))
  test('undefined → -', () => expect(fmt(undefined)).toBe('-'))
  test('75.567 default 1 decimal → 75.6', () => expect(fmt(75.567)).toBe('75.6'))
  test('75.567 with 2 decimals → 75.57', () => expect(fmt(75.567, 2)).toBe('75.57'))
  test('0 → 0.0', () => expect(fmt(0)).toBe('0.0'))
  test('100 → 100.0', () => expect(fmt(100)).toBe('100.0'))
  test('0 decimals → 76', () => expect(fmt(75.6, 0)).toBe('76'))
})
