'use client'

import { createContext, useContext } from 'react'

export interface ChildInfo {
  id: string
  slug: string
  profile_id: string | null
  full_name: string
  grade: string | null
  school: string | null
  relation_role: string | null
}

export interface OrtuProfile {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
}

export interface OrtuContextType {
  profile: OrtuProfile
  children: ChildInfo[]
  isAlsoStudent: boolean
}

const OrtuContext = createContext<OrtuContextType | null>(null)
export const OrtuProvider = OrtuContext.Provider

export function useOrtu(): OrtuContextType {
  const ctx = useContext(OrtuContext)
  if (!ctx) throw new Error('useOrtu() harus digunakan di dalam OrtuLayout')
  return ctx
}
