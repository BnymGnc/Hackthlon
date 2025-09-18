import { Typography, Paper, Box, Button, Stack, Alert, TextField, Divider, Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material'
import { useState, useEffect } from 'react'
import { Save, BarChart, CalendarToday, Schedule } from '@mui/icons-material'
import api from '../lib/api'

interface StudySession {
  id: string
  subject: string
  durationHours: number
  notes: string
}

// removed unused DailyReport interface

interface StudySchedule {
  day: string
  items: string[]
}

function DailyStudyReport() {
  const currentDate = new Date().toISOString().split('T')[0]
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [sessionNotes, setSessionNotes] = useState<string>('')
  const [aiAnalysis, setAiAnalysis] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [productivityInput, setProductivityInput] = useState<string>('')
  const [totalHoursInput, setTotalHoursInput] = useState<string>('')
  const [dailySchedule, setDailySchedule] = useState<StudySchedule | null>(null)
  const [savedSchedules, setSavedSchedules] = useState<any[]>([])
  function inferSessionsFromSchedule(scheduleForDay: StudySchedule | null) {
    if (!scheduleForDay || !scheduleForDay.items || scheduleForDay.items.length === 0) {
      setSessions([])
      return
    }
    const inferred: StudySession[] = []
    for (const it of scheduleForDay.items) {
      try {
        const parts = it.split(' ')
        const timePart = parts[parts.length - 1]
        const subject = parts.slice(0, -1).join(' ')
        const [startStr, endStr] = timePart.split('-')
        const [sH, sM] = startStr.split(':').map(Number)
        const [eH, eM] = endStr.split(':').map(Number)
        const minutes = (eH * 60 + eM) - (sH * 60 + sM)
        const dur = Math.max(0.5, Math.round((minutes / 60) * 2) / 2)
        inferred.push({ id: Date.now().toString() + Math.random().toString(36).slice(2), subject, durationHours: dur, notes: '' })
      } catch {}
    }
    setSessions(inferred)
  }

  useEffect(() => {
    loadDailyReport()
    loadSavedSchedules()
  }, [currentDate])

  const loadDailyReport = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/api/ai/daily-report/${currentDate}/`)
      if (data.sessions) {
        setSessions(data.sessions)
        setAiAnalysis(data.aiAnalysis || '')
      } else {
        // Initialize empty report for the day
        setSessions([])
        setAiAnalysis('')
      }
    } catch (e) {
      console.error('Error loading daily report:', e)
      setSessions([])
      setAiAnalysis('')
    } finally {
      setLoading(false)
    }
  }

  const loadSavedSchedules = async () => {
    try {
      const { data } = await api.get('/api/ai/schedule/save/')
      const latest = data.schedule || null
      setSavedSchedules(latest ? [latest] : [])
      // compute today's schedule immediately to avoid state race
      const date = new Date(currentDate)
      const dayOfWeek = date.getDay()
      const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
      const dayName = days[dayOfWeek]
      const schedArr = latest?.schedule?.schedule || []
      const daySchedule = Array.isArray(schedArr) ? schedArr.find((d: any) => d.day === dayName) : null
      setDailySchedule(daySchedule || null)
      inferSessionsFromSchedule(daySchedule || null)
    } catch (e) {
      console.log('Could not load saved schedules')
    }
  }

  const loadDailySchedule = async () => {
    try {
      // Get day of week (0=Sunday, 1=Monday, etc.)
      const date = new Date(currentDate)
      const dayOfWeek = date.getDay()
      const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
      const dayName = days[dayOfWeek]
      
      // Find the schedule for this day
      if (savedSchedules.length > 0) {
        const latestSchedule = savedSchedules[0] // Get the most recent saved schedule
        if (latestSchedule.schedule && latestSchedule.schedule.schedule) {
          const daySchedule = latestSchedule.schedule.schedule.find((d: any) => d.day === dayName)
          setDailySchedule(daySchedule || null)
        }
      }
    } catch (e) {
      console.log('Could not load daily schedule')
    }
  }

  const importTodayPlan = () => {
    // kept for compatibility, now uses inferSessionsFromSchedule
    inferSessionsFromSchedule(dailySchedule)
  }

  // manual add/remove disabled

  const handleSaveReport = async () => {
    try {
      setLoading(true)
      const payload = {
        date: currentDate,
        sessions: sessions,
        totalHours: calculateTotalHours(),
        productivityScore: Number(productivityInput) || undefined,
        notes: sessionNotes
      }

      await api.post('/api/ai/daily-report/save/', payload)
      setSuccess('Günlük çalışma raporu başarıyla kaydedildi')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError('Rapor kaydedilirken hata oluştu')
      console.error('Error saving report:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeWithAI = async () => {
    if (sessions.length === 0 && dailySchedule && dailySchedule.items?.length) {
      inferSessionsFromSchedule(dailySchedule)
    }
    if (sessions.length === 0) {
      setError('Analiz için bugünün planı bulunamadı')
      return
    }

    // Check if user has provided daily productivity score
    if (!productivityInput.trim()) {
      setError('Lütfen günlük verimlilik puanınızı girin (1-10 arası)')
      return
    }

    try {
      setLoading(true)
      
      // Combine session data with user input for AI analysis
      const payload = {
        date: currentDate,
        sessions: sessions,
        productivityScore: parseInt(productivityInput),
        dailyNotes: sessionNotes
      }

      const { data } = await api.post('/api/ai/daily-report/analyze/', payload)
      setAiAnalysis(data.analysis)
      setSuccess('AI analizi tamamlandı')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError('AI analizi yapılırken hata oluştu')
      console.error('Error analyzing with AI:', e)
    } finally {
      setLoading(false)
    }
  }

  const calculateTotalHours = () => {
    const manual = parseFloat(totalHoursInput)
    if (!isNaN(manual) && manual >= 0) return manual
    return sessions.reduce((total, session) => total + Number(session.durationHours || 0), 0)
  }

  const calculateAverageProductivity = () => {
    const p = Number(productivityInput)
    if (!p || p < 1) return 0
    return Math.round(p * 10) / 10
  }

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString)
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    return days[date.getDay()]
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Günlük Çalışma Raporu</Typography>
      <Paper sx={{ p: 4, mb: 3, borderRadius: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" gutterBottom>
              <CalendarToday sx={{ mr: 1, verticalAlign: 'middle' }} />
              {getDayOfWeek(currentDate)} - Bugün
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {new Date(currentDate).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
          </Box>

      {/* üstteki tekrar eden program bölümü kaldırıldı */}
      <Divider sx={{ my: 1 }} />

          {/* Inputs side-card */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' }, gap: 3 }}>
            <Box>
              {dailySchedule && (
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
                      <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Bugün için Planlanan Dersler ({dailySchedule.day})
                    </Typography>
                    {dailySchedule.items.length > 0 ? (
                      <Table size="small" sx={{ mt: 1, borderCollapse: 'separate', borderSpacing: 0 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600, width: 140, borderRight: '1px solid', borderColor: 'divider' }}>Saat</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Ders</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dailySchedule.items.map((item, index) => {
                            const parts = item.split(' ')
                            const timePart = parts[parts.length - 1]
                            const subject = parts.slice(0, -1).join(' ')
                            return (
                              <TableRow key={index}>
                                <TableCell sx={{ borderRight: '1px solid', borderColor: 'divider' }}>{timePart}</TableCell>
                                <TableCell>{subject}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <Typography variant="body2" color="text.secondary">Bugün için planlanmış ders bulunmamaktadır.</Typography>
                    )}
                  </CardContent>
                </Card>
              )}
            </Box>
            <Box>
              <Card variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>Günlük Girdi</Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Toplam Çalışma Süresi (saat)"
                      value={totalHoursInput}
                      onChange={(e) => setTotalHoursInput(e.target.value)}
                      type="number"
                      InputProps={{ inputProps: { min: 0, step: 0.5 } }}
                      placeholder="Örn: 5.5"
                    />
                    <TextField
                      fullWidth
                      label="Günlük Verimlilik Puanı (1-10)"
                      value={productivityInput}
                      onChange={(e) => setProductivityInput(e.target.value)}
                      type="number"
                      InputProps={{ inputProps: { min: 1, max: 10 } }}
                      placeholder="Bugünkü genel verimlilik"
                    />
                    <TextField
                      fullWidth
                      label="Günlük Notlar"
                      multiline
                      minRows={5}
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      placeholder="Bugün nasıl geçti? Zorlandığın konu, motivasyon, vb."
                    />
                    {/* Butonlar alta taşındı */}
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {/* Summary */}
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Box>
                <Typography variant="subtitle2">Toplam Çalışma Süresi</Typography>
                <Typography variant="h6">{calculateTotalHours().toFixed(1)} saat</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2">Genel Günlük Verimlilik</Typography>
                <Typography variant="h6">{calculateAverageProductivity() || '-'} / 10</Typography>
              </Box>
            </Box>
          </Paper>

          {/* Messages */}
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}

          {/* Action buttons - tek yerde, altta */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
            <Button variant="contained" startIcon={<Save />} onClick={handleSaveReport} disabled={loading || !dailySchedule || !dailySchedule.items?.length}>
              {loading ? 'Kaydediliyor...' : 'Raporu Kaydet'}
            </Button>
            <Button variant="outlined" startIcon={<BarChart />} onClick={handleAnalyzeWithAI} disabled={loading || !dailySchedule || !dailySchedule.items?.length}>
              {loading ? 'Analiz Ediliyor...' : 'AI ile Analiz Et'}
            </Button>
          </Stack>

          {/* AI Analysis */}
          {aiAnalysis && (
            <Paper variant="outlined" sx={{ p: 3, mt: 2, borderRadius: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>AI Analizi</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                {aiAnalysis}
              </Typography>
            </Paper>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}

export default DailyStudyReport