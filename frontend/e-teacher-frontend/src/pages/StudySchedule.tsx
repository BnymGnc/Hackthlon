import { Typography, Paper, Box, TextField, Button, Stack, Alert, MenuItem, Select, InputLabel, FormControl, IconButton, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material'
import { Add, Remove, Save, Cancel } from '@mui/icons-material'
import { useMemo, useState, useEffect } from 'react'
import api from '../lib/api'

function StudySchedule() {

  const [courseInput, setCourseInput] = useState('')
  const [courseHours, setCourseHours] = useState<number>(1)
  const [courseList, setCourseList] = useState<string[]>([])
  const [schedule, setSchedule] = useState<{ day: string, items: string[] }[]>([])
  const [savedSchedules, setSavedSchedules] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => 8 + i), []) // 08-19 (12 slot)
  const days = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']
  const [cells, setCells] = useState<Record<string, 'red'|'yellow'|'green'>>({})
  const [dayState, setDayState] = useState<Record<string, 'red'|'yellow'|'green' | undefined>>({})
  const [avg, setAvg] = useState<number | null>(null)
  const [hsSubjects] = useState<string[]>(['Matematik','Fizik','Kimya','Biyoloji','Türkçe','Edebiyat','Tarih','Coğrafya','Felsefe','Din Kültürü','Yabancı Dil'])
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, number>>({})
  // available days derived from grid/day header colors

  useEffect(() => {
    loadSavedSchedules()
  }, [])

  const loadSavedSchedules = async () => {
    try {
      const { data } = await api.get('/api/ai/schedule/save/')
      // Backend now returns single latest schedule under 'schedule'
      setSavedSchedules(data.schedule ? [data.schedule] : [])
    } catch (e) {
      console.log('Could not load saved schedules')
    }
  }

  async function handleGenerate() {
    setError(null)
    setSuccess(null)
    
    // Check if there are subjects to schedule
    const subjects = Object.entries(selectedSubjects).filter(([_, h]) => (h || 0) > 0).map(([name, hours]) => ({ name, hours }))
    if (subjects.length === 0) {
      setError('Lütfen önce ders ekleyin ve saat belirleyin')
      return
    }
    
    try {
      // Get available days from cell states
      const availableDays = daysFromStates()
      
      // Build cell states for AI: { "Pzt-8": "green" | "yellow" | "red" }
      const cellStates = { ...cells }
      const dayStates = { ...dayState }
      
      // If no availability is set, default to all green for work hours
      if (Object.keys(cellStates).length === 0 && Object.keys(dayStates).length === 0) {
        // Set default availability: Green for 09-11 and 14-16, Yellow for 11-13 and 16-18
        const defaultGreenHours = [9, 10, 14, 15]
        const defaultYellowHours = [11, 12, 16, 17]
        
        for (const day of days.slice(0, 5)) { // Monday to Friday
          for (const hour of defaultGreenHours) {
            cellStates[`${day}-${hour}`] = 'green'
          }
          for (const hour of defaultYellowHours) {
            cellStates[`${day}-${hour}`] = 'yellow'
          }
        }
        
        // Weekend as yellow
        for (const day of ['Cmt', 'Paz']) {
          for (const hour of [10, 11, 14, 15]) {
            cellStates[`${day}-${hour}`] = 'yellow'
          }
        }
        
        // Update local state to show the defaults
        setCells(cellStates)
      }
      
      // Validate total requested hours vs availability (green first, then yellow; never red)
      const totalRequested = subjects.reduce((sum, s) => sum + (s.hours || 0), 0)
      const countSlotsBy = (color: 'green'|'yellow') =>
        days.reduce((acc, d) => acc + hours.filter(h => cellStates[`${d}-${h}`] === color).length, 0)
      const greenCapacity = countSlotsBy('green')
      const yellowCapacity = countSlotsBy('yellow')
      if (totalRequested > greenCapacity + yellowCapacity) {
        setError(`Toplam ${totalRequested} saat ders istendi ancak sadece ${greenCapacity} yeşil + ${yellowCapacity} sarı saat mevcut. Lütfen daha fazla müsaitlik ekleyin.`)
        return
      }
      if (totalRequested > greenCapacity) {
        setSuccess(`Yeşil saatler ${greenCapacity} saat ile sınırlı. Kalan saatler için sarı saatler kullanılacaktır.`)
      }
      
      const payload = {
        courses: courseList.join(', '),
        subjects,
        available_days: availableDays,
        cell_states: cellStates,
        day_states: dayStates,
        preferences: {
          prefer_2hour_blocks: true,
          avoid_consecutive_same_subject: true,
          use_yellow_if_needed: true,
          enforce_green_then_yellow: true,
          forbid_red: true,
          block_size_hours: 2,
          break_tip_after_consecutive_hours: 6,
          hours_window: { start: 8, end: 20 },
          grid: { days: 7, hours_per_day: 12 }
        },
        goals: 'Verimli ve dengeli ders programı oluştur',
        ai_instructions: 'Takvim 7 gün × 12 saat (08:00–20:00). Önce yeşil saatleri, sonra sarıları kullan. Kırmızıya yerleşme. Dersleri 2 saatlik bloklar halinde planla; tek saat fazlaları 1 saat olarak ekle (ör. 3→2+1, 5→2+2+1). Aynı dersi art arda getirme, günlere dağıt. Yeşil bitmeden sarıya geçme. 6+ ardışık saat varsa mola öner. Öğrencinin verdiği müsaitlik dışına çıkma.'
      }
      
      console.log('Sending payload to AI:', {
        subjects: subjects.length,
        cell_states: Object.keys(cellStates).length,
        day_states: Object.keys(dayStates).length,
        available_days: availableDays
      })
      
      setSuccess('AI ile ders programı oluşturuluyor...')
      const { data } = await api.post('/api/ai/schedule/', payload)
      
      if (data.schedule && Array.isArray(data.schedule)) {
        let aiSchedule: { day: string, items: string[] }[] = data.schedule

        // Sanitize AI items: only 08:00–20:00, never red; out-of-range or red items go back to remaining
        const H_START = 8
        const H_END = 20 // exclusive end
        const parseRange = (it: string) => {
          const m = it.match(/(\d{2}):00-(\d{2}):00$/)
          if (!m) return null
          return { start: parseInt(m[1]), end: parseInt(m[2]) }
        }
        const itemDuration = (it: string) => {
          const r = parseRange(it)
          return r ? Math.max(0, r.end - r.start) : 1
        }
        const itemStartHour = (it: string) => {
          const r = parseRange(it)
          return r ? r.start : null
        }
        const isRed = (day: string, hour: number) => cells[`${day}-${hour}`] === 'red'
        const extraBack: Record<string, number> = {}
        for (const d of aiSchedule) {
          d.items = (d.items || []).filter((it) => {
            const range = parseRange(it)
            const name = it.replace(/\s\d{2}:00-\d{2}:00$/, '')
            if (!range) return false
            const { start, end } = range
            // drop if outside allowed hours or any hour is red
            if (start < H_START || end > H_END || isRed(d.day, start)) {
              const dur = Math.max(0, end - start)
              extraBack[name] = (extraBack[name] || 0) + dur
              return false
            }
            return true
          })
        }

        // Strict cap helper: never exceed requested per subject (prefer removing from yellow, shorter first)
        const capToRequested = () => {
          const requestedBySubject: Record<string, number> = {}
          for (const s of subjects) requestedBySubject[s.name] = (requestedBySubject[s.name] || 0) + s.hours
          const placedBySubject: Record<string, number> = {}
          for (const d of aiSchedule) {
            for (const it of d.items || []) {
              const name = it.replace(/\s\d{2}:00-\d{2}:00$/, '')
              placedBySubject[name] = (placedBySubject[name] || 0) + itemDuration(it)
            }
          }
          for (const [name, placed] of Object.entries(placedBySubject)) {
            const requested = requestedBySubject[name] || 0
            let over = placed - requested
            if (over <= 0) continue
            const removeItems: Array<{ day: string, index: number, dur: number, isYellow: boolean }> = []
            aiSchedule.forEach((d) => {
              (d.items || []).forEach((it, index) => {
                const subj = it.replace(/\s\d{2}:00-\d{2}:00$/, '')
                if (subj !== name) return
                const dur = itemDuration(it)
                const start = itemStartHour(it)
                const isYellow = start !== null ? (cells[`${d.day}-${start}`] === 'yellow') : false
                removeItems.push({ day: d.day, index, dur, isYellow })
              })
            })
            // sort: yellow first, then shorter duration first, then later index
            removeItems.sort((a, b) => (a.isYellow === b.isYellow ? 0 : a.isYellow ? -1 : 1) || a.dur - b.dur || b.index - a.index)
            for (const rem of removeItems) {
              if (over <= 0) break
              const dayObj = aiSchedule.find(x => x.day === rem.day)
              if (!dayObj) continue
              const it = dayObj.items[rem.index]
              if (!it) continue
              const dur = itemDuration(it)
              dayObj.items.splice(rem.index, 1)
              over -= dur
            }
          }
        }
        // First cap before any local filling
        capToRequested()
        // If AI didn't place all requested hours, try to fill the rest using YELLOW (never red)
        const requestedBySubject: Record<string, number> = {}
        for (const s of subjects) requestedBySubject[s.name] = (requestedBySubject[s.name] || 0) + s.hours
        const placedBySubject: Record<string, number> = {}
        for (const d of aiSchedule) {
          for (const it of (d.items || [])) {
            const name = it.replace(/\s\d{2}:00-\d{2}:00$/, '')
            const m = it.match(/(\d{2}):00-(\d{2}):00$/)
            const dur = m ? Math.max(0, parseInt(m[2]) - parseInt(m[1])) : 1
            placedBySubject[name] = (placedBySubject[name] || 0) + dur
          }
        }
        const remaining: Array<{ name: string, hours: number }> = []
        for (const [name, hrs] of Object.entries(requestedBySubject)) {
          const left = Math.max(0, hrs - (placedBySubject[name] || 0))
          if (left > 0) remaining.push({ name, hours: left })
        }
        // add sanitized-back hours into remaining
        for (const [name, hrs] of Object.entries(extraBack)) {
          const idx = remaining.findIndex(r => r.name === name)
          if (idx >= 0) remaining[idx].hours += hrs
          else remaining.push({ name, hours: hrs })
        }
        if (remaining.length > 0) {
          // Build occupancy map
          const occupied = new Set<string>()
          for (const d of aiSchedule) {
            for (const it of d.items || []) {
              const m = it.match(/(\d{2}):00-(\d{2}):00$/)
              if (!m) continue
              const start = parseInt(m[1])
              const end = parseInt(m[2])
              for (let h = start; h < end; h++) occupied.add(`${d.day}-${h}`)
            }
          }
          // First try to place remaining singles into free GREEN single slots (no 2h gereksinimi yok)
          const greenSlotsByDay = days.map(d => ({
            day: d,
            slots: hours.filter(h => cells[`${d}-${h}`] === 'green' && !occupied.has(`${d}-${h}`))
              .sort((a,b)=>a-b)
          }))
          const ensureDay = (day: string) => {
            let obj = aiSchedule.find(x => x.day === day)
            if (!obj) { obj = { day, items: [] }; aiSchedule.push(obj) }
            return obj
          }
          const lastOnDay = (day: string) => {
            const d = aiSchedule.find(x => x.day === day)
            if (!d || !d.items.length) return null
            return d.items[d.items.length - 1].replace(/\s\d{2}:00-\d{2}:00$/, '')
          }
          const canAdj = (day: string, name: string) => (lastOnDay(day) ?? '') !== name
          // Place singles in green first
          let placedSinglesGreen = true
          while (placedSinglesGreen) {
            placedSinglesGreen = false
            for (const r of remaining) {
              if (r.hours <= 0) continue
              for (const d of greenSlotsByDay) {
                if (!d.slots.length) continue
                const idx = canAdj(d.day, r.name) ? 0 : (d.slots.findIndex(() => canAdj(d.day, r.name)) ?? 0)
                const h = d.slots.splice(idx === -1 ? 0 : idx, 1)[0]
                const dayObj = ensureDay(d.day)
                dayObj.items.push(`${r.name} ${String(h).padStart(2,'0')}:00-${String(h+1).padStart(2,'0')}:00`)
                r.hours -= 1
                placedSinglesGreen = true
                break
              }
            }
          }

          // Then try yellow: 2h blocks first, then singles, round-robin, avoiding adjacency if possible
          const yellowSlotsByDay = days.map(d => ({
            day: d,
            slots: hours.filter(h => cells[`${d}-${h}`] === 'yellow' && !occupied.has(`${d}-${h}`))
              .sort((a,b)=>a-b)
          }))
          // Try to place 2h blocks first, then singles, round-robin, avoiding adjacency if possible
          // Two-hour needs per subject
          const twoNeeds = remaining.map(r => ({ name: r.name, need: Math.floor(r.hours/2) }))
          let placedSomething = true
          while (placedSomething) {
            placedSomething = false
            for (const sub of twoNeeds) {
              if (sub.need <= 0) continue
              for (const d of yellowSlotsByDay) {
                // find consecutive pair
                for (let i=0;i<d.slots.length-1;i++) {
                  const h1 = d.slots[i]
                  const h2 = d.slots[i+1]
                  if (h2 === h1 + 1 && canAdj(d.day, sub.name)) {
                    const dayObj = ensureDay(d.day)
                    dayObj.items.push(`${sub.name} ${String(h1).padStart(2,'0')}:00-${String(h1+1).padStart(2,'0')}:00`)
                    dayObj.items.push(`${sub.name} ${String(h2).padStart(2,'0')}:00-${String(h2+1).padStart(2,'0')}:00`)
                    d.slots.splice(i, 2)
                    sub.need -= 1
                    placedSomething = true
                    break
                  }
                }
                if (placedSomething) break
              }
            }
          }
          // Reduce remaining by placed 2h
          for (const r of remaining) {
            const placed2 = Math.floor(r.hours/2) - (twoNeeds.find(t=>t.name===r.name)?.need ?? 0)
            r.hours -= placed2 * 2
          }
          // Singles round-robin
          let singles = true
          while (singles) {
            singles = false
            for (const r of remaining) {
              if (r.hours <= 0) continue
              for (const d of yellowSlotsByDay) {
                if (!d.slots.length) continue
                // avoid adjacency if possible
                const idx = canAdj(d.day, r.name) ? 0 : (d.slots.findIndex(()=>canAdj(d.day, r.name)) ?? 0)
                const h = d.slots.splice(idx === -1 ? 0 : idx, 1)[0]
                const dayObj = ensureDay(d.day)
                dayObj.items.push(`${r.name} ${String(h).padStart(2,'0')}:00-${String(h+1).padStart(2,'0')}:00`)
                r.hours -= 1
                singles = true
                break
              }
            }
          }
        }
        // Rebalance: spread green 2h blocks across days if one day is overloaded
        const tryFindGreenPair = (day: string, occupiedSet: Set<string>) => {
          for (let i = 0; i < hours.length - 1; i++) {
            const h1 = hours[i]
            const h2 = hours[i + 1]
            if (cells[`${day}-${h1}`] === 'green' && cells[`${day}-${h2}`] === 'green' &&
                !occupiedSet.has(`${day}-${h1}`) && !occupiedSet.has(`${day}-${h2}`)) {
              return [h1, h2] as [number, number]
            }
          }
          return null
        }
        const recomputeOccupied = () => {
          occupied.clear()
          for (const d of aiSchedule) {
            for (const it of d.items || []) {
              const m = it.match(/(\d{2}):00-(\d{2}):00$/)
              if (!m) continue
              const start = parseInt(m[1])
              const end = parseInt(m[2])
              for (let h = start; h < end; h++) occupied.add(`${d.day}-${h}`)
            }
          }
        }
        // current occupancy
        const occupied = new Set<string>()
        recomputeOccupied()
        // compute day loads
        const loadByDay = () => {
          const map: Record<string, number> = {}
          for (const d of aiSchedule) map[d.day] = (d.items || []).length
          return map
        }
        let loads = loadByDay()
        const dayList = [...days]
        let rebalanceGuard = 0
        while (rebalanceGuard < 20) {
          rebalanceGuard++
          const most = dayList.reduce((a, b) => (loads[a] || 0) >= (loads[b] || 0) ? a : b)
          const least = dayList.reduce((a, b) => (loads[a] || 0) <= (loads[b] || 0) ? a : b)
          if ((loads[most] || 0) - (loads[least] || 0) <= 1) break
          // pick a move candidate (prefer a 2h block item) from 'most'
          const mostObj = aiSchedule.find(x => x.day === most)
          if (!mostObj || mostObj.items.length === 0) break
          let moveIdx = mostObj.items.findIndex(it => {
            const m = it.match(/(\d{2}):00-(\d{2}):00$/); if (!m) return false
            const start = parseInt(m[1]); const end = parseInt(m[2])
            return end - start === 2
          })
          if (moveIdx === -1) moveIdx = mostObj.items.length - 1
          const cand = mostObj.items[moveIdx]
          const subject = cand.replace(/\s\d{2}:00-\d{2}:00$/, '')
          const pair = tryFindGreenPair(least, occupied)
          if (!pair) break
          // move
          mostObj.items.splice(moveIdx, 1)
          const leastObj = aiSchedule.find(x => x.day === least) || (() => { const o = { day: least, items: [] as string[] }; aiSchedule.push(o); return o })()
          leastObj.items.push(`${subject} ${String(pair[0]).padStart(2,'0')}:00-${String(pair[0]+1).padStart(2,'0')}:00`)
          leastObj.items.push(`${subject} ${String(pair[1]).padStart(2,'0')}:00-${String(pair[1]+1).padStart(2,'0')}:00`)
          recomputeOccupied()
          loads = loadByDay()
        }

        // Try to break long consecutive runs (>=6h): if extra green slots exist, move 1h from the end of the run to a free green hour on the same day
        const getDayRunInfo = (items: string[]) => {
          const hoursList = items
            .map((it) => parseInt((it.match(/(\d{2}):/)||[])[1] || '0'))
            .sort((a,b)=>a-b)
          let bestRun = { start: 0, len: 1 }
          let runStart = hoursList[0] || 0
          let runLen = 1
          for (let i=1;i<hoursList.length;i++) {
            if (hoursList[i] === hoursList[i-1] + 1) {
              runLen++
            } else {
              if (runLen > bestRun.len) bestRun = { start: runStart, len: runLen }
              runStart = hoursList[i]
              runLen = 1
            }
          }
          if (runLen > bestRun.len) bestRun = { start: runStart, len: runLen }
          return bestRun
        }
        let brokeAnyLongRun = false
        for (const d of aiSchedule) {
          const info = getDayRunInfo(d.items || [])
          if (info.len >= 6) {
            // find a free green hour on this day that is not currently occupied
            const freeGreen = hours.find(h => cells[`${d.day}-${h}`] === 'green' && !occupied.has(`${d.day}-${h}`))
            if (freeGreen !== undefined) {
              // move the last 1h of the long run (at hour info.start+info.len-1) to freeGreen
              const targetHour = info.start + info.len - 1
              const timeStr = `${String(targetHour).padStart(2,'0')}:00-${String(targetHour+1).padStart(2,'0')}:00`
              const idx = d.items.findIndex(it => it.endsWith(timeStr))
              if (idx !== -1) {
                const it = d.items.splice(idx, 1)[0]
                const subj = it.replace(/\s\d{2}:00-\d{2}:00$/, '')
                d.items.push(`${subj} ${String(freeGreen).padStart(2,'0')}:00-${String(freeGreen+1).padStart(2,'0')}:00`)
                brokeAnyLongRun = true
                recomputeOccupied()
              }
            }
          }
        }
        if (!brokeAnyLongRun) {
          const days6 = aiSchedule.filter(d => getDayRunInfo(d.items||[]).len >= 6).map(d => d.day)
          if (days6.length) setSuccess(`Mola önerilir: ${days6.join(', ')} gününde 6+ saat ardışık çalışma var. Uygun yeşil boşluk bulunamadı.`)
        }

        // Cap again strictly after local yellow fill
        capToRequested()

        // Compute final scheduled vs needed based on post-processing
        const finalNeeded = Object.values(requestedBySubject).reduce((a,b)=>a+b,0)
        const finalScheduled = aiSchedule.reduce((sum, d) => sum + (d.items||[]).reduce((s,it)=>{
          const m = it.match(/(\d{2}):00-(\d{2}):00$/)
          return s + (m ? Math.max(0, parseInt(m[2]) - parseInt(m[1])) : 1)
        },0), 0)

        setSchedule(aiSchedule)
        // Warn if any day has 6+ consecutive hours
        const sixPlus = aiSchedule.some((d: any) => {
          const hoursList = (d.items || [])
            .map((it: string) => parseInt((it.match(/(\d{2}):/)||[])[1] || '0'))
            .sort((a: number,b: number)=>a-b)
          let run = 1
          for (let i=1;i<hoursList.length;i++) {
            run = (hoursList[i] === hoursList[i-1] + 1) ? run+1 : 1
            if (run >= 6) return true
          }
          return false
        })
        if (sixPlus) {
          setSuccess('6 saatten uzun ardışık çalışma bulundu: Mola önerilir.')
        }
        
        // Check if all hours were scheduled (use final numbers)
        if (finalScheduled < finalNeeded) {
          setError(`Uyarı: Sadece ${finalScheduled}/${finalNeeded} saat planlanabildi. ` +
            'Lütfen daha fazla yeşil/sarı saat ekleyin veya "Otomatik Yerleştir" seçeneğini deneyin.')
        } else {
          setSuccess(
            data.source === 'ai_generated' 
              ? 'AI tarafından özel ders programınız oluşturuldu!' 
              : 'Akıllı algoritma ile ders programınız oluşturuldu!'
          )
        }
        
        // Show tips if available
        if (data.tips && data.tips.length > 0) {
          setTimeout(() => {
            setSuccess(`Program oluşturuldu! İpuçları: ${data.tips.slice(0, 2).join(' • ')}`)
          }, 2000)
        }
      } else {
        setError('Program oluşturulamadı - geçersiz yanıt')
      }
      
      // Load quiz stats for better recommendations
      try {
        const { data: stats } = await api.get('/api/assessments/quiz-stats/')
        setAvg(typeof stats.average === 'number' ? stats.average : null)
      } catch {}
      
    } catch (e: any) {
      console.error('Schedule generation error:', e)
      setError(
        e.response?.status === 503 
          ? 'AI servisi şu anda kullanılamıyor. Lütfen "Otomatik Yerleştir" seçeneğini deneyin.'
          : 'Program oluşturulamadı. Lütfen tekrar deneyin.'
      )
    }
  }
  function toggleCell(day: string, hour: number) {
    const key = `${day}-${hour}`
    setCells((prev) => {
      const curr = prev[key]
      const next: 'red'|'yellow'|'green' = curr === 'red' ? 'yellow' : curr === 'yellow' ? 'green' : 'red'
      return { ...prev, [key]: next }
    })
    
    // Clear any existing messages when user changes availability
    setError(null)
    setSuccess(null)
  }
  function toggleDayHeader(day: string) {
    const current = dayState[day]
    const next: 'red'|'yellow'|'green' = current === 'red' ? 'yellow' : current === 'yellow' ? 'green' : 'red'
    
    setDayState((d) => ({ ...d, [day]: next }))
    
    // Apply to all 12 cells of that day
    setCells((prev) => {
      const updated = { ...prev }
      for (const h of hours) {
        updated[`${day}-${h}`] = next
      }
      return updated
    })
    
    // Clear any existing messages
    setError(null)
    setSuccess(null)
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

    // green fully first, then yellow
    const anyColored = Object.keys(cells).length > 0
    const newSchedule: { day: string, items: string[] }[] = days.map(d => ({ day: d, items: [] }))

    // Build list of allowed slots grouped by color; fully exhaust green before yellow, never red
    const getSlotsByColor = (color: 'green'|'yellow') => {
      const list: { day: string, hour: number }[] = []
      for (const d of days) {
        for (const h of hours) {
          const state = cells[`${d}-${h}`]
          if (!anyColored || state === color) list.push({ day: d, hour: h })
        }
      }
      return list
    }
    const slotsGreen = getSlotsByColor('green')
    const slotsYellow = getSlotsByColor('yellow')

    const placeBlock = (subjName: string, day: string, startHour: number, length: number) => {
      const dayObj = newSchedule.find(s => s.day === day)!
      for (let k = 0; k < length; k++) {
        const h = startHour + k
        const timeStr = `${String(h).padStart(2,'0')}:00-${String(h+1).padStart(2,'0')}:00`
        dayObj.items = dayObj.items.filter(it => !it.endsWith(timeStr))
        dayObj.items.push(`${subjName} ${timeStr}`)
      }
    }

    const lastPlacedSubjectOnDay = (day: string): string | null => {
      const dayObj = newSchedule.find(s => s.day === day)!
      if (!dayObj.items.length) return null
      const last = dayObj.items[dayObj.items.length - 1]
      return last.replace(/\s\d{2}:00-\d{2}:00$/, '')
    }

    const canPlaceWithoutSameAdjacency = (day: string, subjName: string) => {
      const prev = lastPlacedSubjectOnDay(day)
      return prev === null || prev !== subjName
    }

    const hasSubjectAt = (day: string, hour: number, subjName: string) => {
      const dayObj = newSchedule.find(s => s.day === day)!
      return dayObj.items.some(it => {
        if (!it.startsWith(`${subjName} `)) return false
        const m = it.match(/(\d{2}):00-(\d{2}):00$/)
        if (!m) return false
        const start = parseInt(m[1]); const end = parseInt(m[2])
        return hour >= start && hour < end
      })
    }
    const canPlacePair = (day: string, startHour: number, subjName: string) => {
      // avoid direct adjacency with same subject before/after the pair window
      // check hour-1, startHour, startHour+1, startHour+2 boundaries
      return (
        !hasSubjectAt(day, startHour - 1, subjName) &&
        !hasSubjectAt(day, startHour, subjName) &&
        !hasSubjectAt(day, startHour + 1, subjName) &&
        !hasSubjectAt(day, startHour + 2, subjName)
      )
    }
    const safeToPlaceSingle = (day: string, hour: number, subjName: string) => {
      if (!canPlaceWithoutSameAdjacency(day, subjName)) return false
      // prevent adjacency with existing same-subject blocks at hour-1 or hour+1
      return !hasSubjectAt(day, hour - 1, subjName) && !hasSubjectAt(day, hour, subjName)
    }

    // Helper to compute consecutive hours in a day to suggest breaks
    const getMaxConsecutive = (items: string[]) => {
      const hoursList = items
        .map((it: string) => parseInt((it.match(/(\d{2}):/)||[])[1] || '0'))
        .sort((a: number,b: number)=>a-b)
      let run = 1, maxRun = 1
      for (let i=1;i<hoursList.length;i++) {
        run = (hoursList[i] === hoursList[i-1] + 1) ? run+1 : 1
        if (run > maxRun) maxRun = run
      }
      return maxRun
    }

    // 1) Place all subjects into GREEN slots first: 2-hour blocks, then 1-hour balanced round-robin across days
    // Build green slots grouped by day to distribute single hours fairly
    // Slight randomization for diversity
    const shuffledDays = [...days].sort(() => Math.random() - 0.5)
    const greenByDay = shuffledDays.map(d => ({ day: d, slots: slotsGreen.filter(s => s.day === d).map(s => s.hour).sort((a,b)=>a-b) }))
    const yellowByDay = shuffledDays.map(d => ({ day: d, slots: slotsYellow.filter(s => s.day === d).map(s => s.hour).sort((a,b)=>a-b) }))

    const extractConsecutivePairs = (slots: number[]) => {
      const pairs: Array<[number, number]> = []
      const used: Set<number> = new Set()
      for (let i = 0; i < slots.length - 1; i++) {
        const a = slots[i]
        const b = slots[i + 1]
        if (!used.has(a) && !used.has(b) && b === a + 1) {
          pairs.push([a, b])
          used.add(a); used.add(b)
        }
      }
      return { pairs, used }
    }

    const placeInColor = (color: 'green'|'yellow') => {
      const byDay = color === 'green' ? greenByDay : yellowByDay
      // Precompute 2h consecutive pairs per day for balanced distribution
      const dayPairs = byDay.map(d => ({ day: d.day, ...extractConsecutivePairs(d.slots) }))

      // Proportional day quotas (only for green): distribute total remaining hours by each day's green capacity
      const dayPlacedCount: Record<string, number> = {}
      const dayQuota: Record<string, number> = {}
      if (color === 'green') {
        const totalNeed = queue.reduce((s,q)=>s+Math.max(0,q.hours),0)
        const slotsPerDay = byDay.map(d => ({ day: d.day, cnt: d.slots.length }))
        const totalGreen = slotsPerDay.reduce((s,x)=>s+x.cnt,0)
        for (const { day, cnt } of slotsPerDay) {
          const share = totalGreen > 0 ? Math.round((cnt / totalGreen) * totalNeed) : 0
          // If there is surplus green (totalGreen > totalNeed), cap day to 6h to avoid very long days
          dayQuota[day] = totalGreen > totalNeed ? Math.min(6, share) : share
          dayPlacedCount[day] = 0
        }
      }

      // 1) Place 2-hour blocks round-robin across days to ensure diversity, avoid same-subject adjacency
      // Compute desired 2h blocks per subject
      const twoHourNeeds = queue.map(q => ({ name: q.name, need: Math.floor(q.hours / 2) }))
      let placedSomething = true
      while (placedSomething) {
        placedSomething = false
        for (const sub of twoHourNeeds) {
          if (sub.need <= 0) continue
          // try to place this subject in the next available day pair
          for (const dp of dayPairs) {
            if (dp.pairs.length === 0) continue
            // peek pairs to avoid adjacency; if first pair causes adjacency, try next
            let pairIndex = -1
            for (let i = 0; i < dp.pairs.length; i++) {
              const [pStart] = dp.pairs[i]
              if (canPlacePair(dp.day, pStart, sub.name)) { pairIndex = i; break }
            }
            if (pairIndex === -1) continue
            const [h1, h2] = dp.pairs.splice(pairIndex, 1)[0]
            if (color === 'green' && dayQuota[dp.day] !== undefined) {
              const allow = Math.max(0, dayQuota[dp.day] - dayPlacedCount[dp.day])
              if (allow < 2) continue
              dayPlacedCount[dp.day] += 2
            }
            placeBlock(sub.name, dp.day, h1, 2)
            // remove used hours from byDay slots as well
            const target = byDay.find(x => x.day === dp.day)!
            target.slots = target.slots.filter(x => x !== h1 && x !== h2)
            sub.need -= 1
            placedSomething = true
            break
          }
        }
      }
      // Reduce queue hours by what we placed as 2h blocks (leave a single 1h remainder only)
      for (const subj of queue) {
        const placedCount = twoHourNeeds.find(s => s.name === subj.name)?.need ?? 0
        const originallyNeeded = Math.floor(subj.hours / 2)
        const placedBlocks = originallyNeeded - placedCount
        subj.hours -= placedBlocks * 2
      }

      // Fallback: if some subjects still have >=2 hours and there are pairs left anywhere,
      // place additional 2h blocks even if it causes adjacency (only if no non-adjacent spot was possible).
      // This helps 3-hour cases become 2h + 1h instead of 3 singles when pairs exist.
      const remainingPairs = dayPairs.some(dp => dp.pairs.length)
      if (remainingPairs) {
        for (const subj of queue) {
          while (subj.hours >= 2) {
            let placed = false
            for (const dp of dayPairs) {
              if (dp.pairs.length === 0) continue
              // try to find a non-adjacent pair for this subject; if none, take first available
              let idx = dp.pairs.findIndex(([pStart]) => canPlacePair(dp.day, pStart, subj.name))
              if (idx === -1) idx = 0
              const [h1, h2] = dp.pairs.splice(idx, 1)[0]
              if (color === 'green' && dayQuota[dp.day] !== undefined) {
                const allow = Math.max(0, dayQuota[dp.day] - dayPlacedCount[dp.day])
                if (allow < 2) continue
                dayPlacedCount[dp.day] += 2
              }
              placeBlock(subj.name, dp.day, h1, 2)
              const target = byDay.find(x => x.day === dp.day)!
              target.slots = target.slots.filter(x => x !== h1 && x !== h2)
              subj.hours -= 2
              placed = true
              break
            }
            if (!placed) break
          }
        }
      }

      // 2) Place remaining single hours (remainder 1h) in a round-robin across days, avoid same-subject adjacency where possible
      // If yeşilde tek slot kaldıysa bile, önce o yeşile tek saat koy, sonra sarıya geç
      let singlesLeft = queue.some(q => q.hours > 0)
      while (singlesLeft) {
        singlesLeft = false
    for (const subj of queue) {
          if (subj.hours <= 0) continue
          // find a day with available slot
          for (const d of byDay) {
            if (!d.slots.length) continue
            // pick a slot that avoids adjacency with same subject if possible
            let slotIndex = d.slots.findIndex(h => safeToPlaceSingle(d.day, h, subj.name))
            if (slotIndex === -1) {
              // try any non-adjacent by last-only as a weaker condition
              slotIndex = d.slots.findIndex(() => canPlaceWithoutSameAdjacency(d.day, subj.name))
            }
            if (slotIndex === -1) slotIndex = 0
            const h = d.slots.splice(slotIndex, 1)[0]
            if (color === 'green' && dayQuota[d.day] !== undefined) {
              const allow = Math.max(0, dayQuota[d.day] - dayPlacedCount[d.day])
              // Eğer tüm günlerde yeşil kotası bitti (toplam allow == 0) ama yeşil slot hala varsa, bu teki yerleştir
              if (allow < 1) {
                const totalAllow = Object.keys(dayQuota).reduce((s,dy)=> s + Math.max(0, dayQuota[dy] - dayPlacedCount[dy]), 0)
                if (totalAllow < 1) {
                  // bypass quota for last singles
                } else {
                  continue
                }
              }
              dayPlacedCount[d.day] += 1
            }
            placeBlock(subj.name, d.day, h, 1)
            subj.hours -= 1
            singlesLeft = true
            break
          }
        }
      }
    }

    // Place in green completely first
    placeInColor('green')
    // Any remaining hours move to yellow (queue is already mutated by placeInColor)
    if (queue.some(q => q.hours > 0)) {
      placeInColor('yellow')
    }
    // After placement, check for long consecutive periods (>=4) and surface a tip
    // If 6+ consecutive hours exist, show a stronger suggestion with day name
    const daysWith6Plus: string[] = []
    for (const d of newSchedule) {
      if (getMaxConsecutive(d.items) >= 6) daysWith6Plus.push(d.day)
    }
    if (daysWith6Plus.length) {
      setSuccess(`Mola önerilir: ${daysWith6Plus.join(', ')} gününde 6+ saat ardışık çalışma var.`)
    } else {
      const longConsecutive = newSchedule.some(d => getMaxConsecutive(d.items) >= 4)
      if (longConsecutive) {
        setSuccess('3-4 saatte bir mola verilecek şekilde planlamaya özen gösterin. Uzun bloklar için kısa ara ekleyin.')
      }
    }
    setSchedule(newSchedule)
  }

  const saveSchedule = async () => {
    if (schedule.length === 0) {
      setError('Kaydedilecek program bulunamadı')
      return
    }

    try {
      const scheduleData = {
        schedule: schedule,
        courses: courseList,
        subjects: selectedSubjects,
        availability: cells,
        dayStates: dayState,
        createdAt: new Date().toISOString()
      }

      await api.post('/api/ai/schedule/save/', {
        schedule: scheduleData,
        title: 'CurrentSchedule'
      })

      setSuccess('Ders programınız başarıyla kaydedildi!')
      await loadSavedSchedules()
      setTimeout(() => setSuccess(null), 3000)
    } catch (e: any) {
      console.error('Save error:', e)
      setError('Ders programı kaydedilirken hata oluştu: ' + (e.response?.data?.error || e.message || ''))
    }
  }

  const adjustSubjectHours = (subject: string, change: number) => {
    setSelectedSubjects(prev => {
      const current = prev[subject] || 0
      const newValue = Math.max(0, Math.min(10, current + change))
      if (newValue === 0) {
        const { [subject]: removed, ...rest } = prev
        return rest
      }
      return { ...prev, [subject]: newValue }
    })
  }

  const placedMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const d of schedule) {
      for (const it of d.items) {
        const m = it.match(/(\d{2}):00-(\d{2}):00$/)
        if (m) {
          const start = parseInt(m[1])
          const end = parseInt(m[2])
          const course = it.replace(/\s\d{2}:00-\d{2}:00$/, '')
          for (let h = start; h < end; h++) {
            const key = `${d.day}-${h}`
          map[key] = course
          }
        }
      }
    }
    return map
  }, [schedule])

  // Drag and drop helpers
  const [draggingCourse, setDraggingCourse] = useState<string | null>(null)
  function onDragStartCourse(course: string) {
    setDraggingCourse(course)
  }
  function onDragEndCourse() {
    setDraggingCourse(null)
  }
  function allowDrop(ev: React.DragEvent) {
    ev.preventDefault()
  }
  function dropToCell(day: string, hour: number) {
    if (!draggingCourse) return
    // Place dragged course into selected cell hour as a 1h block
    setSchedule((prev) => {
      const copy = prev.length ? prev.map(d => ({ day: d.day, items: [...d.items] })) : days.map(d => ({ day: d, items: [] }))
      const dayObj = copy.find(d => d.day === day)!
      const timeStr = `${String(hour).padStart(2,'0')}:00-${String(hour+1).padStart(2,'0')}:00`
      // Remove any existing item at this slot
      dayObj.items = dayObj.items.filter(it => !it.endsWith(timeStr))
      dayObj.items.push(`${draggingCourse} ${timeStr}`)
      return copy
    })
  }
  function dropToTrash() {
    if (!draggingCourse) return
    setSchedule((prev) => prev.map(d => ({
      day: d.day,
      items: d.items.filter(it => !it.startsWith(`${draggingCourse} `))
    })))
  }
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Ders Programı Önerisi</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">
            Aşağıdaki 7 sütun (gün) × 12 satır (08–20) takvim üzerinde plan yap.
            <Box component="span" sx={{ display: 'block', mt: 0.5, fontSize: 'small', color: 'text.secondary' }}>
              💡 <strong>Kullanım:</strong> Gün başlıklarına veya hücrelere tıklayarak müsaitliğinizi belirleyin.
              <br />
              🟫 <strong>Yeşil:</strong> En müsait saatler (AI bu saatleri öncelikle kullanır)
              <br />
              🟨 <strong>Sarı:</strong> Orta düzeyde müsait (gerektiğinde kullanılır)
              <br />
              🟪 <strong>Kırmızı:</strong> Müsait değil (sadece çok gerekli ise kullanılır)
            </Box>
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'flex', gap: 8/8, minWidth: 8 * 130 }}>
              <Box sx={{ minWidth: 130 }}>
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
                <Box key={d} sx={{ minWidth: 130 }}>
                  <Paper variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                    <Box onClick={() => toggleDayHeader(d)} 
                      sx={{ 
                        mb: 1, 
                        p: 1, 
                        borderRadius: 1.5, 
                        textAlign: 'center', 
                        fontWeight: 600, 
                        cursor: 'pointer', 
                        bgcolor: 'background.paper', 
                        border: '1px solid', 
                        borderColor: 'divider',
                        transition: 'all 120ms ease',
                        '&:hover': {
                          transform: 'scale(1.02)',
                          borderColor: 'primary.main',
                          bgcolor: 'action.hover'
                        }
                      }}>
                      {d}
                    </Box>
                    <Stack spacing={0.75}>
                      {hours.map((h) => (
                        <Box key={`${d}-${h}`}
                          onClick={() => toggleCell(d, h)}
                          onDragOver={allowDrop}
                          onDrop={(e) => { e.preventDefault(); dropToCell(d, h) }}
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
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ my: 1 }}>
              {courseList.map(c => (
                <Stack key={c} direction="row" spacing={1} alignItems="center" sx={{ p: 1, my: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                  draggable
                  onDragStart={() => onDragStartCourse(c)}
                  onDragEnd={onDragEndCourse}
                >
                  <Typography variant="caption" sx={{ minWidth: 80 }}>{c}</Typography>
                  <TextField size="small" type="number" inputProps={{ min: 0, max: 10 }} sx={{ width: 72 }}
                    value={selectedSubjects[c] || ''}
                    onChange={(e) => setSelectedSubjects((prev) => ({ ...prev, [c]: Math.max(0, Math.min(10, parseInt(e.target.value || '0'))) }))}
                    placeholder="saat" />
                  <IconButton size="small" onClick={() => adjustSubjectHours(c, -1)} disabled={(selectedSubjects[c] || 0) <= 0}>
                    <Remove fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => adjustSubjectHours(c, 1)} disabled={(selectedSubjects[c] || 0) >= 10}>
                    <Add fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => { setCourseList(l => l.filter(x => x !== c)); setSelectedSubjects(prev => { const cp = { ...prev }; delete cp[c]; return cp }) }} color="error">
                    <Cancel fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              {courseList.length === 0 && (
                <Typography variant="caption" color="text.secondary">Henüz ders eklenmedi</Typography>
              )}
            </Stack>
            {draggingCourse && (
            <Box onDragOver={allowDrop} onDrop={(e) => { e.preventDefault(); dropToTrash() }}
                sx={{ mt: 1, p: 1, border: '2px dashed', borderColor: 'error.main', color: 'error.main', borderRadius: 1, textAlign: 'center' }}>
                Bırak to remove: {draggingCourse}
              </Box>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mt: 1 }}>
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
                  <IconButton size="small" onClick={() => adjustSubjectHours(s, -1)} disabled={(selectedSubjects[s] || 0) <= 0}>
                    <Remove fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => adjustSubjectHours(s, 1)} disabled={(selectedSubjects[s] || 0) >= 10}>
                    <Add fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>
          {/* Ders Ekle bölümü lise derslerinin altına taşındı */}
          <Box>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Ders Ekle</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ my: 1 }}>
              {courseList.map(c => (
                <Stack key={c} direction="row" spacing={1} alignItems="center" sx={{ p: 1, my: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                  draggable
                  onDragStart={() => onDragStartCourse(c)}
                  onDragEnd={onDragEndCourse}
                >
                  <Typography variant="caption" sx={{ minWidth: 80 }}>{c}</Typography>
                  <TextField size="small" type="number" inputProps={{ min: 0, max: 10 }} sx={{ width: 72 }}
                    value={selectedSubjects[c] || ''}
                    onChange={(e) => setSelectedSubjects((prev) => ({ ...prev, [c]: Math.max(0, Math.min(10, parseInt(e.target.value || '0'))) }))}
                    placeholder="saat" />
                  <IconButton size="small" onClick={() => adjustSubjectHours(c, -1)} disabled={(selectedSubjects[c] || 0) <= 0}>
                    <Remove fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => adjustSubjectHours(c, 1)} disabled={(selectedSubjects[c] || 0) >= 10}>
                    <Add fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => { setCourseList(l => l.filter(x => x !== c)); setSelectedSubjects(prev => { const cp = { ...prev }; delete cp[c]; return cp }) }} color="error">
                    <Cancel fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              {courseList.length === 0 && (
                <Typography variant="caption" color="text.secondary">Henüz ders eklenmedi</Typography>
              )}
            </Stack>
            {draggingCourse && (
              <Box onDragOver={allowDrop} onDrop={(e) => { e.preventDefault(); dropToTrash() }}
                  sx={{ mt: 1, p: 1, border: '2px dashed', borderColor: 'error.main', color: 'error.main', borderRadius: 1, textAlign: 'center' }}>
                  Bırak to remove: {draggingCourse}
                </Box>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mt: 1 }}>
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
          </Box>
          {/* Müsait Günler kaldırıldı: grid üzerinden belirleniyor */}
          {avg !== null && (
            <Typography variant="caption" color="text.secondary">Quiz ortalaması: {avg} — {avg < 50 ? 'Sarı saatlerde de ders planlanabilir' : 'Yalnızca yeşil saatler kullanılacak'}</Typography>
          )}
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" onClick={handleGenerate}>AI ile Program Öner</Button>
            <Button variant="outlined" onClick={autoPlace}>Otomatik Yerleştir</Button>
            {schedule.length > 0 && (
              <Button variant="contained" color="success" onClick={saveSchedule} startIcon={<Save />}>
                Programı Kaydet
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>
      
      {/* Saved Schedules Section */}
      {savedSchedules.length > 0 && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>Kaydedilmiş Ders Programları</Typography>
          <Stack spacing={2}>
            {savedSchedules.map((savedSchedule, index) => {
              const sched = savedSchedule.schedule?.schedule || []
              const cellMap: Record<string, string> = {}
              for (const d of sched) {
                for (const it of d.items || []) {
                  const m = it.match(/(\d{2}):00-(\d{2}):00$/)
                  if (m) {
                    const start = parseInt(m[1])
                    const end = parseInt(m[2])
                    const course = it.replace(/\s\d{2}:00-\d{2}:00$/, '')
                    for (let h = start; h < end; h++) {
                      cellMap[`${d.day}-${h}`] = course
                    }
                  }
                }
              }
              return (
                <Box key={index} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">{savedSchedule.title || `Ders Programı ${index + 1}`}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(savedSchedule.created_at || savedSchedule.schedule?.createdAt).toLocaleDateString('tr-TR')}
                    </Typography>
                  </Stack>
                  <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider', fontWeight: 600 }}>Saat</TableCell>
                        {days.map((d, i) => (
                          <TableCell key={d} sx={{ borderRight: i < days.length - 1 ? '1px solid' : 'none', borderColor: 'divider', fontWeight: 600 }}>{d}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {hours.map(h => (
                        <TableRow key={h}>
                          <TableCell sx={{ fontWeight: 600, borderRight: '1px solid', borderColor: 'divider' }}>{String(h).padStart(2,'0')}:00</TableCell>
                          {days.map((d, i) => (
                            <TableCell key={`${d}-${h}`} sx={{ borderRight: i < days.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>{cellMap[`${d}-${h}`] || ''}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )
            })}
          </Stack>
        </Paper>
      )}
    </Box>
  )
}

export default StudySchedule


