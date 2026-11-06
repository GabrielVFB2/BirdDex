import { createContext, useContext, useState, type ReactNode } from 'react'

export interface PostDraft {
  imageDataUrl: string | null
  caption: string
  location: string
  speciesName: string
  speciesScientific: string
}

const emptyDraft: PostDraft = {
  imageDataUrl: null,
  caption: '',
  location: '',
  speciesName: '',
  speciesScientific: '',
}

interface PostDraftContextValue {
  draft: PostDraft
  setDraft: (draft: PostDraft) => void
  updateDraft: (partial: Partial<PostDraft>) => void
  resetDraft: () => void
}

const PostDraftContext = createContext<PostDraftContextValue | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export function usePostDraft() {
  const context = useContext(PostDraftContext)
  if (!context) throw new Error('usePostDraft must be used within PostDraftProvider')
  return context
}

export function PostDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<PostDraft>(emptyDraft)

  const setDraft = (d: PostDraft) => setDraftState(d)
  const updateDraft = (partial: Partial<PostDraft>) =>
    setDraftState((prev) => ({ ...prev, ...partial }))
  const resetDraft = () => setDraftState(emptyDraft)

  return (
    <PostDraftContext.Provider value={{ draft, setDraft, updateDraft, resetDraft }}>
      {children}
    </PostDraftContext.Provider>
  )
}
