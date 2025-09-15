import { Typography, Paper, Box, TextField, Button, Stack, LinearProgress } from '@mui/material'

function StudyReports() {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Kişisel Çalışma Raporları</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">Çalışma alışkanlıklarını gir; güçlü ve zayıf yönlerini özetleyelim.</Typography>
          <TextField label="Tarih" type="date" InputLabelProps={{ shrink: true }} />
          <TextField label="Çalışma Notları / Saatler" multiline minRows={3} fullWidth />
          <Stack spacing={1}>
            <Typography variant="overline">Matematik</Typography>
            <LinearProgress variant="determinate" value={72} />
            <Typography variant="overline">Fizik</Typography>
            <LinearProgress variant="determinate" value={55} />
          </Stack>
          <Button variant="contained">Rapor Oluştur</Button>
        </Stack>
      </Paper>
    </Box>
  )
}

export default StudyReports


