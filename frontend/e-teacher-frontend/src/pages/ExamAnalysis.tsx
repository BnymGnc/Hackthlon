import { Typography, Paper, Box, TextField, Button, Stack, Grid } from '@mui/material'

function ExamAnalysis() {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Sınav Sonucu Analizi</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">Netlerini ve konu dağılımını gir; hangi konulara ağırlık vermen gerektiğini önerelim.</Typography>
          <TextField label="Netler / Konular" multiline minRows={4} fullWidth />
          <Grid container spacing={1} columns={8}>
            {Array.from({ length: 24 }).map((_, i) => (
              <Grid item xs={1} key={i}>
                <Box sx={{ height: 28, bgcolor: `hsl(${(i*15)%360} 70% 50% / 0.5)`, borderRadius: 1 }} />
              </Grid>
            ))}
          </Grid>
          <Button variant="contained">Analiz Et</Button>
        </Stack>
      </Paper>
    </Box>
  )
}

export default ExamAnalysis


