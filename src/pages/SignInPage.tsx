import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bird } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import './AuthPage.css'

export default function SignInPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)
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
        <h1 className="auth-title app-title">Pio</h1>
        <p className="auth-tagline">Sua comunidade de observadores de aves</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="error-msg">{error}</div>}

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
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="auth-switch">
          Ainda não tem conta? <Link to="/signup">Criar conta</Link>
        </p>
      </form>
    </div>
  )
}
