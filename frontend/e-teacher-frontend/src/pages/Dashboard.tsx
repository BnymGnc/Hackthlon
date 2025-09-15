import { Link } from 'react-router-dom'
import { Typography, Grid, Card, CardActionArea, CardContent } from '@mui/material'
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined'
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined'
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined'
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'

function Dashboard() {
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


