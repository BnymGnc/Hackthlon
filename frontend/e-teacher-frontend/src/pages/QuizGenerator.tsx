import { Typography, Paper, Box, TextField, Button, Stack, Drawer, IconButton, List, ListItem, ListItemButton, ListItemText, Divider, Tooltip, Alert, Chip } from '@mui/material'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import MenuIcon from '@mui/icons-material/Menu'
import { useState } from 'react'
import api from '../lib/api'

function QuizGenerator() {
  const [drawerOpen, setDrawerOpen] = useState(true)
  const topics = ['Matematik - Türev', 'Fizik - Kinematik', 'Kimya - Asit Baz', 'Tarih - İnkılaplar']
  const histories = ['Quiz #12 - Türev', 'Quiz #11 - Kinematik', 'Quiz #10 - Asit Baz']
  const [inputTopics, setInputTopics] = useState('')
  const [numQuestions, setNumQuestions] = useState(10)
  const [difficulty, setDifficulty] = useState('orta')
  const [questions, setQuestions] = useState<{ q: string, a: string[], correct: string, explanation?: string }[]>([])
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [score, setScore] = useState<number | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [avg, setAvg] = useState<number | null>(null)
  const [topicStats, setTopicStats] = useState<{ topic: string, accuracy: number, total: number }[]>([])
  const [error, setError] = useState<string | null>(null)

  async function loadStats() {
    try {
      const { data } = await api.get('/api/assessments-actions/quiz-stats/')
      setAvg(typeof data.average === 'number' ? data.average : null)
      setTopicStats(Array.isArray(data.topics) ? data.topics : [])
    } catch {}
  }

  async function handleGenerate() {
    setError(null)
    const topicPayload = inputTopics?.trim() || ''
    try {
      const { data } = await api.post('/api/ai/quiz/', { topics: topicPayload, num_questions: numQuestions, difficulty })
      setQuestions(data.questions || [])
      setSelected({})
      setScore(null)
      setShowResults(false)
      void loadStats()
    } catch (e) {
      setError('Quiz oluşturulamadı')
    }
  }

  function handleTopicClick(t: string) {
    setInputTopics(t)
    // generate immediately for quick UX
    void (async () => {
      const { data } = await api.post('/api/ai/quiz/', { topics: t, num_questions: numQuestions, difficulty })
      setQuestions(data.questions || [])
      setSelected({})
      setScore(null)
      setShowResults(false)
    })()
  }

  function handleSelect(qIdx: number, choice: string) {
    setSelected((s) => ({ ...s, [String(qIdx)]: choice }))
  }

  function handleSubmitQuiz() {
    const total = questions.length
    const correct = questions.reduce((acc, q, idx) => acc + (selected[String(idx)] === q.correct ? 1 : 0), 0)
    setScore(Math.round((correct / Math.max(total, 1)) * 100))
    setShowResults(true)
    void (async () => {
      try {
        await api.post('/api/assessments-actions/save-quiz/', {
          topics: inputTopics,
          questions,
          selected,
          score: Math.round((correct / Math.max(total, 1)) * 100),
        })
        void loadStats()
      } catch {}
    })()
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer variant="persistent" anchor="left" open={drawerOpen}>
        <Box sx={{ width: 300, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Quiz Geçmişi</Typography>
            <IconButton onClick={() => setDrawerOpen(false)}><MenuOpenIcon /></IconButton>
          </Box>
          <Typography variant="overline" color="text.secondary">Konu Başlıkları</Typography>
          <List>
            {topics.map(t => (
              <ListItem key={t} disablePadding>
                <ListItemButton onClick={() => handleTopicClick(t)}>
                  <ListItemText primary={t} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 1 }} />
          <Typography variant="overline" color="text.secondary">Geçmiş Quizler</Typography>
          <List>
            {histories.map(h => (
              <ListItem key={h} disablePadding>
                <ListItemButton>
                  <ListItemText primary={h} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      <Box sx={{ flex: 1, pl: drawerOpen ? 3 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!drawerOpen && (
            <Tooltip title="Geçmişi Aç">
              <IconButton onClick={() => setDrawerOpen(true)}><MenuIcon /></IconButton>
            </Tooltip>
          )}
          <Typography variant="h5" gutterBottom>Quiz Oluşturma</Typography>
          {avg !== null && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>Geçmiş Ortalama: {avg}%</Typography>
          )}
        </Box>
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            {topicStats.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {topicStats.slice(0, 8).map(t => (
                  <Chip key={t.topic} label={`${t.topic}: ${t.accuracy}%`} size="small" />
                ))}
              </Stack>
            )}
            <Typography variant="body1">Konu başlıklarını yaz; otomatik quiz soruları üretelim.</Typography>
            <TextField label="Konu Başlıkları" multiline minRows={3} fullWidth value={inputTopics} onChange={(e) => setInputTopics(e.target.value)} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Soru Sayısı" type="number" inputProps={{ min: 1, max: 50 }} value={numQuestions} onChange={(e) => setNumQuestions(parseInt(e.target.value || '0'))} />
              <TextField label="Zorluk" select SelectProps={{ native: true }} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="kolay">Kolay</option>
                <option value="orta">Orta</option>
                <option value="zor">Zor</option>
              </TextField>
            </Stack>
            {error && <Alert severity="error">{error}</Alert>}
            <Button variant="contained" onClick={handleGenerate} disabled={!inputTopics.trim()}>Quiz Oluştur</Button>
            {questions.length > 0 && (
              <Box>
                {questions.map((qu, idx) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 1 }}>
                    <Typography variant="subtitle2">{qu.q}</Typography>
                    <List>
                      {qu.a.map((opt, i) => (
                        <ListItem key={i} disablePadding>
                          <ListItemButton
                            selected={selected[String(idx)] === opt}
                            onClick={() => handleSelect(idx, opt)}
                            sx={{
                              bgcolor: showResults && opt === qu.correct ? 'success.light' :
                                       showResults && selected[String(idx)] === opt && opt !== qu.correct ? 'error.light' : 'inherit'
                            }}
                          >
                            <ListItemText primary={opt} />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                    {showResults && qu.explanation && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                        Açıklama: {qu.explanation}
                      </Typography>
                    )}
                  </Paper>
                ))}
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button variant="contained" onClick={handleSubmitQuiz}>Cevapları Gönder</Button>
                  {score !== null && (
                    <Typography variant="body2" color="text.secondary">
                      Skor: {score} — Doğrular: {questions.reduce((acc, q, idx) => acc + (selected[String(idx)] === q.correct ? 1 : 0), 0)} / {questions.length}
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        </Paper>
      </Box>
    </Box>
  )
}

export default QuizGenerator


