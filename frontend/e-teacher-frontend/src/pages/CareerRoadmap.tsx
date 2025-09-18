import React, { useState } from 'react'
import { Typography, Paper, Box, TextField, Stack, Stepper, Step, StepLabel, StepContent, Chip, Alert, Divider, Button } from '@mui/material'
import { ExpandMore } from '@mui/icons-material'
import api from '../lib/api'

interface FormData {
  interests: string
  strengths: string
  goals: string
}

interface CareerRecommendation {
  recommendation: string
  tyt_requirement: string
  ayt_requirement: string
  subject_nets: Record<string, string>
  ranking_analysis: string
  study_tips: string[]
  daily_study_hours?: string
  weekly_plan?: string
}

function CareerRoadmap() {
  const steps = [
    { label: 'Hedef Netler', desc: 'Üniversite ve bölüm girince hedef TYT/AYT netleri otomatik gelir' },
  ]

  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<CareerRecommendation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedRoadmaps, setSavedRoadmaps] = useState<any[]>([])
  const [formData, setFormData] = useState<FormData>({
    interests: '',
    strengths: '',
    goals: ''
  })
  const [targetProfessions, setTargetProfessions] = useState<string[]>([])
  const [newProfession, setNewProfession] = useState<string>('')
  const [university, setUniversity] = useState<string>('')
  const [department, setDepartment] = useState<string>('')
  const [targetNets, setTargetNets] = useState<{ tyt?: string; ayt?: string; subject_nets?: Record<string, string> } | null>(null)
  const [perCourseAverages, setPerCourseAverages] = useState<Record<string, number>>({})

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

  const addProfession = () => {
    if (newProfession.trim() && !targetProfessions.includes(newProfession.trim())) {
      setTargetProfessions([...targetProfessions, newProfession.trim()])
      setNewProfession('')
    }
  }

  const removeProfession = (profession: string) => {
    setTargetProfessions(targetProfessions.filter(p => p !== profession))
  }

  const handleSaveRoadmap = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Only use university/department → target nets
      if (!university.trim() || !department.trim()) {
        setError('Üniversite ve bölüm giriniz')
      } else {
        try {
          const { data } = await api.post('/api/ai/target-nets/', { university: university.trim(), department: department.trim() })
          setTargetNets({ tyt: data.tyt_requirement, ayt: data.ayt_requirement, subject_nets: data.subject_nets || {} })
        setRecommendations({
            recommendation: `Hedef: ${university} - ${department}`,
            tyt_requirement: data.tyt_requirement || 'Belirlenemedi',
            ayt_requirement: data.ayt_requirement || 'Belirlenemedi',
            subject_nets: data.subject_nets || {},
            ranking_analysis: 'Hedefe yönelik genel net aralığı',
            study_tips: []
          })
        } catch (e) {
          setError('Hedef netleri alınamadı')
        }
      }
      
      // Update saved roadmaps if logged in
      try {
        if (localStorage.getItem('access_token')) {
        const list = await api.get('/api/me/roadmaps/')
        setSavedRoadmaps(list.data || [])
        }
      } catch {}
      
      if (activeStep < steps.length - 1) {
        setActiveStep(steps.length - 1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu')
      // Show default recommendations on error
      setRecommendations({
        recommendation: "Genel kariyer önerileri",
        tyt_requirement: "Belirlenemedi",
        ayt_requirement: "Belirlenemedi",
        subject_nets: {},
        ranking_analysis: "Analiz yapılamadı",
        study_tips: [
          "Yazılım Mühendisliği - Teknoloji alanındaki ilginiz için uygun",
          "Veri Bilimi - Analitik düşünce yapınız için ideal", 
          "Endüstri Mühendisliği - Problem çözme becerileriniz için",
          "Psikoloji - İnsan ilişkilerindeki başarınız için"
        ]
      })
      if (activeStep < steps.length - 1) {
        setActiveStep(steps.length - 1)
      }
    } finally {
      setLoading(false)
    }
  }

  // Load per-course averages on mount
  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/ai/per-course-averages/')
        if (data && data.averages) setPerCourseAverages(data.averages)
      } catch {}
    })()
  }, [])

  // Manual fetch via button only (no auto-fetch)

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

                  {false && (
                    <TextField label="İlgi Alanları" multiline minRows={3} fullWidth value={formData.interests} onChange={(e) => handleInputChange('interests', e.target.value)} placeholder="Örn: Matematik, teknoloji, sanat, spor..." />
                  )}

                  {false && (
                    <TextField label="Güçlü Olduğun Konular" multiline minRows={3} fullWidth value={formData.strengths} onChange={(e) => handleInputChange('strengths', e.target.value)} placeholder="Örn: Problem çözme, yaratıcılık, analitik düşünme..." />
                  )}

                  {false && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>Hedef Meslekler</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                        {targetProfessions.map((profession, idx) => (
                          <Chip 
                            key={idx} 
                            label={profession} 
                            onDelete={() => removeProfession(profession)} 
                            color="primary" 
                            variant="outlined" 
                          />
                        ))}
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TextField
                          label="Yeni Meslek Ekle"
                          value={newProfession}
                          onChange={(e) => setNewProfession(e.target.value)}
                          placeholder="Hedeflediğiniz mesleği girin"
                          fullWidth
                        />
                        <Button variant="outlined" onClick={addProfession}>Ekle</Button>
                      </Stack>
                      
                      <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>Veya aşağıdan seçin:</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {['Doktor', 'Öğretmen', 'Mühendis', 'Avukat', 'Psikolog', 'Mimar', 'Programcı', 'Eczacı'].map((profession) => (
                          <Chip 
                            key={profession} 
                            label={profession} 
                            onClick={() => {
                              if (!targetProfessions.includes(profession)) {
                                setTargetProfessions([...targetProfessions, profession])
                              }
                            }}
                            color={targetProfessions.includes(profession) ? "primary" : "default"}
                            variant="outlined" 
                            sx={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                  {index === 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>Hedef Üniversite ve Bölüm</Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                        <TextField fullWidth label="Üniversite" value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="Örn: Boğaziçi Üniversitesi" />
                        <TextField fullWidth label="Bölüm" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Örn: Bilgisayar Mühendisliği" />
                        <Button variant="contained" onClick={handleSaveRoadmap} disabled={loading || !university.trim() || !department.trim()}>
                          Hedef Netleri Getir
                        </Button>
                              </Stack>
                      {targetNets && (
                        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                          <Typography variant="body2"><strong>TYT hedef net:</strong> {targetNets.tyt || '-'}</Typography>
                          <Typography variant="body2"><strong>AYT hedef net:</strong> {targetNets.ayt || '-'}</Typography>
                          <Divider sx={{ my: 1, borderBottomWidth: 2 }} />
                          {targetNets.subject_nets && Object.keys(targetNets.subject_nets).length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">Derslere göre hedef net:</Typography>
                              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                {Object.entries(targetNets.subject_nets).map(([s, n]) => (
                                  <Typography key={s} variant="body2">• {s}: {n}</Typography>
                                ))}
                              </Stack>
                        </Box>
                          )}
                        </Paper>
                      )}
                    </Box>
                  )}

                  {false && (
                    <Box />
                  )}

                  {false && (
                    <Stack direction="row" spacing={1}></Stack>
                  )}
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