import { Link } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: 16 }}>
      <h1>E-Teacher</h1>
      <p>Yapay Zeka Destekli Öğrenci Destek Uygulaması</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link to="/login">Giriş Yap</Link>
        <Link to="/register">Kayıt Ol</Link>
        <Link to="/dashboard">Panel</Link>
      </div>
    </div>
  )
}

export default App
