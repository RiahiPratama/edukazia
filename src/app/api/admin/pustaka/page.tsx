'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type Product = {
  id:                   string
  title:                string
  slug:                 string
  subject:              string
  level_label:          string | null
  product_type:         string
  thumbnail_url:        string | null
  price:                number
  is_free_for_enrolled: boolean
  is_published:         boolean
  content_count:        number
  slide_count:          number
  created_at:           string
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

export default function AdminPustakaPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading,  setLoading]  = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/pustaka/products')
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const togglePublish = async (p: Product) => {
    await fetch(`/api/admin/pustaka/products/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !p.is_published })
    })
    load()
  }

  const handleDelete = async (p: Product) => {
    if (!confirm(`Hapus produk "${p.title}"? Tindakan ini tidak bisa dibatalkan.`)) return
    setDeleting(p.id)
    const res = await fetch(`/api/admin/pustaka/products/${p.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Gagal menghapus produk')
    } else {
      load()
    }
    setDeleting(null)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800 font-sora">Pustaka</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kelola produk digital EduKazia</p>
        </div>
        <Link
          href="/admin/pustaka/tambah"
          className="bg-[#5C4FE5] hover:bg-[#4a3fd4] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          + Tambah Produk
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Produk',   value: products.length },
          { label: 'Published',      value: products.filter(p => p.is_published).length },
          { label: 'Draft',          value: products.filter(p => !p.is_published).length },
          { label: 'Gratis Siswa',   value: products.filter(p => p.is_free_for_enrolled).length },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-[#E5E3FF] p-4">
            <div className="text-2xl font-bold text-[#5C4FE5]">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-[#E5E3FF] p-4 animate-pulse h-20" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && products.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-16 text-center">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500 font-medium">Belum ada produk Pustaka</p>
          <Link href="/admin/pustaka/tambah" className="text-[#5C4FE5] text-sm underline mt-2 inline-block">
            Tambah produk pertama
          </Link>
        </div>
      )}

      {/* Tabel */}
      {!loading && products.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F0EEFF] bg-[#F7F6FF]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Produk</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Subjek</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Konten</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Harga</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7F6FF]">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-[#F7F6FF] transition-colors">
                    {/* Produk */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#F0EEFF] overflow-hidden flex-shrink-0">
                          {p.thumbnail_url ? (
                            <Image src={p.thumbnail_url} alt={p.title} width={40} height={40} className="object-cover w-full h-full" />
                          ) : (
                            <div className="flex items-center justify-center h-full text-lg">📄</div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 leading-tight">{p.title}</p>
                          <p className="text-xs text-gray-400">{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    {/* Subjek */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SUBJECT_COLORS[p.subject] || 'bg-gray-100 text-gray-600'}`}>
                        {SUBJECT_LABELS[p.subject] || p.subject}
                      </span>
                      {p.level_label && <p className="text-xs text-gray-400 mt-0.5">{p.level_label}</p>}
                    </td>
                    {/* Konten */}
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.content_count > 0 && <div>📄 {p.content_count} file</div>}
                      {p.slide_count   > 0 && <div>🎞️ {p.slide_count} slide</div>}
                      {p.content_count === 0 && p.slide_count === 0 && <span className="text-gray-300">—</span>}
                    </td>
                    {/* Harga */}
                    <td className="px-4 py-3">
                      {p.price === 0 ? (
                        <span className="text-green-600 font-semibold text-xs">Gratis</span>
                      ) : (
                        <span className="text-[#5C4FE5] font-semibold text-xs">
                          Rp {p.price.toLocaleString('id-ID')}
                        </span>
                      )}
                      {p.is_free_for_enrolled && (
                        <p className="text-xs text-gray-400">Gratis siswa</p>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePublish(p)}
                        className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                          p.is_published
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {p.is_published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    {/* Aksi */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/pustaka/${p.id}`}
                          className="text-xs text-[#5C4FE5] hover:underline font-medium"
                        >
                          Edit
                        </Link>
                        <span className="text-gray-200">|</span>
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={deleting === p.id}
                          className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-50"
                        >
                          {deleting === p.id ? '...' : 'Hapus'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
