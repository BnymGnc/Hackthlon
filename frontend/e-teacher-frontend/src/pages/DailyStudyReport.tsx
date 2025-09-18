import { Typography, Paper, Box, Button, Stack, Grid, Alert, Chip, TextField, IconButton, FormControl, InputLabel, Select, MenuItem, Divider, LinearProgress, Card, CardContent } from '@mui/material'
import { useState, useEffect } from 'react'
import { Add, Remove, Save, BarChart, CalendarToday, Schedule } from '@mui/icons-material'
import api from '../lib/api'

interface StudySession {
  id: string
  subject: string
  startTime: string
  endTime: string
  productivity: number // 1-10 scale
  notes: string
}

interface DailyReport {
  date: string
  sessions: StudySession[]
  totalHours: number
  averageProductivity: number
  aiAnalysis: string
}

interface StudySchedule {
  day: string
  items: string[]
}

function DailyStudyReport() {
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [newSession, setNewSession] = useState<Omit<StudySession, 'id' | 'notes'>>({
    subject: '',
    startTime: '09:00',
    endTime: '10:00',
    productivity: 5
  })
  const [sessionNotes, setSessionNotes] = useState<string>('')
  const [aiAnalysis, setAiAnalysis] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [productivityInput, setProductivityInput] = useState<string>('')
  const [dailySchedule, setDailySchedule] = useState<StudySchedule | null>(null)
  const [savedSchedules, setSavedSchedules] = useState<any[]>([])

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
      // Load daily schedule for the current day
      await loadDailySchedule()
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
      setSavedSchedules(data.schedules || [])
      // Load daily schedule for the current day
      await loadDailySchedule()
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
    if (!dailySchedule || !dailySchedule.items || dailySchedule.items.length === 0) return
    const inferred: StudySession[] = []
    for (const it of dailySchedule.items) {
      try {
        const parts = it.split(' ')
        const timePart = parts[parts.length - 1]
        const subject = parts.slice(0, -1).join(' ')
        const [startTime, endTime] = timePart.split('-')
        inferred.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          subject,
          startTime,
          endTime,
          productivity: 5,
          notes: ''
        })
      } catch {}
    }
    if (inferred.length) setSessions(inferred)
  }

  const handleAddSession = () => {
    if (!newSession.subject.trim()) {
      setError('Lütfen ders adı girin')
      return
    }

    const session: StudySession = {
      ...newSession,
      id: Date.now().toString(),
      notes: sessionNotes
    }

    setSessions([...sessions, session])
    setNewSession({
      subject: '',
      startTime: '09:00',
      endTime: '10:00',
      productivity: 5
    })
    setSessionNotes('')
    setError(null)
  }

  const handleRemoveSession = (id: string) => {
    setSessions(sessions.filter(session => session.id !== id))
  }

  const handleSaveReport = async () => {
    try {
      setLoading(true)
      const payload = {
        date: currentDate,
        sessions: sessions
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
    if (sessions.length === 0) {
      setError('Analiz için en az bir çalışma oturumu ekleyin')
      return
    }

    // Check if user has provided productivity score and notes
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
    return sessions.reduce((total, session) => {
      const [startHour, startMinute] = session.startTime.split(':').map(Number)
      const [endHour, endMinute] = session.endTime.split(':').map(Number)
      const duration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
      return total + (duration / 60)
    }, 0)
  }

  const calculateAverageProductivity = () => {
    if (sessions.length === 0) return 0
    const total = sessions.reduce((sum, session) => sum + session.productivity, 0)
    return Math.round((total / sessions.length) * 10) / 10
  }

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString)
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    return days[date.getDay()]
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Günlük Çalışma Raporu</Typography>
      <Paper sx={{ p: 3, mb: 3 }}>
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

          {/* Daily Schedule Section */}
          {dailySchedule && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  <Schedule sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Bugün için Planlanan Dersler ({dailySchedule.day})
                </Typography>
                {dailySchedule.items.length > 0 ? (
                  <Stack spacing={1}>
                    {dailySchedule.items.map((item, index) => (
                      <Chip 
                        key={index} 
                        label={item} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                      />
                    ))}
                    <Button size="small" variant="outlined" onClick={importTodayPlan} sx={{ alignSelf: 'start' }}>
                      Planı Oturumlara Aktar
                    </Button>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Bugün için planlanmış ders bulunmamaktadır.
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}

          {/* Add new session form */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Yeni Çalışma Oturumu Ekle</Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="Ders"
                  value={newSession.subject}
                  onChange={(e) => setNewSession({...newSession, subject: e.target.value})}
                />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField
                  fullWidth
                  type="time"
                  label="Başlangıç"
                  InputLabelProps={{ shrink: true }}
                  value={newSession.startTime}
                  onChange={(e) => setNewSession({...newSession, startTime: e.target.value})}
                />
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField
                  fullWidth
                  type="time"
                  label="Bitiş"
                  InputLabelProps={{ shrink: true }}
                  value={newSession.endTime}
                  onChange={(e) => setNewSession({...newSession, endTime: e.target.value})}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth>
                  <InputLabel>Verimlilik (1-10)</InputLabel>
                  <Select
                    value={newSession.productivity}
                    label="Verimlilik (1-10)"
                    onChange={(e) => setNewSession({...newSession, productivity: Number(e.target.value)})}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <MenuItem key={num} value={num}>{num}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notlar (isteğe bağlı)"
                  multiline
                  minRows={2}
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Bugünkü çalışmayla ilgili notlarınızı buraya yazabilirsiniz..."
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Günlük Verimlilik Puanı (1-10)"
                  value={productivityInput}
                  onChange={(e) => setProductivityInput(e.target.value)}
                  placeholder="Bugünkü genel verimliliğinizi puanlayın"
                  type="number"
                  InputProps={{ inputProps: { min: 1, max: 10 } }}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAddSession}
                >
                  Çalışma Oturumu Ekle
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Session list */}
          {sessions.length > 0 ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>Çalışma Oturumları</Typography>
              <Stack spacing={2}>
                {sessions.map((session) => (
                  <Paper key={session.id} variant="outlined" sx={{ p: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={3}>
                        <Typography variant="subtitle1">{session.subject}</Typography>
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <Chip label={`${session.startTime} - ${session.endTime}`} size="small" />
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <Chip 
                          label={`Verim: ${session.productivity}/10`} 
                          size="small" 
                          color={session.productivity >= 7 ? "success" : session.productivity >= 4 ? "warning" : "error"}
                        />
                      </Grid>
                      <Grid item xs={10} sm={4}>
                        <Typography variant="body2" color="text.secondary">
                          {session.notes || "Not eklenmemiş"}
                        </Typography>
                      </Grid>
                      <Grid item xs={2} sm={1}>
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => handleRemoveSession(session.id)}
                        >
                          <Remove />
                        </IconButton>
                      </Grid>
                    </Grid>
                    {/* Productivity visualization */}
                    <Box sx={{ mt: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={session.productivity * 10} 
                        color={session.productivity >= 7 ? "success" : session.productivity >= 4 ? "warning" : "error"}
                      />
                    </Box>
                  </Paper>
                ))}
              </Stack>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Henüz çalışma oturumu eklenmemiş
            </Typography>
          )}

          {/* Summary */}
          {sessions.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Toplam Çalışma Süresi</Typography>
                  <Typography variant="h6">{calculateTotalHours().toFixed(1)} saat</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Ortalama Verimlilik</Typography>
                  <Typography variant="h6">{calculateAverageProductivity()}/10</Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={calculateAverageProductivity() * 10} 
                    color={calculateAverageProductivity() >= 7 ? "success" : calculateAverageProductivity() >= 4 ? "warning" : "error"}
                  />
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Messages */}
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {success && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}

          {/* Action buttons */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSaveReport}
              disabled={loading || sessions.length === 0}
            >
              {loading ? 'Kaydediliyor...' : 'Raporu Kaydet'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<BarChart />}
              onClick={handleAnalyzeWithAI}
              disabled={loading || sessions.length === 0}
            >
              {loading ? 'Analiz Ediliyor...' : 'AI ile Analiz Et'}
            </Button>
          </Stack>

          {/* AI Analysis */}
          {aiAnalysis && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>AI Analizi</Typography>
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