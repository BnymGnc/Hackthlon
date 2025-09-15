import { Typography, Paper, Box, TextField, Button, Stack, Stepper, Step, StepLabel, StepContent, Chip } from '@mui/material'
import { useState } from 'react'

function CareerRoadmap() {
  const steps = [
    { label: 'İlgi Alanları', desc: 'Sevdiğin dersler ve konular' },
    { label: 'Güçlü Alanlar', desc: 'Yüksek not/başarı gördüğün yerler' },
    { label: 'Hedefler', desc: 'Kısa ve uzun vadeli hedefler' },
    { label: 'Öneriler', desc: 'Meslek ve bölüm önerileri' },
  ]
  const [active, setActive] = useState(0)

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Kariyer Yol Haritası</Typography>
      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={active} orientation="vertical">
          {steps.map((s, index) => (
            <Step key={s.label}>
              <StepLabel>{s.label}</StepLabel>
              <StepContent>
                <Stack spacing={2} sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">{s.desc}</Typography>
                  {index === 0 && <TextField label="İlgi Alanları" multiline minRows={3} fullWidth />}
                  {index === 1 && <TextField label="Güçlü Olduğun Konular" multiline minRows={3} fullWidth />}
                  {index === 2 && <TextField label="Hedefler" multiline minRows={3} fullWidth />}
                  {index === 3 && (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {["Yazılım Müh.", "Veri Bilimi", "Elektrik-Elektronik", "Psikoloji"].map(t => (
                        <Chip key={t} label={t} color="primary" variant="outlined" />
                      ))}
                    </Stack>
                  )}
                  <Stack direction="row" spacing={1}>
                    <Button disabled={active === 0} onClick={() => setActive((a) => a - 1)}>Geri</Button>
                    {active < steps.length - 1 ? (
                      <Button variant="contained" onClick={() => setActive((a) => a + 1)}>İleri</Button>
                    ) : (
                      <Button variant="contained">Yol Haritasını Kaydet</Button>
                    )}
                  </Stack>
                </Stack>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Paper>
    </Box>
  )
}

export default CareerRoadmap


