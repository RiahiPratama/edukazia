'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type Product = {
  id:                 string
  title:              string
  slug:               string
  description:        string
  subject:            string
  level_label:        string
  product_type:       string
  thumbnail_url:      string | null
  price:              number
  is_free_for_enrolled: boolean
  content_count:      number
  slide_count:        number
}

const SUBJECT_LABELS: Record<string, string> = {
  english:  'Bahasa Inggris',
  math:     'Matematika',
  mandarin: 'Mandarin',
  arabic:   'Arab',
}

const SUBJECT_COLORS: Record<string, string> = {
  english:  'bg-blue-100 text-blue-700',
  math:     'bg-green-100 text-green-700',
  mandarin: 'bg-red-100 text-red-700',
  arabic:   'bg-yellow-100 text-yellow-800',
}

const TYPE_ICON: Record<string, string> = {
  pdf:    '📄',
  slide:  '🎞️',
  bundle: '📦',
}

export default function PustakaPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filtered, setFiltered] = useState<Product[]>([])
  const [loading,  setLoading]  = useState(true)
  const [subject,  setSubject]  = useState('all')
  const [type,     setType]     = useState('all')

  useEffect(() => {
    fetch('/api/pustaka/products')
      .then(r => r.json())
      .then(d => {
        setProducts(d.products || [])
        setFiltered(d.products || [])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let res = [...products]
    if (subject !== 'all') res = res.filter(p => p.subject === subject)
    if (type    !== 'all') res = res.filter(p => p.product_type === type)
    setFiltered(res)
  }, [subject, type, products])

  return (
    <div className="min-h-screen bg-[#F7F6FF]">

      {/* Header */}
      <div className="bg-white border-b border-[#E5E3FF] px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-[#5C4FE5] font-sora">
            📚 EduKazia Pustaka
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Modul & materi digital untuk belajar mandiri
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Filter Bar */}
        <div className="flex flex-wrap gap-3 mb-8">
          {/* Subject filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'english', 'math'].map(s => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
                  ${subject === s
                    ? 'bg-[#5C4FE5] text-white'
                    : 'bg-white text-gray-600 border border-[#E5E3FF] hover:border-[#5C4FE5]'}`}
              >
                {s === 'all' ? 'Semua' : SUBJECT_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="w-px bg-[#E5E3FF] mx-1 hidden sm:block" />

          {/* Type filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'pdf', 'slide', 'bundle'].map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all
                  ${type === t
                    ? 'bg-[#E6B800] text-white'
                    : 'bg-white text-gray-600 border border-[#E5E3FF] hover:border-[#E6B800]'}`}
              >
                {t === 'all' ? 'Semua Tipe' : `${TYPE_ICON[t]} ${t.toUpperCase()}`}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-[#E5E3FF] p-4 animate-pulse">
                <div className="h-40 bg-gray-100 rounded-xl mb-4" />
                <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-medium">Belum ada produk yang tersedia</p>
            <p className="text-sm mt-1">Coba ubah filter di atas</p>
          </div>
        )}

        {/* Grid Produk */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(p => (
              <Link key={p.id} href={`/pustaka/${p.slug}`}>
                <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden hover:shadow-md hover:border-[#5C4FE5] transition-all group cursor-pointer h-full flex flex-col">

                  {/* Thumbnail */}
                  <div className="relative h-44 bg-gradient-to-br from-[#F0EEFF] to-[#E5E3FF] overflow-hidden">
                    {p.thumbnail_url ? (
                      <Image
                        src={p.thumbnail_url}
                        alt={p.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-5xl opacity-30">
                        {TYPE_ICON[p.product_type]}
                      </div>
                    )}
                    {/* Badge tipe */}
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-gray-700">
                      {TYPE_ICON[p.product_type]} {p.product_type.toUpperCase()}
                    </div>
                    {/* Badge gratis enrolled */}
                    {p.is_free_for_enrolled && (
                      <div className="absolute top-3 right-3 bg-green-500 text-white rounded-full px-2.5 py-1 text-xs font-semibold">
                        Gratis Siswa
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SUBJECT_COLORS[p.subject] || 'bg-gray-100 text-gray-600'}`}>
                        {SUBJECT_LABELS[p.subject] || p.subject}
                      </span>
                      {p.level_label && (
                        <span className="text-xs text-gray-400">{p.level_label}</span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-800 text-sm leading-snug mb-1 group-hover:text-[#5C4FE5] transition-colors line-clamp-2">
                      {p.title}
                    </h3>

                    {p.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{p.description}</p>
                    )}

                    {/* Meta konten */}
                    <div className="flex gap-3 text-xs text-gray-400 mt-auto mb-3">
                      {p.content_count > 0 && <span>📄 {p.content_count} file</span>}
                      {p.slide_count   > 0 && <span>🎞️ {p.slide_count} slide</span>}
                    </div>

                    {/* Harga */}
                    <div className="pt-3 border-t border-[#F0EEFF]">
                      {p.price === 0 ? (
                        <span className="text-green-600 font-bold text-sm">Gratis</span>
                      ) : (
                        <span className="text-[#5C4FE5] font-bold text-sm">
                          Rp {p.price.toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
