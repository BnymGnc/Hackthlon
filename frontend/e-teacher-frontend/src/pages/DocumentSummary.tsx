import { Typography, Paper, Box, TextField, Button, Stack } from '@mui/material'
import { useState } from 'react'
import api from '../lib/api'

function DocumentSummary() {
  const [text, setText] = useState('')
  const [summary, setSummary] = useState('')

  async function handleSummarize() {
    try {
      const { data } = await api.post('/api/ai/summarize/', { text })
      setSummary(data.summary || '')
    } catch (e) {
      setSummary('Özetlenemedi, lütfen tekrar deneyin.')
    }
  }

  return (
    <Box sx={{ maxWidth: { xs: '100%', md: '96%', lg: 1200 }, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>Belge Özeti</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">Ders notlarını / metni yapıştır; kısa ve anlaşılır özet üretelim.</Typography>
          <Button variant="outlined" component="label">PDF Yükle<input hidden type="file" accept="application/pdf" /></Button>
          <TextField label="Metin" multiline minRows={6} fullWidth value={text} onChange={(e) => setText(e.target.value)} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Özet Uzunluğu" select SelectProps={{ native: true }} defaultValue="orta">
              <option value="kısa">Kısa</option>
              <option value="orta">Orta</option>
              <option value="uzun">Uzun</option>
            </TextField>
            <TextField label="Madde Sayısı" type="number" inputProps={{ min: 3, max: 20 }} defaultValue={5} />
          </Stack>
          <Button variant="contained" onClick={handleSummarize}>Özetle</Button>
          <Paper variant="outlined" sx={{ p: 2, minHeight: 220, transition: 'none' }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Özet</Typography>
            <Typography variant="body2" color="text.secondary">
              {summary || 'Özet burada görünecek. Metni girip Özetle butonuna basın.'}
            </Typography>
          </Paper>
        </Stack>
      </Paper>
    </Box>
  )
}

export default DocumentSummary


