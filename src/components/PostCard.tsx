import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Bookmark, MoveHorizontal as MoreHorizontal, Bird } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { PostWithDetails } from '@/types'
import Avatar from './Avatar'
import './PostCard.css'

interface PostCardProps {
  post: PostWithDetails
  onLikeChange?: (postId: string, liked: boolean, likeCount: number) => void
}

export default function PostCard({ post, onLikeChange }: PostCardProps) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(post.liked_by_me ?? false)
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0)
  const [saving, setSaving] = useState(false)
  const [likeAnimating, setLikeAnimating] = useState(false)
  const [bookmarked, setBookmarked] = useState(post.bookmarked_by_me ?? false)
  const [bookmarkPending, setBookmarkPending] = useState(false)

  useEffect(() => {
    if (!user) return

    supabase
      .from('bookmarks')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setBookmarked(!!data))
  }, [post.id, user])

  const handleLike = async () => {
    if (!user) return
    if (saving) return

    setSaving(true)
    setLikeAnimating(true)
    setTimeout(() => setLikeAnimating(false), 400)

    if (liked) {
      setLiked(false)
      setLikeCount((c) => c - 1)
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id)
    } else {
      setLiked(true)
      setLikeCount((c) => c + 1)
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.id })
    }

    onLikeChange?.(post.id, !liked, liked ? likeCount - 1 : likeCount + 1)
    setSaving(false)
  }

  const handleBookmark = async () => {
    if (!user || bookmarkPending) return

    setBookmarkPending(true)
    const nextBookmarked = !bookmarked
    setBookmarked(nextBookmarked)

    const result = nextBookmarked
      ? await supabase.from('bookmarks').insert({ post_id: post.id, user_id: user.id })
      : await supabase.from('bookmarks').delete().eq('post_id', post.id).eq('user_id', user.id)

    if (result.error) setBookmarked(!nextBookmarked)
    setBookmarkPending(false)
  }

  const profile = post.profiles
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })

  return (
    <article className="post-card animate-fade-in-up">
      <div className="post-header">
        <Link to={`/profile/${post.user_id}`} className="post-author">
          <Avatar profile={profile} size={38} />
          <div className="post-author-info">
            <span className="post-author-name">{profile?.display_name || 'Observador'}</span>
            <span className="post-author-meta">
              {post.location ? `${post.location} · ` : ''}{timeAgo}
            </span>
          </div>
        </Link>
        <button className="btn-icon post-more" aria-label="Mais opções">
          <MoreHorizontal size={20} />
        </button>
      </div>

      <Link to={`/post/${post.id}`} className="post-image-link">
        {post.image_url ? (
          <img src={post.image_url} alt={post.species_name || 'Foto de ave'} className="post-image" />
        ) : (
          <div className="post-image-placeholder">
            <Bird size={48} strokeWidth={1.5} />
            <span>{post.species_name ? `[ Foto de ${post.species_name} ]` : '[ Sem foto ]'}</span>
          </div>
        )}
        {post.species_name && (
          <div className="post-species-badge">
            <Bird size={14} />
            <span>{post.species_name}</span>
          </div>
        )}
      </Link>

      {post.species_name && (
        <div className="post-species">
          <div>
            <h3 className="post-species-name app-title">{post.species_name}</h3>
            {post.species_scientific && (
              <p className="post-species-scientific">{post.species_scientific}</p>
            )}
          </div>
        </div>
      )}

      <div className="post-actions">
        <button className={`post-action ${liked ? 'post-action-liked' : ''}`} onClick={handleLike} disabled={saving}>
          <Heart
            size={22}
            fill={liked ? 'currentColor' : 'none'}
            className={likeAnimating ? 'animate-bounce-quick' : ''}
          />
          <span>{likeCount}</span>
        </button>
        <Link to={`/post/${post.id}`} className="post-action">
          <MessageCircle size={22} />
          <span>{post.comment_count ?? 0}</span>
        </Link>
        <button
          className={`post-action post-action-right ${bookmarked ? 'post-action-liked' : ''}`}
          onClick={handleBookmark}
          disabled={bookmarkPending}
          aria-label={bookmarked ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
          title={bookmarked ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
        >
          <Bookmark size={22} fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {post.caption && (
        <p className="post-caption">
          <Link to={`/profile/${post.user_id}`} className="post-caption-author">
            {profile?.username ? `@${profile.username}` : ''}
          </Link>
          {' '}
          {post.caption}
        </p>
      )}
    </article>
  )
}
