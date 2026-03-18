'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const WILAYAH: Record<string, string[]> = {
  'Aceh': ['Kab. Aceh Barat','Kab. Aceh Barat Daya','Kab. Aceh Besar','Kab. Aceh Jaya','Kab. Aceh Selatan','Kab. Aceh Singkil','Kab. Aceh Tamiang','Kab. Aceh Tengah','Kab. Aceh Tenggara','Kab. Aceh Timur','Kab. Aceh Utara','Kab. Bener Meriah','Kab. Bireuen','Kab. Gayo Lues','Kab. Nagan Raya','Kab. Pidie','Kab. Pidie Jaya','Kab. Simeulue','Kota Banda Aceh','Kota Langsa','Kota Lhokseumawe','Kota Sabang','Kota Subulussalam'],
  'Sumatera Utara': ['Kab. Asahan','Kab. Batu Bara','Kab. Dairi','Kab. Deli Serdang','Kab. Humbang Hasundutan','Kab. Karo','Kab. Labuhanbatu','Kab. Labuhanbatu Selatan','Kab. Labuhanbatu Utara','Kab. Langkat','Kab. Mandailing Natal','Kab. Nias','Kab. Nias Barat','Kab. Nias Selatan','Kab. Nias Utara','Kab. Padang Lawas','Kab. Padang Lawas Utara','Kab. Pakpak Bharat','Kab. Samosir','Kab. Serdang Bedagai','Kab. Simalungun','Kab. Tapanuli Selatan','Kab. Tapanuli Tengah','Kab. Tapanuli Utara','Kab. Toba','Kota Binjai','Kota Gunungsitoli','Kota Medan','Kota Padangsidimpuan','Kota Pematangsiantar','Kota Sibolga','Kota Tanjungbalai','Kota Tebing Tinggi'],
  'Sumatera Barat': ['Kab. Agam','Kab. Dharmasraya','Kab. Kepulauan Mentawai','Kab. Lima Puluh Kota','Kab. Padang Pariaman','Kab. Pasaman','Kab. Pasaman Barat','Kab. Pesisir Selatan','Kab. Sijunjung','Kab. Solok','Kab. Solok Selatan','Kab. Tanah Datar','Kota Bukittinggi','Kota Padang','Kota Padang Panjang','Kota Pariaman','Kota Payakumbuh','Kota Sawahlunto','Kota Solok'],
  'Riau': ['Kab. Bengkalis','Kab. Indragiri Hilir','Kab. Indragiri Hulu','Kab. Kampar','Kab. Kepulauan Meranti','Kab. Kuantan Singingi','Kab. Pelalawan','Kab. Rokan Hilir','Kab. Rokan Hulu','Kab. Siak','Kota Dumai','Kota Pekanbaru'],
  'Kepulauan Riau': ['Kab. Bintan','Kab. Karimun','Kab. Kepulauan Anambas','Kab. Lingga','Kab. Natuna','Kota Batam','Kota Tanjungpinang'],
  'Jambi': ['Kab. Batanghari','Kab. Bungo','Kab. Kerinci','Kab. Merangin','Kab. Muaro Jambi','Kab. Sarolangun','Kab. Tanjung Jabung Barat','Kab. Tanjung Jabung Timur','Kab. Tebo','Kota Jambi','Kota Sungai Penuh'],
  'Sumatera Selatan': ['Kab. Banyuasin','Kab. Empat Lawang','Kab. Lahat','Kab. Muara Enim','Kab. Musi Banyuasin','Kab. Musi Rawas','Kab. Musi Rawas Utara','Kab. Ogan Ilir','Kab. Ogan Komering Ilir','Kab. Ogan Komering Ulu','Kab. Ogan Komering Ulu Selatan','Kab. Ogan Komering Ulu Timur','Kab. Penukal Abab Lematang Ilir','Kota Lubuklinggau','Kota Pagar Alam','Kota Palembang','Kota Prabumulih'],
  'Bangka Belitung': ['Kab. Bangka','Kab. Bangka Barat','Kab. Bangka Selatan','Kab. Bangka Tengah','Kab. Belitung','Kab. Belitung Timur','Kota Pangkalpinang'],
  'Bengkulu': ['Kab. Bengkulu Selatan','Kab. Bengkulu Tengah','Kab. Bengkulu Utara','Kab. Kaur','Kab. Kepahiang','Kab. Lebong','Kab. Mukomuko','Kab. Rejang Lebong','Kab. Seluma','Kota Bengkulu'],
  'Lampung': ['Kab. Lampung Barat','Kab. Lampung Selatan','Kab. Lampung Tengah','Kab. Lampung Timur','Kab. Lampung Utara','Kab. Mesuji','Kab. Pesawaran','Kab. Pesisir Barat','Kab. Pringsewu','Kab. Tanggamus','Kab. Tulang Bawang','Kab. Tulang Bawang Barat','Kab. Way Kanan','Kota Bandar Lampung','Kota Metro'],
  'DKI Jakarta': ['Kab. Kepulauan Seribu','Kota Jakarta Barat','Kota Jakarta Pusat','Kota Jakarta Selatan','Kota Jakarta Timur','Kota Jakarta Utara'],
  'Jawa Barat': ['Kab. Bandung','Kab. Bandung Barat','Kab. Bekasi','Kab. Bogor','Kab. Ciamis','Kab. Cianjur','Kab. Cirebon','Kab. Garut','Kab. Indramayu','Kab. Karawang','Kab. Kuningan','Kab. Majalengka','Kab. Pangandaran','Kab. Purwakarta','Kab. Subang','Kab. Sukabumi','Kab. Sumedang','Kab. Tasikmalaya','Kota Bandung','Kota Bekasi','Kota Bogor','Kota Cimahi','Kota Cirebon','Kota Depok','Kota Sukabumi','Kota Tasikmalaya'],
  'Banten': ['Kab. Lebak','Kab. Pandeglang','Kab. Serang','Kab. Tangerang','Kota Cilegon','Kota Serang','Kota Tangerang','Kota Tangerang Selatan'],
  'Jawa Tengah': ['Kab. Banjarnegara','Kab. Banyumas','Kab. Batang','Kab. Blora','Kab. Boyolali','Kab. Brebes','Kab. Cilacap','Kab. Demak','Kab. Grobogan','Kab. Jepara','Kab. Karanganyar','Kab. Kebumen','Kab. Kendal','Kab. Klaten','Kab. Kudus','Kab. Magelang','Kab. Pati','Kab. Pekalongan','Kab. Pemalang','Kab. Purbalingga','Kab. Purworejo','Kab. Rembang','Kab. Semarang','Kab. Sragen','Kab. Sukoharjo','Kab. Tegal','Kab. Temanggung','Kab. Wonogiri','Kab. Wonosobo','Kota Magelang','Kota Pekalongan','Kota Salatiga','Kota Semarang','Kota Surakarta','Kota Tegal'],
  'DI Yogyakarta': ['Kab. Bantul','Kab. Gunungkidul','Kab. Kulon Progo','Kab. Sleman','Kota Yogyakarta'],
  'Jawa Timur': ['Kab. Bangkalan','Kab. Banyuwangi','Kab. Blitar','Kab. Bojonegoro','Kab. Bondowoso','Kab. Gresik','Kab. Jember','Kab. Jombang','Kab. Kediri','Kab. Lamongan','Kab. Lumajang','Kab. Madiun','Kab. Magetan','Kab. Malang','Kab. Mojokerto','Kab. Nganjuk','Kab. Ngawi','Kab. Pacitan','Kab. Pamekasan','Kab. Pasuruan','Kab. Ponorogo','Kab. Probolinggo','Kab. Sampang','Kab. Sidoarjo','Kab. Situbondo','Kab. Sumenep','Kab. Trenggalek','Kab. Tuban','Kab. Tulungagung','Kota Batu','Kota Blitar','Kota Kediri','Kota Madiun','Kota Malang','Kota Mojokerto','Kota Pasuruan','Kota Probolinggo','Kota Surabaya'],
  'Bali': ['Kab. Badung','Kab. Bangli','Kab. Buleleng','Kab. Gianyar','Kab. Jembrana','Kab. Karangasem','Kab. Klungkung','Kab. Tabanan','Kota Denpasar'],
  'Nusa Tenggara Barat': ['Kab. Bima','Kab. Dompu','Kab. Lombok Barat','Kab. Lombok Tengah','Kab. Lombok Timur','Kab. Lombok Utara','Kab. Sumbawa','Kab. Sumbawa Barat','Kota Bima','Kota Mataram'],
  'Nusa Tenggara Timur': ['Kab. Alor','Kab. Belu','Kab. Ende','Kab. Flores Timur','Kab. Kupang','Kab. Lembata','Kab. Malaka','Kab. Manggarai','Kab. Manggarai Barat','Kab. Manggarai Timur','Kab. Nagekeo','Kab. Ngada','Kab. Rote Ndao','Kab. Sabu Raijua','Kab. Sikka','Kab. Sumba Barat','Kab. Sumba Barat Daya','Kab. Sumba Tengah','Kab. Sumba Timur','Kab. Timor Tengah Selatan','Kab. Timor Tengah Utara','Kota Kupang'],
  'Kalimantan Barat': ['Kab. Bengkayang','Kab. Kapuas Hulu','Kab. Kayong Utara','Kab. Ketapang','Kab. Kubu Raya','Kab. Landak','Kab. Melawi','Kab. Mempawah','Kab. Sambas','Kab. Sanggau','Kab. Sekadau','Kab. Sintang','Kota Pontianak','Kota Singkawang'],
  'Kalimantan Tengah': ['Kab. Barito Selatan','Kab. Barito Timur','Kab. Barito Utara','Kab. Gunung Mas','Kab. Kapuas','Kab. Katingan','Kab. Kotawaringin Barat','Kab. Kotawaringin Timur','Kab. Lamandau','Kab. Murung Raya','Kab. Pulang Pisau','Kab. Seruyan','Kab. Sukamara','Kota Palangka Raya'],
  'Kalimantan Selatan': ['Kab. Balangan','Kab. Banjar','Kab. Barito Kuala','Kab. Hulu Sungai Selatan','Kab. Hulu Sungai Tengah','Kab. Hulu Sungai Utara','Kab. Kotabaru','Kab. Tabalong','Kab. Tanah Bumbu','Kab. Tanah Laut','Kab. Tapin','Kota Banjarbaru','Kota Banjarmasin'],
  'Kalimantan Timur': ['Kab. Berau','Kab. Kutai Barat','Kab. Kutai Kartanegara','Kab. Kutai Timur','Kab. Mahakam Ulu','Kab. Paser','Kab. Penajam Paser Utara','Kota Balikpapan','Kota Bontang','Kota Samarinda'],
  'Kalimantan Utara': ['Kab. Bulungan','Kab. Malinau','Kab. Nunukan','Kab. Tana Tidung','Kota Tarakan'],
  'Sulawesi Utara': ['Kab. Bolaang Mongondow','Kab. Bolaang Mongondow Selatan','Kab. Bolaang Mongondow Timur','Kab. Bolaang Mongondow Utara','Kab. Kepulauan Sangihe','Kab. Kepulauan Siau Tagulandang Biaro','Kab. Kepulauan Talaud','Kab. Minahasa','Kab. Minahasa Selatan','Kab. Minahasa Tenggara','Kab. Minahasa Utara','Kota Bitung','Kota Kotamobagu','Kota Manado','Kota Tomohon'],
  'Sulawesi Tengah': ['Kab. Banggai','Kab. Banggai Kepulauan','Kab. Banggai Laut','Kab. Buol','Kab. Donggala','Kab. Morowali','Kab. Morowali Utara','Kab. Parigi Moutong','Kab. Poso','Kab. Sigi','Kab. Tojo Una-Una','Kab. Tolitoli','Kota Palu'],
  'Sulawesi Selatan': ['Kab. Bantaeng','Kab. Barru','Kab. Bone','Kab. Bulukumba','Kab. Enrekang','Kab. Gowa','Kab. Jeneponto','Kab. Kepulauan Selayar','Kab. Luwu','Kab. Luwu Timur','Kab. Luwu Utara','Kab. Maros','Kab. Pangkajene dan Kepulauan','Kab. Pinrang','Kab. Sidenreng Rappang','Kab. Sinjai','Kab. Soppeng','Kab. Takalar','Kab. Tana Toraja','Kab. Toraja Utara','Kab. Wajo','Kota Makassar','Kota Palopo','Kota Parepare'],
  'Sulawesi Tenggara': ['Kab. Bombana','Kab. Buton','Kab. Buton Selatan','Kab. Buton Tengah','Kab. Buton Utara','Kab. Kolaka','Kab. Kolaka Timur','Kab. Kolaka Utara','Kab. Konawe','Kab. Konawe Kepulauan','Kab. Konawe Selatan','Kab. Konawe Utara','Kab. Muna','Kab. Muna Barat','Kab. Wakatobi','Kota Bau-Bau','Kota Kendari'],
  'Gorontalo': ['Kab. Bone Bolango','Kab. Gorontalo','Kab. Gorontalo Utara','Kab. Pahuwato','Kab. Pohuwato','Kota Gorontalo'],
  'Sulawesi Barat': ['Kab. Majene','Kab. Mamasa','Kab. Mamuju','Kab. Mamuju Tengah','Kab. Pasangkayu','Kab. Polewali Mandar'],
  'Maluku': ['Kab. Buru','Kab. Buru Selatan','Kab. Kepulauan Aru','Kab. Maluku Barat Daya','Kab. Maluku Tengah','Kab. Maluku Tenggara','Kab. Maluku Tenggara Barat','Kab. Seram Bagian Barat','Kab. Seram Bagian Timur','Kota Ambon','Kota Tual'],
  'Maluku Utara': ['Kab. Halmahera Barat','Kab. Halmahera Selatan','Kab. Halmahera Tengah','Kab. Halmahera Timur','Kab. Halmahera Utara','Kab. Kepulauan Sula','Kab. Pulau Morotai','Kab. Pulau Taliabu','Kota Ternate','Kota Tidore Kepulauan'],
  'Papua Barat': ['Kab. Fakfak','Kab. Kaimana','Kab. Manokwari','Kab. Manokwari Selatan','Kab. Maybrat','Kab. Pegunungan Arfak','Kab. Raja Ampat','Kab. Sorong','Kab. Sorong Selatan','Kab. Tambrauw','Kab. Teluk Bintuni','Kab. Teluk Wondama','Kota Sorong'],
  'Papua Barat Daya': ['Kab. Maybrat','Kab. Raja Ampat','Kab. Sorong','Kab. Sorong Selatan','Kab. Tambrauw','Kota Sorong'],
  'Papua': ['Kab. Asmat','Kab. Biak Numfor','Kab. Boven Digoel','Kab. Deiyai','Kab. Dogiyai','Kab. Intan Jaya','Kab. Jayapura','Kab. Jayawijaya','Kab. Keerom','Kab. Kepulauan Yapen','Kab. Lanny Jaya','Kab. Mamberamo Raya','Kab. Mamberamo Tengah','Kab. Mappi','Kab. Merauke','Kab. Mimika','Kab. Nabire','Kab. Nduga','Kab. Paniai','Kab. Pegunungan Bintang','Kab. Puncak','Kab. Puncak Jaya','Kab. Sarmi','Kab. Supiori','Kab. Tolikara','Kab. Waropen','Kab. Yahukimo','Kab. Yalimo','Kota Jayapura'],
  'Papua Tengah': ['Kab. Deiyai','Kab. Dogiyai','Kab. Intan Jaya','Kab. Mimika','Kab. Nabire','Kab. Paniai','Kab. Puncak','Kab. Puncak Jaya'],
  'Papua Pegunungan': ['Kab. Jayawijaya','Kab. Lanny Jaya','Kab. Mamberamo Tengah','Kab. Nduga','Kab. Pegunungan Bintang','Kab. Tolikara','Kab. Yahukimo','Kab. Yalimo'],
  'Papua Selatan': ['Kab. Asmat','Kab. Boven Digoel','Kab. Mappi','Kab. Merauke'],
}

