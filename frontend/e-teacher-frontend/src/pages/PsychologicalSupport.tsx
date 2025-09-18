import { Typography, Paper, Box, TextField, Button, Stack, Chip, List, ListItem, ListItemText } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { useState } from 'react'
import api from '../lib/api'

function PsychologicalSupport() {
  const [mood, setMood] = useState('')
  const [message, setMessage] = useState('')
  const [support, setSupport] = useState('')
  const [history, setHistory] = useState<{ role: 'user'|'assistant', content: string }[]>([])

  async function handleSupport() {
    try {
      const { data } = await api.post('/api/ai/psych-support/', { mood, message, history })
      const reply = data.support || ''
      setSupport(reply)
      setHistory((h) => [...h, { role: 'user', content: message || mood }, { role: 'assistant', content: reply }])
    } catch (error) {
      console.error('Error getting psychological support:', error)
      setSupport('Üzgünüz, şu anda destek alınamıyor. Lütfen daha sonra tekrar deneyin.')
    }
  }
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Psikolojik Destek</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">Duygularını veya yaşadığın zorluğu paylaş; motivasyon önerileri üretelim.</Typography>
          <Stack direction="row" spacing={1}>
            {['Stresli','Motivasyon Düşük','Kaygılı','Odak Problemi'].map(m => (
              <Chip key={m} label={m} clickable onClick={() => setMood(prev => prev === m ? '' : m)} color={mood === m ? 'primary' : 'default'} />
            ))}
          </Stack>
          <TextField label="Mesajın" multiline minRows={4} fullWidth value={message} onChange={(e) => setMessage(e.target.value)} />
          <Stack direction="row" spacing={1}>
            {['Nefes egzersizi', 'Pomodoro', 'Kısa yürüyüş'].map(p => <Button key={p} variant="outlined">{p}</Button>)}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleSupport}>Destek Mesajı Al</Button>
            <Button variant="outlined" component={RouterLink} to="/chat">Sohbet Et</Button>
          </Stack>
          {history.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Sohbet</Typography>
              <List>
                {history.map((h, i) => (
                  <ListItem key={i} sx={{ py: 0.5 }}>
                    <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`${h.role === 'user' ? 'Sen' : 'E-Teacher'}: ${h.content}`} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
          {support && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1">Öneriler</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>{support}</Typography>
            </Paper>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}

export default PsychologicalSupport