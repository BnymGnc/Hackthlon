import React, { useState } from 'react'
import { Typography, Paper, Box, TextField, Button, Stack, Stepper, Step, StepLabel, StepContent, Chip, Alert } from '@mui/material'
import api from '../lib/api'

interface FormData {
  interests: string
  strengths: string
  goals: string
}

function CareerRoadmap() {
  const steps = [
    { label: 'İlgi Alanları', desc: 'Sevdiğin dersler ve konular' },
    { label: 'Güçlü Alanlar', desc: 'Yüksek not/başarı gördüğün yerler' },
    { label: 'Hedefler', desc: 'Kısa ve uzun vadeli hedefler' },
    { label: 'Öneriler', desc: 'Meslek ve bölüm önerileri' },
  ]

  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [savedRoadmaps, setSavedRoadmaps] = useState<any[]>([])
  const [formData, setFormData] = useState<FormData>({
    interests: '',
    strengths: '',
    goals: ''
  })

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleSaveRoadmap()
    } else {
      setActiveStep((prevStep) => prevStep + 1)
    }
  }

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1)
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveRoadmap = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data } = await api.post('/api/profiles/save_career_roadmap/', formData)
      setRecommendations(data.recommendations || [])
      try {
        const list = await api.get('/api/me/roadmaps/')
        setSavedRoadmaps(list.data || [])
      } catch {}
      
      if (activeStep < steps.length - 1) {
        setActiveStep(steps.length - 1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu')
      // Hata durumunda varsayılan öneriler göster
      setRecommendations([
        "Yazılım Mühendisliği - Teknoloji alanındaki ilginiz için uygun",
        "Veri Bilimi - Analitik düşünce yapınız için ideal", 
        "Endüstri Mühendisliği - Problem çözme becerileriniz için",
        "Psikoloji - İnsan ilişkilerindeki başarınız için"
      ])
      if (activeStep < steps.length - 1) {
        setActiveStep(steps.length - 1)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Kariyer Yol Haritası</Typography>
      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
              <StepContent>
                <Stack spacing={2} sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {step.desc}
                  </Typography>

                  {index === 0 && (
                    <TextField
                      label="İlgi Alanları"
                      multiline
                      minRows={3}
                      fullWidth
                      value={formData.interests}
                      onChange={(e) => handleInputChange('interests', e.target.value)}
                      placeholder="Örn: Matematik, teknoloji, sanat, spor..."
                    />
                  )}

                  {index === 1 && (
                    <TextField
                      label="Güçlü Olduğun Konular"
                      multiline
                      minRows={3}
                      fullWidth
                      value={formData.strengths}
                      onChange={(e) => handleInputChange('strengths', e.target.value)}
                      placeholder="Örn: Problem çözme, yaratıcılık, analitik düşünme..."
                    />
                  )}

                  {index === 2 && (
                    <TextField
                      label="Hedefler"
                      multiline
                      minRows={3}
                      fullWidth
                      value={formData.goals}
                      onChange={(e) => handleInputChange('goals', e.target.value)}
                      placeholder="Kısa vadeli ve uzun vadeli hedeflerinizi yazın..."
                    />
                  )}

                  {index === 3 && (
                    <Box>
                      {error && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          AI servisine bağlanılamadı, varsayılan öneriler gösteriliyor
                        </Alert>
                      )}
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {recommendations.length > 0 ? (
                          recommendations.map((rec, idx) => (
                            <Chip
                              key={idx}
                              label={rec}
                              color="primary"
                              variant="outlined"
                              sx={{ mb: 1 }}
                            />
                          ))
                        ) : (
                          <>
                            <Chip label="Yazılım Müh." color="primary" variant="outlined" />
                            <Chip label="Veri Bilimi" color="primary" variant="outlined" />
                            <Chip label="Elektrik-Elektronik" color="primary" variant="outlined" />
                            <Chip label="Psikoloji" color="primary" variant="outlined" />
                          </>
                        )}
                      </Stack>
                    </Box>
                  )}

                  <Stack direction="row" spacing={1}>
                    <Button
                      disabled={activeStep === 0}
                      onClick={handleBack}
                    >
                      Geri
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleNext}
                      disabled={loading}
                    >
                      {loading ? 'Kaydediliyor...' : (
                        activeStep === steps.length - 1 ? 'Yol Haritasını Kaydet' : 'İleri'
                      )}
                    </Button>
                  </Stack>
                </Stack>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Paper>
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Son Yol Haritası Özeti</Typography>
        {savedRoadmaps.length > 0 ? (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">{savedRoadmaps[0]?.goals || 'Hedefler girilmedi'}</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {(savedRoadmaps[0]?.recommendations || []).slice(0, 5).map((r: string, i: number) => (
                <Chip key={i} label={r} size="small" />
              ))}
            </Stack>
          </Paper>
        ) : (
          <Typography variant="body2" color="text.secondary">Henüz yol haritası yok.</Typography>
        )}
      </Box>
    </Box>
  )
}

export default CareerRoadmap