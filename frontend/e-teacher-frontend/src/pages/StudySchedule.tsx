import { Typography, Paper, Box, TextField, Button, Stack, Grid, Alert } from '@mui/material'
import { useState } from 'react'
import api from '../lib/api'

function StudySchedule() {
  const [courses, setCourses] = useState('')
  const [availability, setAvailability] = useState('')
  const [schedule, setSchedule] = useState<{ day: string, items: string[] }[]>([])
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setError(null)
    try {
      const { data } = await api.post('/api/ai/schedule/', { courses, availability })
      setSchedule(data.schedule || [])
    } catch (e) {
      setError('Program oluşturulamadı')
    }
  }
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Ders Programı Önerisi</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">Mevcut ders yükünü ve müsait saatlerini gir; verimli bir program oluşturalım.</Typography>
          <TextField label="Mevcut Dersler" multiline minRows={2} fullWidth value={courses} onChange={(e) => setCourses(e.target.value)} />
          <TextField label="Müsait Saatler" multiline minRows={2} fullWidth value={availability} onChange={(e) => setAvailability(e.target.value)} />
          <Grid container spacing={1} columns={7} sx={{ mt: 1 }}>
            {['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map((d) => (
              <Grid key={d} item xs={1}>
                <Paper variant="outlined" sx={{ p: 1, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 0.5 }}>
                  <strong>{d}</strong>
                  {schedule.find(s => s.day === d)?.items?.map((it, idx) => (
                    <Typography key={idx} variant="caption" color="text.secondary">{it}</Typography>
                  ))}
                </Paper>
              </Grid>
            ))}
          </Grid>
          {error && <Alert severity="error">{error}</Alert>}
          <Button variant="contained" onClick={handleGenerate}>Program Oluştur</Button>
        </Stack>
      </Paper>
    </Box>
  )
}

export default StudySchedule


