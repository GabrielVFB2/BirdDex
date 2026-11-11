import { supabase } from '@/lib/supabase'

export type NotificationType = 'like' | 'comment' | 'follow' | 'message'

export async function createNotification(params: {
  type: NotificationType
  actorId: string
  userId: string
  postId?: string
}) {
  if (params.actorId === params.userId) return

  await supabase.from('notifications').insert({
    type: params.type,
    actor_id: params.actorId,
    user_id: params.userId,
    post_id: params.postId ?? null,
  })
}
