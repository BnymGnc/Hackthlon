import { Typography, Paper, Box, TextField, Button, Stack, Chip } from '@mui/material'

function PsychologicalSupport() {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Psikolojik Destek</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">Duygularını veya yaşadığın zorluğu paylaş; motivasyon önerileri üretelim.</Typography>
          <Stack direction="row" spacing={1}>
            {['Stresli','Motivasyon Düşük','Kaygılı','Odak Problemi'].map(m => <Chip key={m} label={m} clickable />)}
          </Stack>
          <TextField label="Mesajın" multiline minRows={4} fullWidth />
          <Stack direction="row" spacing={1}>
            {['Nefes egzersizi', 'Pomodoro', 'Kısa yürüyüş'].map(p => <Button key={p} variant="outlined">{p}</Button>)}
          </Stack>
          <Button variant="contained">Destek Mesajı Al</Button>
        </Stack>
      </Paper>
    </Box>
  )
}

export default PsychologicalSupport


