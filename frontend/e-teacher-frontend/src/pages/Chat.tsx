import { useState, useRef, useEffect } from 'react'
import { Box, Paper, Typography, Stack, TextField, Button, IconButton, CircularProgress, List, ListItem, ListItemButton, ListItemText, Divider, Grid, Drawer, Tooltip } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import SendIcon from '@mui/icons-material/Send'
import api from '../lib/api'

type Msg = { role: 'user' | 'assistant', content: string }

function Chat() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [title, setTitle] = useState('Yeni Sohbet')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    void loadConversations()
  }, [])

  async function loadConversations() {
    try {
      const { data } = await api.get('/api/assessments/')
      const items = (data || [])
        .filter((a: any) => /Chat/i.test(a.title))
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30)
      setConversations(items)
    } catch {}
  }

  function newChat() {
    setMessages([])
    setSelectedId(null)
    setTitle('Yeni Sohbet')
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const history = messages
    setMessages((m) => [...m, { role: 'user', content: text }])
    setLoading(true)
    try {
      const { data } = await api.post('/api/ai/chat/', { message: text, history })
      const reply = data.reply || 'Şu an yanıt veremiyorum.'
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
      void loadConversations()
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Şu an yanıt veremiyorum. Birazdan tekrar dene.' }])
    } finally {
      setLoading(false)
    }
  }

  async function saveThread() {
    if (messages.length === 0) return
    try {
      await api.post('/api/ai/chat/save-thread/', { title, history: messages })
      await loadConversations()
    } catch {}
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const drawerWidth = 300
  return (
    <Box sx={{ display: 'flex', position: 'fixed', top: { xs: 56, sm: 64 }, bottom: 0, left: 0, right: 0 }}>
      <Drawer variant="persistent" anchor="left" open={sidebarOpen} sx={{ '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', pt: 2 } }}>
        <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 1 }}>
          <Button size="small" variant="contained" fullWidth onClick={newChat}>Yeni Sohbet</Button>
          <Button size="small" variant="outlined" fullWidth onClick={() => void loadConversations()}>Yenile</Button>
        </Box>
        <Divider />
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          <List>
            {conversations.map((c) => (
              <ListItem key={c.id} disablePadding>
                <ListItemButton selected={selectedId === c.id} onClick={() => {
                  setSelectedId(c.id)
                  const hist = (c.data?.history || []) as Msg[]
                  const fallback = (() => { const msg = c.data?.message || ''; const rep = c.data?.reply || ''; return (msg || rep) ? [{ role: 'user', content: msg }, { role: 'assistant', content: rep }] : [] })()
                  setMessages(Array.isArray(hist) && hist.length ? hist : fallback)
                  setTitle(c.title || 'Sohbet')
                }}>
                  <ListItemText primary={c.title} secondary={new Date(c.created_at).toLocaleString()} />
                </ListItemButton>
              </ListItem>
            ))}
            {conversations.length === 0 && (
              <ListItem><ListItemText primary="Kayıt yok" /></ListItem>
            )}
          </List>
        </Box>
      </Drawer>
      <Box sx={{ flex: 1, ml: sidebarOpen ? `${drawerWidth}px` : 0, transition: 'margin 150ms ease' }}>
        <Paper square sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
            <Tooltip title={sidebarOpen ? 'Geçmişi Gizle' : 'Geçmişi Göster'}>
              <IconButton onClick={() => setSidebarOpen((o) => !o)}><MenuIcon /></IconButton>
            </Tooltip>
            <TextField size="small" label="Başlık" value={title} onChange={(e) => setTitle(e.target.value)} sx={{ maxWidth: 320 }} />
            <Button size="small" variant="outlined" onClick={() => void saveThread()} disabled={messages.length === 0}>Kaydet</Button>
            {selectedId && (
              <Button size="small" color="error" onClick={async () => { try { await api.delete(`/api/assessments/${selectedId}/`); await loadConversations(); newChat() } catch {} }}>Sil</Button>
            )}
          </Stack>
          <Box sx={{ flex: 1, overflowY: 'auto', mb: 1, px: 1 }}>
            <Stack spacing={1}>
              {/* No placeholder bubble when empty */}
              {messages.map((m, idx) => (
                <Box key={idx} sx={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <Paper sx={{ p: 1.5, maxWidth: '75%', bgcolor: m.role === 'user' ? 'primary.light' : 'background.paper' }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.content}</Typography>
                  </Paper>
                </Box>
              ))}
              {loading && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">Yazıyor…</Typography>
                </Box>
              )}
              <div ref={endRef} />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <TextField fullWidth multiline minRows={1} maxRows={4} placeholder="Mesajını yaz" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} />
            <IconButton color="primary" onClick={() => void send()} disabled={loading || !input.trim()}>
              <SendIcon />
            </IconButton>
          </Stack>
        </Paper>
      </Box>
    </Box>
  )
}

export default Chat


