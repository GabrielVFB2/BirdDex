import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Bird, Heart, MessageCircle, MapPin, Settings, Send, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import TopBar from '@/components/TopBar'
import Avatar from '@/components/Avatar'
import PostCard from '@/components/PostCard'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Profile, PostWithDetails } from '@/types'
import { createNotification } from '@/lib/notifications'
import EditProfileModal from '@/components/EditProfileModal'
import './ProfilePage.css'

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user, profile: myProfile, signOut } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<PostWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isFollowing, setIsFollowing] = useState(false)
  const [followPending, setFollowPending] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [editOpen, setEditOpen] = useState(false)

  const isOwnProfile = user?.id === id

  const fetchProfile = useCallback(async () => {
    if (!id) return

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !data) {
      setError('Perfil não encontrado.')
      setLoading(false)
      return
    }

    setProfile(data as Profile)

    const { count: followers } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', id)

    const { count: following } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', id)

    setFollowerCount(followers ?? 0)
    setFollowingCount(following ?? 0)

    if (user && !isOwnProfile) {
      const { data: followData } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', id)
        .maybeSingle()
      setIsFollowing(!!followData)
    }
  }, [id, user, isOwnProfile])

  const fetchPosts = useCallback(async () => {
    if (!id) return

    const { data, error: fetchError } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:profiles!posts_user_id_fkey(*),
        likes:likes(count),
        comments:comments(count)
      `)
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (fetchError) return

    if (!data || data.length === 0) {
      setPosts([])
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
  }, [id, user])

  useEffect(() => {
    Promise.all([fetchProfile(), fetchPosts()]).finally(() => setLoading(false))
  }, [fetchProfile, fetchPosts])

  const handleFollow = async () => {
    if (!user || followPending) return
    setFollowPending(true)

    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id)
      setIsFollowing(false)
      setFollowerCount((c) => Math.max(0, c - 1))
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: id })
      if (!error) {
        setIsFollowing(true)
        setFollowerCount((c) => c + 1)
        createNotification({ type: 'follow', actorId: user.id, userId: id! })
      }
    }

    setFollowPending(false)
  }

  const handleLikeChange = (postId: string, liked: boolean, count: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, liked_by_me: liked, like_count: count } : p
      )
    )
  }

  if (loading) {
    return (
      <>
        <TopBar title="Perfil" showBack={!isOwnProfile} />
        <div className="loading-container">
          <div className="spinner spinner-lg" />
        </div>
      </>
    )
  }

  if (error || !profile) {
    return (
      <>
        <TopBar title="Perfil" showBack />
        <div className="empty-state">
          <p>{error || 'Algo deu errado.'}</p>
          <Link to="/" className="btn-primary" style={{ marginTop: 16, width: 'auto', padding: '10px 24px' }}>
            Voltar ao feed
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <TopBar title={isOwnProfile ? 'Meu perfil' : 'Perfil'} showBack={!isOwnProfile} showBell={isOwnProfile} />
      <div className="profile-content">
        <div className="profile-header">
          <Avatar profile={profile} size={72} className="avatar-lg" />
          <div className="profile-info">
            <h2 className="profile-name app-title">{profile.display_name}</h2>
            <p className="profile-username">@{profile.username}</p>
            {profile.location && (
              <p className="profile-location">
                <MapPin size={13} />
                {profile.location}
              </p>
            )}
          </div>
        </div>

        {profile.bio && <p className="profile-bio">{profile.bio}</p>}

        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-num">{posts.length}</span>
            <span className="profile-stat-label">publicações</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-num">{followerCount}</span>
            <span className="profile-stat-label">seguidores</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-num">{followingCount}</span>
            <span className="profile-stat-label">seguindo</span>
          </div>
        </div>

        {isOwnProfile ? (
          <div className="profile-actions">
            <button className="btn-secondary profile-edit-btn" onClick={() => setEditOpen(true)}>
              <Settings size={16} />
              Editar perfil
            </button>
            <button className="btn-secondary profile-logout-btn" onClick={() => signOut()}>
              <LogOut size={16} />
              Sair da conta
            </button>
          </div>
        ) : (
          <div className="profile-actions">
            <button
              className={`profile-follow-btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
              onClick={handleFollow}
              disabled={followPending}
            >
              {isFollowing ? 'Deixar de seguir' : 'Seguir'}
            </button>
            <Link to={`/conversations?with=${profile.id}`} className="btn-secondary profile-message-btn">
              <Send size={16} />
              Enviar mensagem
            </Link>
          </div>
        )}

        <div className="profile-divider" />

        <div className="profile-posts-header">
          <h3 className="profile-posts-title">
            {isOwnProfile ? 'Minhas publicações' : 'Publicações'}
          </h3>
          <span className="profile-posts-count">{posts.length} registros</span>
        </div>

        {posts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Bird size={48} strokeWidth={1.5} />
            </div>
            <p>
              {isOwnProfile
                ? 'Você ainda não publicou. Toque em Registrar para criar sua primeira publicação!'
                : 'Nenhuma publicação ainda.'}
            </p>
          </div>
        ) : isOwnProfile ? (
          <div className="profile-own-posts">
            {posts.map((post) => (
              <Link key={post.id} to={`/post/${post.id}`} className="profile-own-post">
                {post.image_url ? (
                  <img src={post.image_url} alt={post.species_name || 'Foto de ave'} className="profile-own-post-img" />
                ) : (
                  <div className="profile-own-post-placeholder">
                    <Bird size={24} strokeWidth={1.5} />
                  </div>
                )}
                <div className="profile-own-post-info">
                  <p className="profile-own-post-caption">{post.caption}</p>
                  <p className="profile-own-post-meta">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                    {post.location ? ` · ${post.location}` : ''}
                  </p>
                  <div className="profile-own-post-stats">
                    <span><Heart size={13} /> {post.like_count ?? 0}</span>
                    <span><MessageCircle size={13} /> {post.comment_count ?? 0}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="feed-list stagger" style={{ padding: '0 12px' }}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onLikeChange={handleLikeChange} />
            ))}
          </div>
        )}
      </div>
      {isOwnProfile && <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} profile={profile} />}
    </>
  )
}
