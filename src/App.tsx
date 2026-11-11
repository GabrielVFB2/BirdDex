import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import BottomNav from '@/components/BottomNav'
import SignInPage from '@/pages/SignInPage'
import SignUpPage from '@/pages/SignUpPage'
import FeedPage from '@/pages/FeedPage'
import ExplorePage from '@/pages/ExplorePage'
import PostDetailPage from '@/pages/PostDetailPage'
import NewPostPage from '@/pages/NewPostPage'
import ReviewPostPage from '@/pages/ReviewPostPage'
import PostConfirmationPage from '@/pages/PostConfirmationPage'
import ProfilePage from '@/pages/ProfilePage'
import ConversationsPage from '@/pages/ConversationsPage'
import NotificationsPage from '@/pages/NotificationsPage'
import IdentifyPage from '@/pages/IdentifyPage'
import type { JSX } from 'react'

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-container" style={{ minHeight: '100vh' }}>
          <div className="spinner spinner-lg" />
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/signin" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-container" style={{ minHeight: '100vh' }}>
          <div className="spinner spinner-lg" />
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/signin" element={user ? <Navigate to="/" replace /> : <SignInPage />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignUpPage />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <div className="app-container">
            <div className="app-content">
              <Routes>
                <Route path="/" element={<FeedPage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/post/:id" element={<PostDetailPage />} />
                <Route path="/new" element={<NewPostPage />} />
                <Route path="/new/review" element={<ReviewPostPage />} />
                <Route path="/new/confirmation" element={<PostConfirmationPage />} />
                <Route path="/profile/:id" element={<ProfilePage />} />
                <Route path="/conversations" element={<ConversationsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/identify" element={<IdentifyPage />} />
              </Routes>
            </div>
            <BottomNav />
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  )
}
