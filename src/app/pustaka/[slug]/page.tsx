'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

type Content = {
  id:           string
  title:        string
  content_type: string
  position:     number
  file_size_kb: number | null
  duration_sec: number | null
}

type Slide = {
  id:           string
  slide_number: number
  title:        string | null
}

type Product = {
  id:                   string
  title:                string
  slug:                 string
  description:          string
  subject:              string
  level_label:          string
  product_type:         string
  thumbnail_url:        string | null
  price:                number
  is_free_for_enrolled: boolean
}

type AccessInfo = {
  has_access:  boolean
  access_type: string   // 'purchased' | 'enrolled_free' | 'none'
  expires_at:  string | null
}

const SUBJECT_LABELS: Record<string, string> = {
  english:  'Bahasa Inggris',
  math:     'Matematika',
  mandarin: 'Mandarin',
  arabic:   'Arab',
}

function formatSize(kb: number) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`
  return `${kb} KB`
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PustakaDetailPage() {
  const { slug }  = useParams<{ slug: string }>()
  const router    = useRouter()

  const [product,  setProduct]  = useState<Product | null>(null)
  const [contents, setContents] = useState<Content[]>([])
  const [slides,   setSlides]   = useState<Slide[]>([])
  const [access,   setAccess]   = useState<AccessInfo>({ has_access: false, access_type: 'none', expires_at: null })
  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/pustaka/products/${slug}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then(d => {
        if (!d) return
        setProduct(d.product)
        setContents(d.contents || [])
        setSlides(d.slides || [])
        setAccess(d.access)
      })
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="min-h-screen bg-[#F7F6FF] flex items-center justify-center">
      <div className="text-gray-400 text-sm animate-pulse">Memuat produk...</div>
    </div>
  )

  if (notFound || !product) return (
    <div className="min-h-screen bg-[#F7F6FF] flex flex-col items-center justify-center gap-3">
      <div className="text-4xl">🔍</div>
      <p className="text-gray-500 font-medium">Produk tidak ditemukan</p>
      <Link href="/pustaka" className="text-[#5C4FE5] text-sm underline">← Kembali ke Pustaka</Link>
    </div>
  )

  const isPurchased    = access.access_type === 'purchased'
  const isEnrolledFree = access.access_type === 'enrolled_free'
  const hasAccess      = access.has_access

  return (
    <div className="min-h-screen bg-[#F7F6FF]">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E3FF] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/pustaka" className="text-[#5C4FE5] hover:underline text-sm">
            ← Pustaka
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500 truncate">{product.title}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Kolom Kiri: Thumbnail + Aksi */}
        <div className="md:col-span-1">
          {/* Thumbnail */}
          <div className="relative h-56 bg-gradient-to-br from-[#F0EEFF] to-[#E5E3FF] rounded-2xl overflow-hidden mb-5">
            {product.thumbnail_url ? (
              <Image src={product.thumbnail_url} alt={product.title} fill className="object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-6xl opacity-20">📚</div>
            )}
          </div>

          {/* Harga */}
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-5 mb-4">
            {product.price === 0 ? (
              <div className="text-2xl font-bold text-green-600 mb-1">Gratis</div>
            ) : (
              <div className="text-2xl font-bold text-[#5C4FE5] mb-1">
                Rp {product.price.toLocaleString('id-ID')}
              </div>
            )}

            {product.is_free_for_enrolled && (
              <p className="text-xs text-green-600 mb-4">✓ Gratis untuk siswa EduKazia</p>
            )}

            {/* Status akses */}
            {hasAccess ? (
              <div className="space-y-2">
                <div className="bg-green-50 text-green-700 rounded-xl px-4 py-2 text-sm font-medium text-center">
                  {isPurchased    && '✅ Sudah dibeli'}
                  {isEnrolledFree && '✅ Akses siswa aktif'}
                </div>
                {access.expires_at && (
                  <p className="text-xs text-gray-400 text-center">
                    Aktif hingga {new Date(access.expires_at).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}
                  </p>
                )}
                <button
                  onClick={() => router.push(`/pustaka/${slug}/baca`)}
                  className="w-full bg-[#5C4FE5] hover:bg-[#4a3fd4] text-white font-semibold rounded-xl py-3 text-sm transition-colors"
                >
                  Buka Materi
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {product.price === 0 ? (
                  <button
                    onClick={() => router.push(`/pustaka/${slug}/baca`)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
                  >
                    Akses Gratis
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(`/pustaka/${slug}/beli`)}
                    className="w-full bg-[#5C4FE5] hover:bg-[#4a3fd4] text-white font-semibold rounded-xl py-3 text-sm transition-colors"
                  >
                    Beli Sekarang
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Info singkat */}
          <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 text-sm space-y-2 text-gray-600">
            <div className="flex justify-between">
              <span className="text-gray-400">Mata Pelajaran</span>
              <span className="font-medium">{SUBJECT_LABELS[product.subject] || product.subject}</span>
            </div>
            {product.level_label && (
              <div className="flex justify-between">
                <span className="text-gray-400">Level</span>
                <span className="font-medium">{product.level_label}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Tipe</span>
              <span className="font-medium capitalize">{product.product_type}</span>
            </div>
            {contents.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">File</span>
                <span className="font-medium">{contents.length} file</span>
              </div>
            )}
            {slides.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Slide</span>
                <span className="font-medium">{slides.length} slide</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Akses</span>
              <span className="font-medium">2 tahun</span>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Detail */}
        <div className="md:col-span-2 space-y-6">

          {/* Judul & deskripsi */}
          <div>
            <h1 className="text-2xl font-bold text-gray-800 font-sora leading-snug mb-3">
              {product.title}
            </h1>
            {product.description && (
              <p className="text-gray-500 text-sm leading-relaxed">{product.description}</p>
            )}
          </div>

          {/* Daftar konten PDF */}
          {contents.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0EEFF]">
                <h2 className="font-semibold text-gray-700 text-sm">📄 File Materi</h2>
              </div>
              <div className="divide-y divide-[#F7F6FF]">
                {contents.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-full bg-[#F0EEFF] flex items-center justify-center text-xs font-bold text-[#5C4FE5] flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium truncate">{c.title}</p>
                      <p className="text-xs text-gray-400 capitalize">
                        {c.content_type}
                        {c.file_size_kb && ` · ${formatSize(c.file_size_kb)}`}
                        {c.duration_sec && ` · ${formatDuration(c.duration_sec)}`}
                      </p>
                    </div>
                    {!hasAccess && (
                      <span className="text-gray-300 text-xs">🔒</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daftar slide */}
          {slides.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F0EEFF]">
                <h2 className="font-semibold text-gray-700 text-sm">🎞️ Slide Interaktif</h2>
              </div>
              <div className="divide-y divide-[#F7F6FF]">
                {slides.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-full bg-[#FFF8E0] flex items-center justify-center text-xs font-bold text-[#E6B800] flex-shrink-0">
                      {s.slide_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium truncate">
                        {s.title || `Slide ${s.slide_number}`}
                      </p>
                      <p className="text-xs text-gray-400">Slide interaktif dengan audio</p>
                    </div>
                    {!hasAccess && (
                      <span className="text-gray-300 text-xs">🔒</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA bawah */}
          {!hasAccess && product.price > 0 && (
            <div className="bg-[#F0EEFF] border border-[#E5E3FF] rounded-2xl p-5 text-center">
              <p className="text-sm text-gray-600 mb-3">
                Beli sekali, akses <strong>2 tahun</strong> penuh.
              </p>
              <button
                onClick={() => router.push(`/pustaka/${slug}/beli`)}
                className="bg-[#5C4FE5] hover:bg-[#4a3fd4] text-white font-semibold rounded-xl px-8 py-3 text-sm transition-colors"
              >
                Beli Rp {product.price.toLocaleString('id-ID')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
