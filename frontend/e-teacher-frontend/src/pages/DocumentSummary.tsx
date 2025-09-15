import { Typography, Paper, Box, TextField, Button, Stack } from '@mui/material'

function DocumentSummary() {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Belge Özeti</Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="body1">Ders notlarını / metni yapıştır; kısa ve anlaşılır özet üretelim.</Typography>
          <Button variant="outlined" component="label">PDF Yükle<input hidden type="file" accept="application/pdf" /></Button>
          <TextField label="Metin" multiline minRows={6} fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Özet Uzunluğu" select SelectProps={{ native: true }} defaultValue="orta">
              <option value="kısa">Kısa</option>
              <option value="orta">Orta</option>
              <option value="uzun">Uzun</option>
            </TextField>
            <TextField label="Madde Sayısı" type="number" inputProps={{ min: 3, max: 20 }} defaultValue={5} />
          </Stack>
          <Button variant="contained">Özetle</Button>
        </Stack>
      </Paper>
    </Box>
  )
}

export default DocumentSummary


