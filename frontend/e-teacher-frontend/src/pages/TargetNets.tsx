import React, { useState } from 'react'
import { Typography, Paper, Box, TextField, Stack, Stepper, Step, StepLabel, StepContent, Chip, Alert, Divider, Button, ToggleButtonGroup, ToggleButton } from '@mui/material'
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

function TargetNets() {
  const steps = [
    { label: 'Hedef Netler', desc: 'Üniversite ve bölüm girince hedef TYT/AYT netleri buton ile getir' },
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
  const [examView, setExamView] = useState<'TYT'|'AYT'|'Genel'>('Genel')

  function prettyLabel(key: string): string {
    const k = key.trim().toLowerCase()
    const map: Record<string,string> = {
      'turkce': 'Türkçe',
      'türkçe': 'Türkçe',
      'matematik': 'Matematik',
      'fen': 'Fen Bilimleri',
      'sosyal': 'Sosyal Bilimler',
      'fizik': 'Fizik',
      'kimya': 'Kimya',
      'biyoloji': 'Biyoloji',
      'edebiyat': 'Edebiyat',
      'tarih': 'Tarih',
      'coğrafya': 'Coğrafya',
      'cografya': 'Coğrafya',
      'felsefe': 'Felsefe',
      'din kültürü': 'Din Kültürü',
      'din_kulturu': 'Din Kültürü',
      'yabancı dil': 'Yabancı Dil',
      'yabanci_dil': 'Yabancı Dil',
    }
    // Strip tyt_/ayt_ prefixes if any
    const stripped = k.replace(/^tyt[_\-\s]*/,'').replace(/^ayt[_\-\s]*/,'')
    return map[stripped] || stripped.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  function filterByExam(subjects: Record<string,string>) {
    if (!subjects) return {}
    const entries = Object.entries(subjects)
    if (examView === 'Genel') return subjects
    const isTyt = examView === 'TYT'
    const filtered = entries.filter(([k]) => {
      const l = k.toLowerCase()
      return isTyt ? l.startsWith('tyt') || (!l.startsWith('ayt') && ['turk','mat','fen','sos'].some(s => l.includes(s)))
                   : l.startsWith('ayt')
    })
    return Object.fromEntries(filtered.length ? filtered : entries)
  }

  const handleSaveRoadmap = async () => {
    setLoading(true)
    setError(null)
    try {
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
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    (async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      if (!token) return
      try {
        const { data } = await api.get('/api/ai/per-course-averages/')
        if (data && data.averages) setPerCourseAverages(data.averages)
      } catch {}
    })()
  }, [])

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Hedef Netler</Typography>
      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
              <StepContent>
                <Stack spacing={2} sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">{step.desc}</Typography>
                  {index === 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>Hedef Üniversite ve Bölüm</Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                        <TextField fullWidth label="Üniversite" value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="Örn: Boğaziçi Üniversitesi" />
                        <TextField fullWidth label="Bölüm" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Örn: Bilgisayar Mühendisliği" />
                      </Stack>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                        <Button variant="contained" onClick={handleSaveRoadmap} disabled={loading || !university.trim() || !department.trim()} sx={{ px: 3 }}>
                          Hedef Netleri Getir
                        </Button>
                      </Box>
                      {targetNets && (
                        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
                            <Stack direction="row" spacing={1}>
                              <Chip label={`TYT: ${targetNets.tyt || '-'}`} color="primary" variant="outlined" />
                              <Chip label={`AYT: ${targetNets.ayt || '-'}`} color="secondary" variant="outlined" />
                            </Stack>
                            <ToggleButtonGroup size="small" color="primary" exclusive value={examView} onChange={(_,v) => v && setExamView(v)}>
                              <ToggleButton value="Genel">Genel</ToggleButton>
                              <ToggleButton value="TYT">TYT</ToggleButton>
                              <ToggleButton value="AYT">AYT</ToggleButton>
                            </ToggleButtonGroup>
                          </Stack>
                          <Divider sx={{ my: 1, borderBottomWidth: 2 }} />
                          {targetNets.subject_nets && Object.keys(targetNets.subject_nets).length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">Derslere göre hedef net</Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                                {Object.entries(filterByExam(targetNets.subject_nets)).map(([s, n]) => (
                                  <Chip key={s} label={`${prettyLabel(s)}: ${n}`} variant="outlined" />
                                ))}
                              </Stack>
                            </Box>
                          )}
                        </Paper>
                      )}
                    </Box>
                  )}
                </Stack>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Paper>
    </Box>
  )
}

export default TargetNets


