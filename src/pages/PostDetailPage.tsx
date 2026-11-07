import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heart, MessageCircle, Bookmark, MoveHorizontal as MoreHorizontal, Bird, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import TopBar from '@/components/TopBar'
import Avatar from '@/components/Avatar'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { PostWithDetails, Comment } from '@/types'
import './PostDetailPage.css'

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [post, setPost] = useState<PostWithDetails | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [likeAnimating, setLikeAnimating] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [bookmarkPending, setBookmarkPending] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  const fetchPost = useCallback(async () => {
    if (!id) return
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
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !data) {
      setError('Publicação não encontrada.')
      setLoading(false)
      return
    }

    const likesArr = data.likes as { count: number }[] | null
    const commentsArr = data.comments as { count: number }[] | null

    const { data: myLike } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user!.id)
      .maybeSingle()

    const { data: myBookmark } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user!.id)
      .maybeSingle()

    const enriched: PostWithDetails = {
      ...(data as unknown as PostWithDetails),
      like_count: likesArr?.[0]?.count ?? 0,
      comment_count: commentsArr?.[0]?.count ?? 0,
      liked_by_me: !!myLike,
    }

    setPost(enriched)
    setLiked(enriched.liked_by_me ?? false)
    setLikeCount(enriched.like_count ?? 0)
    setBookmarked(!!myBookmark)
    setLoading(false)
  }, [id, user])

  const fetchComments = useCallback(async () => {
    if (!id) return

    const { data, error: fetchError } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:profiles!comments_user_id_fkey(*)
      `)
      .eq('post_id', id)
      .order('created_at', { ascending: true })

    if (fetchError) return

    setComments((data as Comment[]) ?? [])
  }, [id])

  useEffect(() => {
    fetchPost()
    fetchComments()
  }, [fetchPost, fetchComments])

  const handleLike = async () => {
    if (!user || !id || saving) return

    setSaving(true)
    setLikeAnimating(true)
    setTimeout(() => setLikeAnimating(false), 400)

    if (liked) {
      setLiked(false)
      setLikeCount((c) => c - 1)
      await supabase.from('likes').delete().eq('post_id', id).eq('user_id', user.id)
    } else {
      setLiked(true)
      setLikeCount((c) => c + 1)
      await supabase.from('likes').insert({ post_id: id, user_id: user.id })
    }

    setSaving(false)
  }

  const handleBookmark = async () => {
    if (!user || !id || bookmarkPending) return

    setBookmarkPending(true)
    const nextBookmarked = !bookmarked
    setBookmarked(nextBookmarked)

    const result = nextBookmarked
      ? await supabase.from('bookmarks').insert({ post_id: id, user_id: user.id })
      : await supabase.from('bookmarks').delete().eq('post_id', id).eq('user_id', user.id)

    if (result.error) setBookmarked(!nextBookmarked)
    setBookmarkPending(false)
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !id || !commentText.trim() || submittingComment) return

    setSubmittingComment(true)

    const { data, error: insertError } = await supabase
      .from('comments')
      .insert({
        post_id: id,
        user_id: user.id,
        content: commentText.trim(),
      })
      .select(`
        *,
        profiles:profiles!comments_user_id_fkey(*)
      `)
      .single()

    if (insertError) {
      setSubmittingComment(false)
      return
    }

    setComments((prev) => [...prev, data as Comment])
    setCommentText('')
    setSubmittingComment(false)
  }

  if (loading) {
    return (
      <>
        <TopBar title="Publicação" showBack />
        <div className="loading-container">
          <div className="spinner spinner-lg" />
        </div>
      </>
    )
  }

  if (error || !post) {
    return (
      <>
        <TopBar title="Publicação" showBack />
        <div className="empty-state">
          <p>{error || 'Algo deu errado.'}</p>
          <Link to="/" className="btn-primary" style={{ marginTop: 16, width: 'auto', padding: '10px 24px' }}>
            Voltar ao feed
          </Link>
        </div>
      </>
    )
  }

  const profile = post.profiles
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })

  return (
    <>
      <TopBar title="Publicação" showBack showBell={false} />
      <div className="post-detail">
        <article className="post-card">
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

          <div className="post-image-link">
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
          </div>

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
            <div className="post-action">
              <MessageCircle size={22} />
              <span>{comments.length}</span>
            </div>
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

        <div className="comments-section">
          <h3 className="comments-title">Comentários ({comments.length})</h3>

          {comments.length === 0 ? (
            <p className="comments-empty">Nenhum comentário ainda. Seja o primeiro a comentar!</p>
          ) : (
            <div className="comments-list">
              {comments.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <Link to={`/profile/${comment.user_id}`}>
                    <Avatar profile={comment.profiles} size={32} />
                  </Link>
                  <div className="comment-body">
                    <div className="comment-header">
                      <Link to={`/profile/${comment.user_id}`} className="comment-author">
                        {comment.profiles?.display_name || 'Observador'}
                      </Link>
                      <span className="comment-time">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    <p className="comment-text">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <form className="comment-input-bar" onSubmit={handleComment}>
        <input
          type="text"
          className="comment-input"
          placeholder="Escreva um comentário..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          disabled={submittingComment}
        />
        <button
          type="submit"
          className="comment-send-btn"
          disabled={!commentText.trim() || submittingComment}
          aria-label="Enviar comentário"
        >
          <Send size={18} />
        </button>
      </form>
    </>
  )
}