const PROVINCES      = Object.keys(WILAYAH).sort()
const RELATION_ROLES = ['Orang Tua', 'Wali', 'Diri Sendiri']

export default function SiswaEditPage() {
  const params   = useParams()
  const router   = useRouter()
  const siswaId  = params.id as string
  const supabase = createClient()

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const [profileId, setProfileId] = useState('')

  const [form, setForm] = useState({
    full_name:      '',
    phone:          '',
    email:          '',
    birth_date:     '',
    province:       '',
    city:           '',
    relation_name:  '',
    relation_role:  'Orang Tua',
    relation_phone: '',
    relation_email: '',
    school:         '',
    grade:          '',
    notes:          '',
  })

  const cities = form.province ? (WILAYAH[form.province] ?? []) : []

  useEffect(() => { fetchSiswa() }, [siswaId])

  async function fetchSiswa() {
    setLoading(true)
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id, profile_id, birth_date, province, city, relation_name, relation_role, relation_phone, relation_email, school, grade, notes')
      .eq('id', siswaId)
      .single()

    if (sErr || !student) { setError('Siswa tidak ditemukan.'); setLoading(false); return }

    setProfileId(student.profile_id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', student.profile_id)
      .single()

    setForm({
      full_name:      profile?.full_name ?? '',
      phone:          profile?.phone ?? '',
      email:          profile?.email ?? '',
      birth_date:     student.birth_date ?? '',
      province:       student.province ?? '',
      city:           student.city ?? '',
      relation_name:  student.relation_name ?? '',
      relation_role:  student.relation_role ?? 'Orang Tua',
      relation_phone: student.relation_phone ?? '',
      relation_email: student.relation_email ?? '',
      school:         student.school ?? '',
      grade:          student.grade ?? '',
      notes:          student.notes ?? '',
    })
    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    if (name === 'province') {
      setForm(prev => ({ ...prev, province: value, city: '' }))
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Nama siswa wajib diisi.'); return }
    setSaving(true); setError('')

    // Update profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        phone:     form.phone.trim() || null,
        email:     form.email.trim() || null,
      })
      .eq('id', profileId)

    if (profileErr) { setError(profileErr.message); setSaving(false); return }

    // Update student
    const { error: studentErr } = await supabase
      .from('students')
      .update({
        birth_date:     form.birth_date || null,
        province:       form.province || null,
        city:           form.city || null,
        relation_name:  form.relation_name.trim() || null,
        relation_role:  form.relation_role || null,
        relation_phone: form.relation_phone.trim() || null,
        relation_email: form.relation_email.trim() || null,
        school:         form.school.trim() || null,
        grade:          form.grade.trim() || null,
        notes:          form.notes.trim() || null,
      })
      .eq('id', siswaId)

    if (studentErr) { setError(studentErr.message); setSaving(false); return }

    setSaving(false); setSuccess(true)
    setTimeout(() => router.push('/admin/siswa'), 1200)
  }

  const inputCls = "w-full px-3.5 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] placeholder:text-[#7B78A8] focus:outline-none focus:border-[#5C4FE5] focus:bg-white transition"
  const labelCls = "block text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-1.5"

  if (loading) return <div className="p-6 text-sm text-[#7B78A8]">Memuat data siswa...</div>

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/siswa" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors">← Kembali</Link>
        <h1 className="text-2xl font-black text-[#1A1640]" style={{fontFamily:'Sora,sans-serif'}}>Edit Siswa</h1>
      </div>

      {success && (
        <div className="mb-4 px-4 py-3 bg-[#E6F4EC] border border-green-200 rounded-xl text-sm text-green-700 font-semibold">
          ✅ Data siswa berhasil diperbarui! Mengalihkan...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* DATA SISWA */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4">
          <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Data Siswa</p>

          <div>
            <label className={labelCls}>Nama Lengkap <span className="text-red-500">*</span></label>
            <input type="text" name="full_name" value={form.full_name} onChange={handleChange}
              placeholder="Nama lengkap siswa" className={inputCls}/>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>No. HP Siswa</label>
              <input type="text" name="phone" value={form.phone} onChange={handleChange}
                placeholder="08xxxxxxxxxx" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Email <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="email@contoh.com" className={inputCls}/>
            </div>
          </div>

          <div>
            <label className={labelCls}>Tanggal Lahir <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
            <input type="date" name="birth_date" value={form.birth_date} onChange={handleChange} className={inputCls}/>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Provinsi <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <select name="province" value={form.province} onChange={handleChange} className={inputCls}>
                <option value="">-- Pilih Provinsi --</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Kabupaten/Kota <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <select name="city" value={form.city} onChange={handleChange}
                disabled={!form.province} className={`${inputCls} ${!form.province ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <option value="">-- Pilih Kab/Kota --</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Sekolah <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="text" name="school" value={form.school} onChange={handleChange}
                placeholder="Nama sekolah" className={inputCls}/>
            </div>
            <div>
              <label className={labelCls}>Kelas/Tingkat <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
              <input type="text" name="grade" value={form.grade} onChange={handleChange}
                placeholder="Kelas 10 / Semester 3" className={inputCls}/>
            </div>
          </div>
        </div>

        {/* PIHAK BERELASI */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6 space-y-4">
          <div>
            <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide">Pihak Berelasi</p>
            <p className="text-xs text-[#7B78A8] mt-0.5">Orang tua, wali, atau siswa sendiri jika sudah dewasa</p>
          </div>

          <div>
            <label className={labelCls}>Hubungan</label>
            <select name="relation_role" value={form.relation_role} onChange={handleChange} className={inputCls}>
              {RELATION_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {form.relation_role !== 'Diri Sendiri' ? (
            <>
              <div>
                <label className={labelCls}>Nama {form.relation_role}</label>
                <input type="text" name="relation_name" value={form.relation_name} onChange={handleChange}
                  placeholder={`Nama ${form.relation_role.toLowerCase()} siswa`} className={inputCls}/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>No. HP {form.relation_role}</label>
                  <input type="text" name="relation_phone" value={form.relation_phone} onChange={handleChange}
                    placeholder="08xxxxxxxxxx" className={inputCls}/>
                  <p className="text-xs text-[#7B78A8] mt-1">Untuk notifikasi WhatsApp</p>
                </div>
                <div>
                  <label className={labelCls}>Email {form.relation_role} <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
                  <input type="email" name="relation_email" value={form.relation_email} onChange={handleChange}
                    placeholder="email@contoh.com" className={inputCls}/>
                  <p className="text-xs text-[#7B78A8] mt-1">Untuk akses Google Drive</p>
                </div>
              </div>
            </>
          ) : (
            <div className="px-4 py-3 bg-[#EEEDFE] rounded-xl">
              <p className="text-xs font-semibold text-[#3C3489]">
                💡 Notifikasi WA dan akses Google Drive akan menggunakan data kontak siswa di atas.
              </p>
            </div>
          )}
        </div>

        {/* CATATAN */}
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-6">
          <label className={labelCls}>Catatan <span className="normal-case font-normal text-[#7B78A8]">(opsional)</span></label>
          <textarea name="notes" value={form.notes} onChange={handleChange}
            placeholder="Catatan tambahan tentang siswa ini..."
            rows={3} className={`${inputCls} resize-none`}/>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-semibold">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving || success}
            className="flex-1 py-3 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
          <Link href="/admin/siswa"
            className="px-6 py-3 border border-[#E5E3FF] text-[#4A4580] font-bold rounded-xl text-sm hover:bg-[#F0EFFF] transition text-center">
            Batal
          </Link>
        </div>
      </form>
    </div>
  )
}
