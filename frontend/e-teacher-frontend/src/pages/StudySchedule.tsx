import { Typography, Paper, Box, TextField, Button, Stack, Grid, Alert, Chip, MenuItem, Select, InputLabel, FormControl } from '@mui/material'
import { useMemo, useState } from 'react'
import api from '../lib/api'

function StudySchedule() {
  // course list managed below the calendar via Ders Ekle
  const [courseInput, setCourseInput] = useState('')
  const [courseHours, setCourseHours] = useState<number>(1)
  const [courseList, setCourseList] = useState<string[]>([])
  const [schedule, setSchedule] = useState<{ day: string, items: string[] }[]>([])
  const [error, setError] = useState<string | null>(null)
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => 8 + i), []) // 08-19 (12 slot)
  const days = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']
  const [cells, setCells] = useState<Record<string, 'red'|'yellow'|'green'>>({})
  const [dayState, setDayState] = useState<Record<string, 'red'|'yellow'|'green' | undefined>>({})
  const [avg, setAvg] = useState<number | null>(null)
  const [hsSubjects] = useState<string[]>(['Matematik','Fizik','Kimya','Biyoloji','Türkçe','Edebiyat','Tarih','Coğrafya','Felsefe','Din Kültürü','Yabancı Dil'])
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, number>>({})
  // available days derived from grid/day header colors

  async function handleGenerate() {
    setError(null)
    try {
      const subjects = Object.entries(selectedSubjects).filter(([_, h]) => (h || 0) > 0).map(([name, hours]) => ({ name, hours }))
      const days = daysFromStates()
      // Build cell states for AI: { "Pzt-8": "green" | "yellow" | "red" }
      const cell_states = cells
      const day_states = dayState
      const payload = { courses: courseList.join(', '), subjects, available_days: days, cell_states, day_states, avg }
      const { data } = await api.post('/api/ai/schedule/', payload)
      setSchedule(data.schedule || [])
      try {
        const { data: s } = await api.get('/api/assessments/quiz-stats/')
        setAvg(typeof s.average === 'number' ? s.average : null)
      } catch {}
    } catch (e) {
      setError('Program oluşturulamadı')
    }
  }
  function toggleCell(day: string, hour: number) {
    const key = `${day}-${hour}`
    setCells((prev) => {
      const curr = prev[key]
      const next: 'red'|'yellow'|'green' = curr === 'red' ? 'yellow' : curr === 'yellow' ? 'green' : 'red'
      return { ...prev, [key]: next }
    })
  }
  function toggleDayHeader(day: string) {
    const next = dayState[day] === 'red' ? 'yellow' : dayState[day] === 'yellow' ? 'green' : 'red'
    setDayState((d) => ({ ...d, [day]: next }))
    // apply to all 12 cells of that day
    setCells((prev) => {
      const updated = { ...prev }
      for (const h of hours) {
        updated[`${day}-${h}`] = next
      }
      return updated
    })
  }
  function cellColor(state?: 'red'|'yellow'|'green') {
    if (state === 'red') return 'error.light'
    if (state === 'yellow') return 'warning.light'
    if (state === 'green') return 'success.light'
    return 'background.paper'
  }
  function daysFromStates() {
    const usable: string[] = []
    for (const d of days) {
      if (dayState[d] === 'green') { usable.push(d); continue }
      const hasGreen = hours.some(h => cells[`${d}-${h}`] === 'green')
      if (hasGreen) usable.push(d)
    }
    return usable.length ? usable : ['Pzt','Sal','Çar','Per','Cum']
  }
  function autoPlace() {
    // Prefer structured subjects (with weekly hours). Fallback to free list with 1 hour each
    const subjects = Object.entries(selectedSubjects)
      .filter(([_, hrs]) => (hrs || 0) > 0)
      .map(([name, hrs]) => ({ name, hours: hrs }))
    const free = courseList.filter(Boolean).map(n => ({ name: n, hours: 1 }))
    const queue = subjects.length ? subjects : free
    if (queue.length === 0) return

    const canUseYellow = avg !== null && avg < 50
    const allowed: Array<'green'|'yellow'> = canUseYellow ? ['green','yellow'] : ['green']
    const anyColored = Object.keys(cells).length > 0
    const newSchedule: { day: string, items: string[] }[] = days.map(d => ({ day: d, items: [] }))

    // Build list of allowed slots; if none colored, use all slots
    const slots: { day: string, hour: number }[] = []
    for (const d of days) {
      for (const h of hours) {
        const state = cells[`${d}-${h}`]
        if (!anyColored || (state && allowed.includes(state as any))) {
          slots.push({ day: d, hour: h })
        }
      }
    }
    let si = 0
    for (const subj of queue) {
      let remaining = subj.hours
      // distribute round-robin through available slots
      while (remaining > 0 && si < slots.length) {
        const { day, hour } = slots[si]
        const dayObj = newSchedule.find(s => s.day === day)!
        const timeStr = `${String(hour).padStart(2,'0')}:00-${String(hour+1).padStart(2,'0')}:00`
        if (!dayObj.items.some(it => it.endsWith(timeStr))) {
          dayObj.items.push(`${subj.name} ${timeStr}`)
          remaining--
        }
        si++
      }
    }
    setSchedule(newSchedule)
  }

  const placedMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const d of schedule) {
      for (const it of d.items) {
        const m = it.match(/(\d{2}):00-(\d{2}):00$/)
        if (m) {
          const start = parseInt(m[1])
          const key = `${d.day}-${start}`
          const course = it.replace(/\s\d{2}:00-\d{2}:00$/, '')
          map[key] = course
        }
      }
    }
    return map
  }, [schedule])
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Ders Programı Önerisi</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">Aşağıdaki 7 sütun (gün) × 12 satır (08–19) takvim üzerinde plan yap.</Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'flex', gap: 8/8, minWidth: 8 * 120 }}>
              <Box sx={{ minWidth: 120 }}>
                <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                  <Box sx={{ mb: 1, p: 1, borderRadius: 1.5, textAlign: 'center', fontWeight: 600, bgcolor: 'action.hover' }}>Saat</Box>
                  <Stack spacing={0.75}>
                    {hours.map((h) => (
                      <Box key={`hour-${h}`} sx={{ height: 40, borderRadius: 1, border: '1px dashed', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" color="text.secondary">{String(h).padStart(2,'0')}:00</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              </Box>
              {days.map((d) => (
                <Box key={d} sx={{ minWidth: 120 }}>
                  <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                    <Box onClick={() => toggleDayHeader(d)} sx={{ mb: 1, p: 1, borderRadius: 1.5, textAlign: 'center', fontWeight: 600, cursor: 'pointer', bgcolor: 'transparent', border: '1px dashed', borderColor: 'divider' }}>{d}</Box>
                    <Stack spacing={0.75}>
                      {hours.map((h) => (
                        <Box key={`${d}-${h}`} onClick={() => toggleCell(d, h)}
                          sx={{ height: 40, borderRadius: 1, cursor: 'pointer', border: '1px solid', borderColor: 'divider', bgcolor: cellColor(cells[`${d}-${h}`]), display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 120ms ease' }}>
                          {placedMap[`${d}-${h}`] && (
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>{placedMap[`${d}-${h}`]}</Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                </Box>
              ))}
            </Box>
            
            <Stack direction="row" spacing={2} sx={{ mt: 1 }} alignItems="center">
              <Typography variant="caption">Legend:</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box sx={{ width: 12, height: 12, bgcolor: 'success.light', borderRadius: 0.5 }} /> <Typography variant="caption">Müsait</Typography></Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box sx={{ width: 12, height: 12, bgcolor: 'warning.light', borderRadius: 0.5 }} /> <Typography variant="caption">Orta</Typography></Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Box sx={{ width: 12, height: 12, bgcolor: 'error.light', borderRadius: 0.5 }} /> <Typography variant="caption">Müsait değil</Typography></Box>
            </Stack>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Ders Ekle</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
              <TextField size="small" label="Ders adı" value={courseInput} onChange={(e) => setCourseInput(e.target.value)} />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Haftalık Saat</InputLabel>
                <Select label="Haftalık Saat" value={courseHours} onChange={(e) => setCourseHours(Number(e.target.value))}>
                  {[1,2,3,4,5,6,7,8,9,10].map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                </Select>
              </FormControl>
              <Button variant="outlined" onClick={() => {
                const v = courseInput.trim()
                if (!v || courseHours <= 0) return
                setSelectedSubjects(prev => ({ ...prev, [v]: (prev[v] || 0) + courseHours }))
                if (!courseList.includes(v)) setCourseList(l => [...l, v])
                setCourseInput('')
                setCourseHours(1)
              }}>Ekle</Button>
              <Button variant="text" color="error" onClick={() => { setCourseList([]); setSelectedSubjects({}) }}>Temizle</Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {courseList.map(c => (
                <Chip key={c} label={`${c} (${selectedSubjects[c] || 0} saat)`} onDelete={() => { setCourseList(l => l.filter(x => x !== c)); setSelectedSubjects(prev => { const cp = { ...prev }; delete cp[c]; return cp }) }} />
              ))}
              {courseList.length === 0 && (
                <Typography variant="caption" color="text.secondary">Henüz ders eklenmedi</Typography>
              )}
            </Stack>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Lise Dersleri ve Haftalık Saat</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {hsSubjects.map((s) => (
                <Stack key={s} direction="row" spacing={1} alignItems="center" sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" sx={{ minWidth: 80 }}>{s}</Typography>
                  <TextField size="small" type="number" inputProps={{ min: 0, max: 10 }} sx={{ width: 72 }}
                    value={selectedSubjects[s] || ''}
                    onChange={(e) => setSelectedSubjects((prev) => ({ ...prev, [s]: Math.max(0, Math.min(10, parseInt(e.target.value || '0'))) }))}
                    placeholder="saat" />
                  <Button size="small" variant="text" onClick={() => setSelectedSubjects(prev => ({ ...prev, [s]: (prev[s] || 0) + 1 }))}>+1</Button>
                </Stack>
              ))}
            </Stack>
          </Box>
          {/* Müsait Günler kaldırıldı: grid üzerinden belirleniyor */}
          {avg !== null && (
            <Typography variant="caption" color="text.secondary">Quiz ortalaması: {avg} — {avg < 50 ? 'Sarı saatlerde de ders planlanabilir' : 'Yalnızca yeşil saatler kullanılacak'}</Typography>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" onClick={handleGenerate}>AI ile Program Öner</Button>
            <Button variant="outlined" onClick={autoPlace}>Otomatik Yerleştir</Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  )
}

export default StudySchedule


