import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bird } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import './AuthPage.css'

export default function SignUpPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (username.length < 3) {
      setError('O nome de usuário deve ter pelo menos 3 caracteres.')
      return
    }

    setLoading(true)

    const { error } = await signUp(email, password, username, displayName)
    if (error) {
      setError(error)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-logo">
          <Bird size={40} />
        </div>
        <h1 className="auth-title app-title">BirdDex</h1>
        <p className="auth-tagline">Junte-se à comunidade de observadores de aves</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="error-msg">{error}</div>}

        <div className="form-group">
          <label className="form-label">Nome</label>
          <input
            type="text"
            className="form-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Seu nome"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Nome de usuário</label>
          <input
            type="text"
            className="form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
            placeholder="usuario"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">E-mail</label>
          <input
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Senha</label>
          <input
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>

        <p className="auth-switch">
          Já tem conta? <Link to="/signin">Entrar</Link>
        </p>
      </form>
    </div>
  )
}
