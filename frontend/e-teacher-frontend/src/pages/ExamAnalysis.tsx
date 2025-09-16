import { Typography, Paper, Box, TextField, Button, Stack, Grid, MenuItem, Alert } from '@mui/material'
import { useState } from 'react'
import api from '../lib/api'

function ExamAnalysis() {
  const [examType, setExamType] = useState<'TYT' | 'AYT'>('TYT')
  const [subjects, setSubjects] = useState<Array<{ name: string; net: number; blank: number; wrong: number }>>([
    { name: 'Türkçe', net: 0, blank: 0, wrong: 0 },
    { name: 'Matematik', net: 0, blank: 0, wrong: 0 },
    { name: 'Fen', net: 0, blank: 0, wrong: 0 },
    { name: 'Sosyal', net: 0, blank: 0, wrong: 0 },
  ])
  const [goals, setGoals] = useState('Hedef: netleri artırmak, özellikle matematik ve fen')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ topics_to_focus: string[]; study_plan: string[]; tips: string[] } | null>(null)

  function updateSubject(idx: number, field: 'name' | 'net' | 'blank' | 'wrong', value: string) {
    setSubjects((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: field === 'name' ? value : Number(value || 0) } : s))
  }

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload = { exam_type: examType, subjects, goals }
      const { data } = await api.post('/api/ai/exam-analysis/', payload)
      setResult({
        topics_to_focus: data.topics_to_focus || [],
        study_plan: data.study_plan || [],
        tips: data.tips || [],
      })
    } catch (e: any) {
      setError('Analiz başarısız. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Sınav Sonucu Analizi</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">TYT/AYT için ders bazlı net, boş ve yanlışlarını gir; çalışma önerileri al.</Typography>
          <TextField select label="Sınav Türü" value={examType} onChange={(e) => setExamType(e.target.value as 'TYT' | 'AYT')} sx={{ maxWidth: 240 }}>
            <MenuItem value="TYT">TYT</MenuItem>
            <MenuItem value="AYT">AYT</MenuItem>
          </TextField>
          <Grid container spacing={2}>
            {subjects.map((s, idx) => (
              <Grid item xs={12} md={6} key={idx}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1}>
                    <TextField label="Ders" value={s.name} onChange={(e) => updateSubject(idx, 'name', e.target.value)} />
                    <Grid container spacing={1}>
                      <Grid item xs={4}><TextField label="Net" type="number" value={s.net} onChange={(e) => updateSubject(idx, 'net', e.target.value)} fullWidth /></Grid>
                      <Grid item xs={4}><TextField label="Boş" type="number" value={s.blank} onChange={(e) => updateSubject(idx, 'blank', e.target.value)} fullWidth /></Grid>
                      <Grid item xs={4}><TextField label="Yanlış" type="number" value={s.wrong} onChange={(e) => updateSubject(idx, 'wrong', e.target.value)} fullWidth /></Grid>
                    </Grid>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <TextField label="Hedefler / Notlar" multiline minRows={2} value={goals} onChange={(e) => setGoals(e.target.value)} />
          <Button variant="contained" onClick={handleAnalyze} disabled={loading}>Analiz Et</Button>
          {error && <Alert severity="error">{error}</Alert>}
          {result && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1">Öncelikli Konular</Typography>
                  <ul>{result.topics_to_focus.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1">Çalışma Planı</Typography>
                  <ul>{result.study_plan.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle1">İpuçları</Typography>
                  <ul>{result.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </Paper>
              </Grid>
            </Grid>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}

export default ExamAnalysis


