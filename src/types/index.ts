export interface Profile {
  id: string
  username: string
  display_name: string
  bio: string
  location: string
  avatar_url: string
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  image_url: string
  caption: string
  location: string
  species_name: string
  species_scientific: string
  created_at: string
  profiles?: Profile
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export interface Like {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

export interface PostWithDetails extends Post {
  like_count?: number
  comment_count?: number
  liked_by_me?: boolean
}
