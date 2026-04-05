'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

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
  is_published:         boolean
  course_id:            string | null
  level_id:             string | null
}

function toSlug(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

const TABS = [
  { key: 'info',    label: 'Info Produk' },
  { key: 'konten',  label: 'Konten Digital' },
  { key: 'slide',   label: 'Slide Interaktif' },
]

export default function EditPustakaPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [product,      setProduct]      = useState<Product | null>(null)
  const [form,         setForm]         = useState<Partial<Product>>({})
  const [tab,          setTab]          = useState('info')
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [thumbnail,    setThumbnail]    = useState<File | null>(null)
  const [thumbPreview, setThumbPreview] = useState<string | null>(null)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [notFound,     setNotFound]     = useState(false)

  // Load produk
  useEffect(() => {
    if (!id) return
    fetch(`/api/admin/pustaka/products/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then(d => {
        if (!d) return
        setProduct(d.product)
        setForm(d.product)
        if (d.product.thumbnail_url) setThumbPreview(d.product.thumbnail_url)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleTitleChange = (v: string) => {
    setForm(f => ({ ...f, title: v, slug: toSlug(v) }))
  }

  const handleThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbnail(file)
    setThumbPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    setError('')
    setSuccess('')
    if (!form.title?.trim()) return setError('Judul wajib diisi')
    if (!form.slug?.trim())  return setError('Slug wajib diisi')

    setSaving(true)
    try {
      let thumbnail_url = form.thumbnail_url

      // Upload thumbnail baru jika ada
      if (thumbnail) {
        const ext  = thumbnail.name.split('.').pop()
        const path = `thumbnails/${form.slug}-${Date.now()}.${ext}`

        const uploadRes = await fetch('/api/admin/pustaka/upload-thumbnail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, contentType: thumbnail.type })
        })
        const { signedUrl, publicUrl } = await uploadRes.json()

        if (signedUrl) {
          await fetch(signedUrl, {
            method: 'PUT',
            body: thumbnail,
            headers: { 'Content-Type': thumbnail.type }
          })
          thumbnail_url = publicUrl
        }
      }

      const res = await fetch(`/api/admin/pustaka/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, thumbnail_url, price: Number(form.price) || 0 })
      })

      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Gagal menyimpan')

      setProduct(data.product)
      setForm(data.product)
      setThumbnail(null)
      setSuccess('Produk berhasil disimpan!')
      setTimeout(() => setSuccess(''), 3000)

    } catch {
      setError('Terjadi kesalahan, coba lagi')
    } finally {
      setSaving(false)
    }
  }

  // ---- Render states ----
  if (loading) return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="h-8 bg-gray-100 rounded-xl w-48 animate-pulse mb-6" />
      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4 animate-pulse">
        {[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  )

  if (notFound) return (
    <div className="p-6 text-center">
      <p className="text-gray-500">Produk tidak ditemukan</p>
      <Link href="/admin/pustaka" className="text-[#5C4FE5] text-sm underline mt-2 inline-block">
        ← Kembali ke Pustaka
      </Link>
    </div>
  )

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/pustaka" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Pustaka
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-800 font-sora truncate max-w-xs">
            {product?.title}
          </h1>
        </div>
        {/* Badge status */}
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
          product?.is_published
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {product?.is_published ? 'Published' : 'Draft'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-[#E5E3FF] rounded-2xl p-1 mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-[#5C4FE5] text-white'
                : 'text-gray-500 hover:text-[#5C4FE5]'
            }`}
          >
            {t.label}
            {(t.key === 'konten' || t.key === 'slide') && (
              <span className="ml-1.5 text-xs opacity-60">Segera</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Info Produk */}
      {tab === 'info' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-5">

          {/* Thumbnail */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Thumbnail</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full h-44 rounded-xl border-2 border-dashed border-[#E5E3FF] hover:border-[#5C4FE5] flex items-center justify-center cursor-pointer transition-colors overflow-hidden bg-[#F7F6FF]"
            >
              {thumbPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbPreview} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <div className="text-3xl mb-1">🖼️</div>
                  <p className="text-xs text-gray-400">Klik untuk upload thumbnail</p>
                  <p className="text-xs text-gray-300">JPG / PNG, max 2MB</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleThumb} />
            {thumbnail && (
              <p className="text-xs text-[#5C4FE5] mt-1">📎 {thumbnail.name} — siap diupload saat simpan</p>
            )}
          </div>

          {/* Judul */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Judul Produk <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.title || ''}
              onChange={e => handleTitleChange(e.target.value)}
              className="w-full border border-[#E5E3FF] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5C4FE5]"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Slug (URL) <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center border border-[#E5E3FF] rounded-xl overflow-hidden focus-within:border-[#5C4FE5]">
              <span className="px-3 py-2.5 text-sm text-gray-400 bg-[#F7F6FF] border-r border-[#E5E3FF] whitespace-nowrap">
                /pustaka/
              </span>
              <input
                type="text"
                value={form.slug || ''}
                onChange={e => setForm(f => ({ ...f, slug: toSlug(e.target.value) }))}
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
              />
            </div>
          </div>

          {/* Deskripsi */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Deskripsi</label>
            <textarea
              value={form.description || ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full border border-[#E5E3FF] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5C4FE5] resize-none"
            />
          </div>

          {/* Subjek + Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mata Pelajaran</label>
              <select
                value={form.subject || 'english'}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                className="w-full border border-[#E5E3FF] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5C4FE5]"
              >
                <option value="english">Bahasa Inggris</option>
                <option value="math">Matematika</option>
                <option value="mandarin">Mandarin</option>
                <option value="arabic">Arab</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Level (opsional)</label>
              <input
                type="text"
                value={form.level_label || ''}
                onChange={e => setForm(f => ({ ...f, level_label: e.target.value }))}
                placeholder="A1, A2, Grade 4..."
                className="w-full border border-[#E5E3FF] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5C4FE5]"
              />
            </div>
          </div>

          {/* Tipe Produk */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipe Produk</label>
            <div className="flex gap-3">
              {[
                { value: 'pdf',    label: '📄 PDF' },
                { value: 'slide',  label: '🎞️ Slide' },
                { value: 'bundle', label: '📦 Bundle' },
              ].map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, product_type: t.value }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    form.product_type === t.value
                      ? 'bg-[#5C4FE5] text-white border-[#5C4FE5]'
                      : 'bg-white text-gray-600 border-[#E5E3FF] hover:border-[#5C4FE5]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Harga */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Harga (Rp)</label>
            <input
              type="number"
              value={form.price ?? 0}
              onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
              min={0}
              className="w-full border border-[#E5E3FF] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5C4FE5]"
            />
            <p className="text-xs text-gray-400 mt-1">Isi 0 untuk produk gratis semua orang</p>
          </div>

          {/* Toggle */}
          <div className="space-y-3 pt-1">
            {[
              { key: 'is_free_for_enrolled', label: 'Gratis untuk siswa EduKazia yang aktif enrolled' },
              { key: 'is_published',         label: 'Published — tampil di halaman Pustaka publik' },
            ].map(t => (
              <label key={t.key} className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, [t.key]: !f[t.key as keyof Product] }))}
                  className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative cursor-pointer ${
                    form[t.key as keyof Product] ? 'bg-[#5C4FE5]' : 'bg-gray-200'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    form[t.key as keyof Product] ? 'left-5' : 'left-1'
                  }`} />
                </div>
                <span className="text-sm text-gray-600">{t.label}</span>
              </label>
            ))}
          </div>

          {/* Error / Success */}
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl border border-green-100">
              ✅ {success}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-[#5C4FE5] hover:bg-[#4a3fd4] text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
            <Link
              href={`/pustaka/${form.slug}`}
              target="_blank"
              className="px-5 py-3 rounded-xl border border-[#E5E3FF] text-sm font-semibold text-gray-600 hover:border-[#5C4FE5] hover:text-[#5C4FE5] transition-all text-center"
            >
              Preview ↗
            </Link>
          </div>
        </div>
      )}

      {/* Tab: Konten Digital — coming soon */}
      {tab === 'konten' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-16 text-center">
          <div className="text-4xl mb-3">📄</div>
          <p className="font-semibold text-gray-700">Konten Digital</p>
          <p className="text-sm text-gray-400 mt-1">Upload PDF & audio — akan dikerjakan di step berikutnya</p>
        </div>
      )}

      {/* Tab: Slide Interaktif — coming soon */}
      {tab === 'slide' && (
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-16 text-center">
          <div className="text-4xl mb-3">🎞️</div>
          <p className="font-semibold text-gray-700">Slide Interaktif</p>
          <p className="text-sm text-gray-400 mt-1">Slide + hotspot audio — akan dikerjakan di step berikutnya</p>
        </div>
      )}

    </div>
  )
}
