import { Typography, Paper, Box, TextField, Button, Stack, LinearProgress, Alert } from '@mui/material'
import { useState } from 'react'
import api from '../lib/api'

function StudyReports() {
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [metrics, setMetrics] = useState<{ [k: string]: number }>({ math: 72, physics: 55 })
  const [summary, setSummary] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setError(null)
    try {
      const { data } = await api.post('/api/ai/report/', { date, notes })
      setSummary(data.summary)
      setMetrics(data.metrics)
    } catch (e) {
      setError('Rapor oluşturulamadı')
    }
  }
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Kişisel Çalışma Raporları</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">Çalışma alışkanlıklarını gir; güçlü ve zayıf yönlerini özetleyelim.</Typography>
          <TextField label="Tarih" type="date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
          <TextField label="Çalışma Notları / Saatler" multiline minRows={3} fullWidth value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Stack spacing={1}>
            {Object.entries(metrics).map(([k, v]) => (
              <Box key={k}>
                <Typography variant="overline">{k}</Typography>
                <LinearProgress variant="determinate" value={v} />
              </Box>
            ))}
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
          <Button variant="contained" onClick={handleGenerate}>Rapor Oluştur</Button>
          {summary && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1">Özet</Typography>
              <Typography variant="body2" color="text.secondary">{summary}</Typography>
            </Paper>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}

export default StudyReports


