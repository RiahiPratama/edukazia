'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type FormData = {
  title:                string
  slug:                 string
  description:          string
  subject:              string
  level_label:          string
  product_type:         string
  price:                string
  is_free_for_enrolled: boolean
  is_published:         boolean
}

function toSlug(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export default function TambahPustakaPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormData>({
    title:                '',
    slug:                 '',
    description:          '',
    subject:              'english',
    level_label:          '',
    product_type:         'pdf',
    price:                '0',
    is_free_for_enrolled: true,
    is_published:         false,
  })

  const [thumbnail,    setThumbnail]    = useState<File | null>(null)
  const [thumbPreview, setThumbPreview] = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  const handleTitleChange = (v: string) => {
    setForm(f => ({ ...f, title: v, slug: toSlug(v) }))
  }

  const handleThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setThumbnail(file)
    setThumbPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.title.trim()) return setError('Judul wajib diisi')
    if (!form.slug.trim())  return setError('Slug wajib diisi')

    setSaving(true)
    try {
      let thumbnail_url: string | null = null

      // Upload thumbnail jika ada
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

      const res = await fetch('/api/admin/pustaka/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price:        parseInt(form.price) || 0,
          thumbnail_url
        })
      })

      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Gagal menyimpan produk')

      router.push(`/admin/pustaka/${data.product.id}`)

    } catch (err: unknown) {
      setError('Terjadi kesalahan, coba lagi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Kembali
        </button>
        <h1 className="text-xl font-bold text-gray-800 font-sora">Tambah Produk Pustaka</h1>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-5">

        {/* Thumbnail */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Thumbnail</label>
          <div
            onClick={() => fileRef.current?.click()}
            className="w-full h-40 rounded-xl border-2 border-dashed border-[#E5E3FF] hover:border-[#5C4FE5] flex items-center justify-center cursor-pointer transition-colors overflow-hidden bg-[#F7F6FF]"
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
        </div>

        {/* Judul */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Judul Produk <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Contoh: Simple Present Tense - A1"
            className="w-full border border-[#E5E3FF] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5C4FE5]"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Slug (URL) <span className="text-red-400">*</span></label>
          <div className="flex items-center border border-[#E5E3FF] rounded-xl overflow-hidden focus-within:border-[#5C4FE5]">
            <span className="px-3 py-2.5 text-sm text-gray-400 bg-[#F7F6FF] border-r border-[#E5E3FF]">/pustaka/</span>
            <input
              type="text"
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: toSlug(e.target.value) }))}
              className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Deskripsi */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Deskripsi</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            placeholder="Deskripsi singkat produk ini..."
            className="w-full border border-[#E5E3FF] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5C4FE5] resize-none"
          />
        </div>

        {/* Subjek + Level */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mata Pelajaran <span className="text-red-400">*</span></label>
            <select
              value={form.subject}
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
              value={form.level_label}
              onChange={e => setForm(f => ({ ...f, level_label: e.target.value }))}
              placeholder="A1, A2, Grade 4..."
              className="w-full border border-[#E5E3FF] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5C4FE5]"
            />
          </div>
        </div>

        {/* Tipe Produk */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipe Produk <span className="text-red-400">*</span></label>
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
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            min={0}
            placeholder="0 = gratis"
            className="w-full border border-[#E5E3FF] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5C4FE5]"
          />
          <p className="text-xs text-gray-400 mt-1">Isi 0 untuk produk gratis untuk semua</p>
        </div>

        {/* Toggle */}
        <div className="space-y-3">
          {[
            { key: 'is_free_for_enrolled', label: 'Gratis untuk siswa EduKazia yang aktif enrolled' },
            { key: 'is_published',         label: 'Langsung publish (tampil di halaman Pustaka)' },
          ].map(t => (
            <label key={t.key} className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm(f => ({ ...f, [t.key]: !f[t.key as keyof FormData] }))}
                className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative ${
                  form[t.key as keyof FormData] ? 'bg-[#5C4FE5]' : 'bg-gray-200'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  form[t.key as keyof FormData] ? 'left-5' : 'left-1'
                }`} />
              </div>
              <span className="text-sm text-gray-600">{t.label}</span>
            </label>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full bg-[#5C4FE5] hover:bg-[#4a3fd4] text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
        >
          {saving ? 'Menyimpan...' : 'Simpan Produk'}
        </button>
      </div>
    </div>
  )
}
