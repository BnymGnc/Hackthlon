import { Typography, Paper, Box, TextField, Button, Stack, Grid } from '@mui/material'

function StudySchedule() {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Ders Programı Önerisi</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">Mevcut ders yükünü ve müsait saatlerini gir; verimli bir program oluşturalım.</Typography>
          <TextField label="Mevcut Dersler" multiline minRows={2} fullWidth />
          <TextField label="Müsait Saatler" multiline minRows={2} fullWidth />
          <Grid container spacing={1} columns={7} sx={{ mt: 1 }}>
            {['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map((d) => (
              <Grid key={d} item xs={1}>
                <Paper variant="outlined" sx={{ p: 1, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d}</Paper>
              </Grid>
            ))}
          </Grid>
          <Button variant="contained">Program Oluştur</Button>
        </Stack>
      </Paper>
    </Box>
  )
}

export default StudySchedule


