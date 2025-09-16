import { Link } from 'react-router-dom'
import { Typography, Grid, Card, CardActionArea, CardContent, Paper, Stack, Button, Chip } from '@mui/material'
import { useEffect, useState } from 'react'
import api from '../lib/api'
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined'
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'

function Dashboard() {
  const [roadmaps, setRoadmaps] = useState<any[]>([])
  const [latestQuiz, setLatestQuiz] = useState<any | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [rmRes, asmtRes] = await Promise.all([
          api.get('/api/me/roadmaps/'),
          api.get('/api/assessments/'),
        ])
        setRoadmaps(rmRes.data || [])
        const assessments = asmtRes.data || []
        const quiz = assessments.find((a: any) => a.title?.toLowerCase().includes('quiz'))
        setLatestQuiz(quiz || null)
      } catch (e) {
        // ignore
      }
    }
    load()
  }, [])
  const tiles = [
    { title: 'Kariyer Yol Haritası', desc: 'İlgi ve sonuçlara göre öneriler', to: '/career', icon: <SchoolOutlinedIcon color="primary" /> },
    { title: 'Kişisel Çalışma Raporları', desc: 'Güçlü ve zayıf yönler', to: '/reports', icon: <TimelineOutlinedIcon color="primary" /> },
    { title: 'Ders Programı Önerisi', desc: 'Verimli haftalık plan', to: '/schedule', icon: <ScheduleOutlinedIcon color="primary" /> },
    { title: 'Quiz Oluşturma', desc: 'Konu başlığından quiz üret', to: '/quiz', icon: <QuizOutlinedIcon color="primary" /> },
    { title: 'Belge Özeti', desc: 'Notlardan kısa özet', to: '/summary', icon: <ArticleOutlinedIcon color="primary" /> },
    { title: 'Psikolojik Destek', desc: 'Motivasyon ve destek', to: '/support', icon: <PsychologyOutlinedIcon color="primary" /> },
  ]

  return (
    <>
      <Typography variant="h5" gutterBottom>Panel</Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>
        Hoş geldin! Buradan tüm özelliklere erişebilirsin.
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Son Yol Haritaları</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {roadmaps.slice(0, 8).map((r, idx) => (
                <Chip key={idx} label={(r.recommendations?.[0]) || 'Öneri'} sx={{ mb: 1 }} />
              ))}
              {roadmaps.length === 0 && (
                <Typography variant="body2" color="text.secondary">Henüz yol haritası yok. <Button size="small" component={Link} to="/career">Oluştur</Button></Typography>
              )}
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Son Quiz</Typography>
            {latestQuiz ? (
              <>
                <Typography variant="body2" color="text.secondary">{latestQuiz.title}</Typography>
                <Button size="small" component={Link} to="/quiz" sx={{ mt: 1 }}>Quizleri Gör</Button>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">Henüz quiz oluşturulmadı. <Button size="small" component={Link} to="/quiz">Oluştur</Button></Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
      <Grid container spacing={3} alignItems="stretch">
        {tiles.map((t) => (
          <Grid item xs={12} sm={6} md={4} key={t.title}>
            <Card sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardActionArea component={Link} to={t.to} sx={{ p: 2, height: '100%', display: 'flex', alignItems: 'stretch' }}>
                <CardContent sx={{ display: 'grid', gap: 1, minHeight: 160, width: '100%', alignContent: 'start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {t.icon}
                    <Typography variant="h6">{t.title}</Typography>
                  </div>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{t.desc}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  )
}

export default Dashboard


