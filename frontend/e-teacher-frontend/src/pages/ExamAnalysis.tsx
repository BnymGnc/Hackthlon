import { Typography, Paper, Box, TextField, Button, Stack, MenuItem, Alert, FormControl, InputLabel, Select } from '@mui/material'
import { useState, useEffect } from 'react'
import api from '../lib/api'

function ExamAnalysis() {
  const [examType, setExamType] = useState<'TYT' | 'AYT'>('TYT')
  const [subjects, setSubjects] = useState<Array<{ name: string; dogru: number; blank: number; wrong: number }>>([
    { name: 'Türkçe', dogru: 0, blank: 0, wrong: 0 },
    { name: 'Matematik', dogru: 0, blank: 0, wrong: 0 },
    { name: 'Fen', dogru: 0, blank: 0, wrong: 0 },
    { name: 'Sosyal', dogru: 0, blank: 0, wrong: 0 },
  ])
  const [aytTrack, setAytTrack] = useState<'Sayısal' | 'Sözel' | 'Eşit Ağırlık'>('Sayısal')
  const [goals, setGoals] = useState('Hedef: netleri artırmak, özellikle matematik ve fen')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ topics_to_focus: string[]; study_plan: string[]; tips: string[] } | null>(null)

  function presetAytSubjects(track: 'Sayısal' | 'Sözel' | 'Eşit Ağırlık') {
    if (track === 'Sayısal') {
      setSubjects([
        { name: 'Matematik', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Fizik', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Kimya', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Biyoloji', dogru: 0, blank: 0, wrong: 0 },
      ])
    } else if (track === 'Sözel') {
      setSubjects([
        { name: 'Edebiyat', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Tarih', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Coğrafya', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Felsefe / Din', dogru: 0, blank: 0, wrong: 0 },
      ])
    } else {
      setSubjects([
        { name: 'Edebiyat', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Coğrafya', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Matematik', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Tarih', dogru: 0, blank: 0, wrong: 0 },
      ])
    }
  }

  // Preset subjects when exam type or track changes
  useEffect(() => {
    if (examType === 'TYT') {
      setSubjects([
        { name: 'Türkçe', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Matematik', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Fen', dogru: 0, blank: 0, wrong: 0 },
        { name: 'Sosyal', dogru: 0, blank: 0, wrong: 0 },
      ])
    } else {
      presetAytSubjects(aytTrack)
    }
  }, [examType])

  useEffect(() => {
    if (examType === 'AYT') presetAytSubjects(aytTrack)
  }, [aytTrack, examType])

  function getSubjectLimit(name: string): number {
    if (examType === 'AYT') {
      if (aytTrack === 'Sayısal') {
        if (name === 'Fizik') return 14
        if (name === 'Kimya') return 13
        if (name === 'Biyoloji') return 13
        if (name === 'Matematik') return 40
        return 40
      }
      if (aytTrack === 'Sözel') {
        if (name === 'Edebiyat') return 24
        if (name === 'Tarih') return 21
        if (name === 'Coğrafya') return 17
        if (name === 'Felsefe / Din') return 18
        return 40
      }
      // Eşit Ağırlık
      if (name === 'Matematik') return 40
      if (name === 'Edebiyat') return 24
      if (name === 'Tarih') return 10
      if (name === 'Coğrafya') return 6
      return 40
    }
    // TYT
    if (name === 'Türkçe' || name === 'Matematik') return 40
    return 20
  }

  function updateSubject(idx: number, field: 'dogru' | 'blank' | 'wrong', value: string) {
    setSubjects((prev) => prev.map((s, i) => {
      if (i !== idx) return s
      const limit = getSubjectLimit(s.name)
      const v = Math.max(0, Number(value || 0))
      let dogru = s.dogru
      let blank = s.blank
      let wrong = s.wrong
      if (field === 'dogru') dogru = v
      if (field === 'blank') blank = v
      if (field === 'wrong') wrong = v
      // enforce total <= limit
      const total = dogru + blank + wrong
      if (total > limit) {
        const overflow = total - limit
        // reduce the edited field by overflow, not below 0
        if (field === 'dogru') dogru = Math.max(0, dogru - overflow)
        if (field === 'blank') blank = Math.max(0, blank - overflow)
        if (field === 'wrong') wrong = Math.max(0, wrong - overflow)
      }
      return { ...s, dogru, blank, wrong }
    }))
  }

  const computedNets = subjects.map(s => ({ name: s.name, net: Math.max(0, s.dogru - (s.wrong / 4)) }))
  const totalNet = computedNets.reduce((a, b) => a + (b.net || 0), 0)

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const payload = { exam_type: examType, subjects: computedNets, goals }
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
      <Typography variant="h5" gutterBottom>Deneme Analizi</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">TYT/AYT için ders bazlı doğru, boş ve yanlışlarını gir; netleri otomatik hesaplayalım.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <TextField select label="Sınav Türü" value={examType} onChange={(e) => setExamType(e.target.value as 'TYT' | 'AYT')} sx={{ minWidth: 200 }}>
              <MenuItem value="TYT">TYT</MenuItem>
              <MenuItem value="AYT">AYT</MenuItem>
            </TextField>
            {examType === 'AYT' && (
              <FormControl sx={{ minWidth: 220 }}>
                <InputLabel>AYT Alan</InputLabel>
                <Select
                  label="AYT Alan"
                  value={aytTrack}
                  onChange={(e) => { const val = e.target.value as 'Sayısal' | 'Sözel' | 'Eşit Ağırlık'; setAytTrack(val); }}
                >
                  <MenuItem value="Sayısal">Sayısal</MenuItem>
                  <MenuItem value="Sözel">Sözel</MenuItem>
                  <MenuItem value="Eşit Ağırlık">Eşit Ağırlık</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr' }, width: '100%' }}>
            {subjects.map((s, idx) => (
              <Box key={idx} sx={{ width: '100%' }}>
                <Paper variant="outlined" sx={{ p: 3, width: '100%', overflow: 'hidden', borderRadius: 2 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{s.name}</Typography>
                    <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
                      <TextField label="Doğru" type="number" value={s.dogru} onChange={(e) => updateSubject(idx, 'dogru', e.target.value)} fullWidth />
                      <TextField label="Boş" type="number" value={s.blank} onChange={(e) => updateSubject(idx, 'blank', e.target.value)} fullWidth />
                      <TextField label="Yanlış" type="number" value={s.wrong} onChange={(e) => updateSubject(idx, 'wrong', e.target.value)} fullWidth />
                    </Box>
                    <Typography variant="caption" color="text.secondary">Toplam: {s.dogru + s.blank + s.wrong} / {getSubjectLimit(s.name)} — Net: {computedNets[idx]?.net.toFixed(2)}</Typography>
                  </Stack>
                </Paper>
              </Box>
            ))}
          </Box>
          <Typography variant="subtitle2">Toplam Net: {totalNet.toFixed(2)}</Typography>
          <TextField label="Hedefler / Notlar" multiline minRows={2} value={goals} onChange={(e) => setGoals(e.target.value)} />
          <Button variant="contained" onClick={handleAnalyze} disabled={loading}>Analiz Et</Button>
          {error && <Alert severity="error">{error}</Alert>}
          {result && (
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, width: '100%' }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1">Öncelikli Konular</Typography>
                <ul>{result.topics_to_focus.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1">Çalışma Planı</Typography>
                <ul>{result.study_plan.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1">İpuçları</Typography>
                <ul>{result.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </Paper>
            </Box>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}

export default ExamAnalysis


