import { useState, useRef, useEffect } from 'react'
import { Box, Paper, Typography, Stack, TextField, Button, IconButton, CircularProgress, List, ListItem, ListItemButton, ListItemText, Divider, Drawer, Tooltip, Alert, Snackbar } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import SendIcon from '@mui/icons-material/Send'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import SaveIcon from '@mui/icons-material/Save'
import RefreshIcon from '@mui/icons-material/Refresh'
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
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    void loadConversations()
  }, [])

  async function loadConversations() {
    try {
      setError(null)
      console.log('Loading conversations...')
      const { data } = await api.get('/api/ai/chat/history/')
      console.log('Conversations data:', data)
      const chats = data.chats || []
      setConversations(chats)
    } catch (err: any) {
      console.error('Failed to load conversations:', err)
      setError('Sohbet geçmişi yüklenirken hata oluştu')
      // Fallback to old method
      try {
        const { data } = await api.get('/api/assessments/')
        const items = (data || [])
          .filter((a: any) => /Chat/i.test(a.title))
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 30)
        setConversations(items)
      } catch {
        setConversations([])
      }
    }
  }

  async function newChat() {
    try {
      setError(null)
      setMessages([])
      setTitle(`Yeni Sohbet - ${new Date().toLocaleString()}`)
      
      // Create new chat via API
      console.log('Creating new chat...')
      const { data } = await api.post('/api/ai/chat/new/', {
        title
      })
      console.log('New chat response:', data)
      
      if (data.ok && data.chat) {
        const nid = data.chat.id
        setSelectedId(nid)
        setTitle(data.chat.title)
        setSuccess('Yeni sohbet oluşturuldu')
        // Save immediately to ensure persistence
        await saveThread(true, nid)
        await loadConversations()
      } else {
        // Fallback if API doesn't return expected data
        console.log('Using fallback for new chat')
        setSelectedId(null)
      }
    } catch (err: any) {
      console.error('Failed to create new chat:', err)
      setError('Yeni sohbet oluşturulurken hata oluştu')
      // Continue with local new chat
      setSelectedId(null)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    
    setInput('')
    setError(null)
    const history = messages
    setMessages((m) => [...m, { role: 'user', content: text }])
    setLoading(true)
    
    try {
      console.log('Sending message:', text)
      console.log('History:', history)
      const { data } = await api.post('/api/ai/chat/', { message: text, history })
      console.log('Chat response:', data)
      const reply = data.reply || 'Şu an yanıt veremiyorum.'
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
      
      // Auto-save to current thread (create if not exists)
      if (messages.length === 0) {
        // First message - generate title from user input
        const autoTitle = `Chat: ${text.substring(0, 30)}${text.length > 30 ? '...' : ''}`
        setTitle(autoTitle)
      }
      
      // Save or update
      if (selectedId) {
        await saveThread(true)
      } else {
        // Ensure a thread exists; create new if needed
        try {
          const created = await api.post('/api/ai/chat/new/', { title })
          if (created.data?.ok && created.data?.chat?.id) {
            setSelectedId(created.data.chat.id)
          }
        } catch {}
        await saveThread(true)
      }
    } catch (err: any) {
      console.error('Chat send failed:', err)
      setMessages((m) => [...m, { role: 'assistant', content: 'Şu an yanıt veremiyorum. Birazdan tekrar dene.' }])
      setError('Mesaj gönderilirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  async function saveThread(silent = false, forcedId?: number) {
    if (messages.length === 0) {
      if (!silent) setError('Kaydedilecek mesaj bulunamadı')
      return
    }
    
    setSaving(true)
    setError(null)
    
    try {
      console.log('Saving chat thread...')
      const payload: any = { 
        title: title || 'Başlıksız Sohbet', 
        history: messages 
      }
      if (forcedId) payload.id = forcedId
      else if (selectedId) payload.id = selectedId
      const { data } = await api.post('/api/ai/chat/save-thread/', payload)
      console.log('Save thread response:', data)
      
      if (data.ok) {
        if (!silent) setSuccess('Sohbet başarıyla kaydedildi')
        if (data.id) setSelectedId(data.id)
        await loadConversations()
      } else {
        if (!silent) setError('Sohbet kaydedilemedi')
      }
    } catch (err: any) {
      console.error('Save thread failed:', err)
      if (!silent) setError('Sohbet kaydedilirken hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  // Delete conversation function
  async function deleteConversation(id: number, chatTitle: string) {
    if (!confirm(`"${chatTitle}" sohbetini silmek istediğinizden emin misiniz?`)) {
      return
    }
    
    setDeleting(id)
    setError(null)
    
    try {
      // Try new chat delete API first
      try {
        const { data } = await api.delete('/api/ai/chat/history/', { data: { chat_id: id } })
        if (data.ok) {
          setSuccess(`"${chatTitle}" sohbeti silindi`)
          if (selectedId === id) {
            await newChat()
          }
          await loadConversations()
          return
        }
      } catch (newApiErr) {
        console.warn('New delete API failed, trying fallback')
      }
      
      // Fallback to old API
      await api.delete(`/api/assessments/${id}/`)
      setSuccess(`"${chatTitle}" sohbeti silindi`)
      if (selectedId === id) {
        await newChat()
      }
      await loadConversations()
    } catch (err: any) {
      console.error('Delete failed:', err)
      setError('Sohbet silinirken hata oluştu')
    } finally {
      setDeleting(null)
    }
  }

  const drawerWidth = 300
  return (
    <Box sx={{ display: 'flex', position: 'fixed', top: { xs: 56, sm: 64 }, bottom: 0, left: 0, right: 0 }}>
      <Drawer variant="persistent" anchor="left" open={sidebarOpen} sx={{ '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', pt: 2 } }}>
        <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 1 }}>
          <Button 
            size="small" 
            variant="contained" 
            fullWidth 
            onClick={() => void newChat()}
            startIcon={<AddIcon />}
          >
            Yeni Sohbet
          </Button>
          <Button 
            size="small" 
            variant="outlined" 
            onClick={() => void loadConversations()}
            startIcon={<RefreshIcon />}
          >
            Yenile
          </Button>
        </Box>
        <Divider />
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          <List>
            {conversations.map((c) => (
              <ListItem key={c.id} disablePadding>
                <ListItemButton 
                  selected={selectedId === c.id} 
                  onClick={async () => {
                    try {
                      setError(null)
                      setSelectedId(c.id)
                      
                      // Try to load full chat history
                      try {
                        console.log('Loading chat history for ID:', c.id)
                        const { data } = await api.get(`/api/ai/chat/load/${c.id}/`)
                        console.log('Chat load response:', data)
                        if (data.ok && data.chat) {
                          setMessages(data.chat.history || [])
                          setTitle(data.chat.title || 'Sohbet')
                          return
                        }
                      } catch (loadErr) {
                        console.warn('Failed to load via chat API, trying fallback')
                      }
                      
                      // Fallback to existing data
                      const hist = (c.data?.history || []) as Msg[]
                      const fallback: Msg[] = (() => { 
                        const msg = c.data?.message || ''
                        const rep = c.data?.reply || ''
                        return (msg || rep) ? [
                          { role: 'user' as const, content: msg }, 
                          { role: 'assistant' as const, content: rep }
                        ] : [] 
                      })()
                      setMessages(Array.isArray(hist) && hist.length ? hist : fallback)
                      setTitle(c.title || 'Sohbet')
                    } catch (err) {
                      console.error('Failed to load conversation:', err)
                      setError('Sohbet yüklenirken hata oluştu')
                    }
                  }}
                  sx={{ pr: 1 }}
                >
                  <ListItemText 
                    primary={c.title} 
                    secondary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(c.created_at).toLocaleString()}
                        </Typography>
                        {c.message_count && (
                          <Typography variant="caption" color="primary">
                            {c.message_count} mesaj
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <IconButton 
                    size="small" 
                    color="error"
                    disabled={deleting === c.id}
                    onClick={async (e) => {
                      e.stopPropagation()
                      await deleteConversation(c.id, c.title)
                    }}
                    sx={{ ml: 1 }}
                  >
                    {deleting === c.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                  </IconButton>
                </ListItemButton>
              </ListItem>
            ))}
            {conversations.length === 0 && (
              <ListItem><ListItemText primary="Kayıt yok" /></ListItem>
            )}
          </List>
        </Box>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Button 
            size="small" 
            variant="contained" 
            fullWidth 
            onClick={() => void newChat()}
            startIcon={<AddIcon />}
          >
            Yeni Sohbet
          </Button>
        </Box>
      </Drawer>
      <Box sx={{ flex: 1, ml: sidebarOpen ? `${drawerWidth}px` : 0, transition: 'margin 150ms ease' }}>
        <Paper square sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
            <Tooltip title={sidebarOpen ? 'Geçmişi Gizle' : 'Geçmişi Göster'}>
              <IconButton onClick={() => setSidebarOpen((o) => !o)}><MenuIcon /></IconButton>
            </Tooltip>
            <TextField 
              size="small" 
              label="Başlık" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              sx={{ maxWidth: 320 }} 
            />
            <Button 
              size="small" 
              variant="outlined" 
              onClick={() => void saveThread()} 
              disabled={messages.length === 0 || saving}
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
            {selectedId && (
              <Button 
                size="small" 
                color="error" 
                disabled={deleting === selectedId}
                onClick={() => deleteConversation(selectedId, title)}
                startIcon={deleting === selectedId ? <CircularProgress size={16} /> : <DeleteIcon />}
              >
                {deleting === selectedId ? 'Siliniyor...' : 'Sil'}
              </Button>
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
      
      {/* Success/Error Snackbars */}
      <Snackbar 
        open={!!success} 
        autoHideDuration={3000} 
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>
      
      <Snackbar 
        open={!!error} 
        autoHideDuration={5000} 
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default Chat