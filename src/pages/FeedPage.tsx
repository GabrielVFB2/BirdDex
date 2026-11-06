import { useEffect, useState, useCallback } from 'react'
import { Bird } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import TopBar from '@/components/TopBar'
import PostCard from '@/components/PostCard'
import type { PostWithDetails } from '@/types'
import './FeedPage.css'

export default function FeedPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<PostWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'foryou' | 'following'>('foryou')

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError('')

    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles:profiles!posts_user_id_fkey(*),
        likes:likes(count),
        comments:comments(count)
      `)
      .order('created_at', { ascending: false })
      .limit(20)

    if (tab === 'following' && user) {
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)

      const followingIds = followingData?.map((f) => f.following_id) ?? []
      if (followingIds.length === 0) {
        setPosts([])
        setLoading(false)
        return
      }
      query = query.in('user_id', followingIds)
    }

    const { data, error: fetchError } = await query

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
  }, [tab, user])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleLikeChange = (postId: string, liked: boolean, count: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, liked_by_me: liked, like_count: count } : p
      )
    )
  }

  return (
    <>
      <TopBar showLogo showBell />
      <div className="feed-tabs">
        <button
          className={`feed-tab ${tab === 'foryou' ? 'feed-tab-active' : ''}`}
          onClick={() => setTab('foryou')}
        >
          Para você
        </button>
        <button
          className={`feed-tab ${tab === 'following' ? 'feed-tab-active' : ''}`}
          onClick={() => setTab('following')}
        >
          Seguindo
        </button>
      </div>

      <div className="feed-content">
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
            <p>
              {tab === 'following'
                ? 'Você ainda não segue ninguém. Explore publicações para encontrar observadores!'
                : 'Nenhuma publicação ainda. Seja o primeiro a registrar uma ave!'}
            </p>
          </div>
        ) : (
          <div className="feed-list stagger">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onLikeChange={handleLikeChange} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
