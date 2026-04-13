// src/components/ui/Logo.tsx
// EduKazia Brand Logo — E-Bar Mark + Wordmark (Nunito 900)

import React from 'react'
import Link from 'next/link'

interface LogoProps {
  variant?: 'default' | 'white'
  size?: 'sm' | 'md' | 'lg'
  href?: string | null
  showWordmark?: boolean
  badge?: string
  className?: string
}

const SIZES = {
  sm: { w: 36, h: 29, fs: 20, gap: 8 },
  md: { w: 44, h: 36, fs: 26, gap: 10 },
  lg: { w: 56, h: 46, fs: 32, gap: 12 },
}

const VARIANTS = {
  default: { bar1:'#E6B800', bar2:'#5C4FE5', bar3:'#8070F0', edu:'#5C4FE5', kazia:'#E6B800' },
  white:   { bar1:'#E6B800', bar2:'rgba(255,255,255,0.90)', bar3:'rgba(255,255,255,0.45)', edu:'rgba(255,255,255,0.92)', kazia:'#E6B800' },
}

export function Logo({ variant='default', size='md', href='/', showWordmark=true, badge, className='' }: LogoProps) {
  const s = SIZES[size]
  const v = VARIANTS[variant]

  const mark = (
    <svg width={s.w} height={s.h} viewBox="0 0 88 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink:0 }}>
      <rect x="0" y="0"  width="84" height="18" rx="9" fill={v.bar1}/>
      <rect x="0" y="27" width="59" height="18" rx="9" fill={v.bar2}/>
      <rect x="0" y="54" width="34" height="18" rx="9" fill={v.bar3}/>
    </svg>
  )

  const wordmark = showWordmark && (
    <span style={{ fontFamily:"var(--font-nunito,'Nunito',sans-serif)", fontWeight:900, fontSize:s.fs, letterSpacing:'-0.04em', lineHeight:1, userSelect:'none' }}>
      <span style={{ color:v.edu }}>edu</span><span style={{ color:v.kazia }}>kazia</span>
    </span>
  )

  const badgeEl = badge && (
    <span style={{ fontSize:11, fontWeight:600, color:variant==='white'?'#5C4FE5':'#fff', background:variant==='white'?'#E6B800':'#5C4FE5', padding:'2px 8px', borderRadius:999, flexShrink:0 }}>
      {badge}
    </span>
  )

  const inner = (
    <span className={className} style={{ display:'inline-flex', alignItems:'center', gap:s.gap }}>
      {mark}{wordmark}{badgeEl}
    </span>
  )

  if (href === null) return inner
  return <Link href={href} style={{ textDecoration:'none' }} aria-label="EduKazia">{inner}</Link>
}

export default Logo
