import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Bird } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import TopBar from '@/components/TopBar'
import Avatar from '@/components/Avatar'
import type { PostWithDetails } from '@/types'
import './ExplorePage.css'

export default function ExplorePage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<PostWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:profiles!posts_user_id_fkey(*),
        likes:likes(count),
        comments:comments(count)
      `)
      .order('created_at', { ascending: false })
      .limit(30)

    if (fetchError) {
      setError('Não foi possível carregar as publicações.')
      setLoading(false)
      return
    }

    if (!data || data.length === 0) {
      setPosts([])
      setLoading(false)
      return
    }

    const postIds = data.map((p) => p.id)
    const { data: myLikes } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user!.id)
      .in('post_id', postIds)

    const likedIds = new Set(myLikes?.map((l) => l.post_id) ?? [])

    const enriched: PostWithDetails[] = data.map((p: Record<string, unknown>) => {
      const likesArr = p.likes as { count: number }[] | null
      const commentsArr = p.comments as { count: number }[] | null
      return {
        ...(p as unknown as PostWithDetails),
        like_count: likesArr?.[0]?.count ?? 0,
        comment_count: commentsArr?.[0]?.count ?? 0,
        liked_by_me: likedIds.has(p.id as string),
      }
    })

    setPosts(enriched)
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  return (
    <>
      <TopBar title="Explorar" showBell />
      <div className="explore-content">
        <div className="explore-intro">
          <Compass size={20} className="explore-intro-icon" />
          <p>Descubra observadores e aves da comunidade BirdDex.</p>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner spinner-lg" />
          </div>
        ) : error ? (
          <div className="empty-state">
            <p>{error}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Bird size={48} strokeWidth={1.5} />
            </div>
            <p>Nenhuma publicação para explorar ainda.</p>
          </div>
        ) : (
          <div className="explore-grid stagger">
            {posts.map((post) => (
              <Link key={post.id} to={`/post/${post.id}`} className="explore-tile">
                {post.image_url ? (
                  <img src={post.image_url} alt={post.species_name || 'Foto de ave'} className="explore-tile-img" />
                ) : (
                  <div className="explore-tile-placeholder">
                    <Bird size={28} strokeWidth={1.5} />
                  </div>
                )}
                <div className="explore-tile-overlay">
                  <div className="explore-tile-author">
                    <Avatar profile={post.profiles} size={20} />
                    <span>{post.profiles?.display_name || 'Observador'}</span>
                  </div>
                  {post.species_name && (
                    <span className="explore-tile-species">{post.species_name}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
