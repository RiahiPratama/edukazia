'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Users, CreditCard, ExternalLink, Check, Pencil, Trash2, ChevronLeft, ChevronDown, ChevronRight, X, BookOpen, Plus, Trash, AlertTriangle } from 'lucide-react'
import PerpanjangModal from '@/components/admin/PerpanjangModal'
import PeriodeJadwalTab from '@/components/admin/PeriodeJadwalTab'

type KelasDetail = {
  id: string; label: string; status: string; max_participants: number
  zoom_link: string | null; class_type_id: string
  courses: { name: string } | null; class_types: { name: string } | null
  tutors: { id: string; profiles: { full_name: string } | null } | null
}
type Enrollment = {
  id: string; student_id: string; sessions_total: number; session_start_offset: number
  sessions_used: number; status: 'active'|'renewed'|'inactive'|'completed'|'paused'|'transferred'
  student_name: string; attended_count: number; enrolled_at: string
}
type SessionAttendance = { student_id: string; student_name: string; status: string; notes: string | null }
type SessionReport = { student_id: string; student_name: string; materi: string|null; perkembangan: string|null; saran_siswa: string|null; saran_ortu: string|null; recording_url: string|null }
type SessionDetail = { attendances: SessionAttendance[]; reports: SessionReport[]; loading: boolean }
type Session = { id: string; scheduled_at: string; status: string; zoom_link: string | null; enrollment_id: string | null }
type Payment = { id: string; amount: number; status: string; period_label: string|null; method: string; created_at: string; student_name: string }
type Level = { id: string; name: string; description: string|null; target_age: string|null; sort_order: number }
type ClassGroupLevel = { id: string; level_id: string; level: Level }
type ChapterProgress = { unit: number; lesson: number }
type UnitRow = { id: string; unit_name: string; position: number; globalPos: number; chapter_id: string|null; level_id: string }
type LessonRow = { id: string; lesson_name: string; position: number; unit_id: string }
type ChapterRow = { id: string; chapter_title: string; order_number: number; level_id: string }
type ProgressLog = { id: string; student_id: string|null; chapter_id: string|null; from_unit: number; from_lesson: number; to_unit: number; to_lesson: number; action: string; created_at: string }

const STATUS_SESI: Record<string,{label:string;cls:string}> = {
  scheduled:{label:'Terjadwal',cls:'bg-[#EEEDFE] text-[#3C3489]'},
  completed:{label:'Selesai',cls:'bg-[#E6F4EC] text-[#1A5C36]'},
  cancelled:{label:'Dibatalkan',cls:'bg-[#FEE9E9] text-[#991B1B]'},
  rescheduled:{label:'Dijadwal Ulang',cls:'bg-[#FEF3E2] text-[#92400E]'},
}
const STATUS_BAYAR: Record<string,{label:string;cls:string}> = {
  unpaid:{label:'Belum Bayar',cls:'bg-[#FEE9E9] text-[#991B1B]'},
  pending:{label:'Menunggu',cls:'bg-[#FEF3E2] text-[#92400E]'},
  paid:{label:'Lunas',cls:'bg-[#E6F4EC] text-[#1A5C36]'},
  overdue:{label:'Terlambat',cls:'bg-[#FEE9E9] text-[#7F1D1D]'},
}
const AVATAR_COLORS = ['#5C4FE5','#27A05A','#D97706','#DC2626','#0891B2','#7C3AED','#BE185D','#065F46']

function fmtDate(iso:string){return new Date(iso).toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}
function fmtTime(iso:string){return new Date(iso).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',hour12:false})}
function fmtRp(n:number){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n)}
function getInitials(name:string){return name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}

/** Get sorted units for a chapter (by position ascending) */
function getChapterUnits(units: UnitRow[], chapterId: string): UnitRow[] {
  return units.filter(u => u.chapter_id === chapterId).sort((a,b) => a.position - b.position)
}
/** 1-based index of a unit within its chapter */
function unitIdxInChapter(units: UnitRow[], unit: UnitRow): number {
  const chUnits = getChapterUnits(units, unit.chapter_id ?? '')
  const idx = chUnits.findIndex(u => u.id === unit.id)
  return idx === -1 ? 1 : idx + 1
}

export default function KelasDetailPage() {
  const params  = useParams()
  const kelasId = params.id as string
  const supabase = createClient()

  const [kelas,       setKelas]       = useState<KelasDetail|null>(null)
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [sessions,    setSessions]    = useState<Session[]>([])
  const [payments,    setPayments]    = useState<Payment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState<'siswa'|'jadwal'|'pembayaran'|'level'|'progress'>('siswa')

  // Progress state
  const [classType,        setClassType]        = useState('')
  const [classChapterProgress,   setClassChapterProgress]   = useState<Record<string,ChapterProgress>>({})
  const [studentChapterProgress, setStudentChapterProgress] = useState<Record<string,Record<string,ChapterProgress>>>({})
  const [units,    setUnits]    = useState<UnitRow[]>([])
  const [chapters, setChapters] = useState<ChapterRow[]>([])
  const [lessons,  setLessons]  = useState<LessonRow[]>([])
  const [openChapters,   setOpenChapters]   = useState<Set<string>>(new Set())
  const [openUnits,      setOpenUnits]      = useState<Set<string>>(new Set())
  const [savingProgress, setSavingProgress] = useState(false)
  const [progressLogs,   setProgressLogs]   = useState<ProgressLog[]>([])
  const [confirmDialog,  setConfirmDialog]  = useState<{message:string;onConfirm:()=>void}|null>(null)
  const [showJumpDropdown, setShowJumpDropdown] = useState<string|null>(null)
  const [sessionAbsensiMap, setSessionAbsensiMap] = useState<Record<string,number>>({})

  const [expandedSessionId, setExpandedSessionId] = useState<string|null>(null)
  const [sessionDetails,    setSessionDetails]    = useState<Record<string,SessionDetail>>({})
  const [showPerpanjang,    setShowPerpanjang]    = useState(false)
  const [perpanjangEnr,     setPerpanjangEnr]     = useState<Enrollment|null>(null)
  const [classLevels,       setClassLevels]       = useState<ClassGroupLevel[]>([])
  const [availableLevels,   setAvailableLevels]   = useState<Level[]>([])
  const [selectedLevelId,   setSelectedLevelId]   = useState('')
  const [addingLevel,       setAddingLevel]       = useState(false)
  const [removingLevelId,   setRemovingLevelId]   = useState<string|null>(null)
  const [editSession, setEditSession] = useState<Session|null>(null)
  const [eDate,setEDate]=useState(''); const [eTime,setETime]=useState('')
  const [eZoom,setEZoom]=useState(''); const [eStatus,setEStatus]=useState('')
  const [eSaving,setESaving]=useState(false); const [eErr,setEErr]=useState(''); const [eOk,setEOk]=useState(false)
  const [editAbsensiSessionId, setEditAbsensiSessionId] = useState<string|null>(null)
  const [editAbsensiData,      setEditAbsensiData]      = useState<Record<string,string>>({})
  const [absensiSaving,        setAbsensiSaving]        = useState(false)
  const [absensiErr,           setAbsensiErr]           = useState('')

  // Buat Tagihan state
  const [showBuatTagihan,  setShowBuatTagihan]  = useState(false)
  const [tagihanStudentId, setTagihanStudentId] = useState('')
  const [tagihanAmount,    setTagihanAmount]    = useState('')
  const [tagihanMethod,    setTagihanMethod]    = useState<'transfer'|'tunai'>('transfer')
  const [tagihanPeriod,    setTagihanPeriod]    = useState('')
  const [tagihanStatus,    setTagihanStatus]    = useState<'unpaid'|'pending'|'paid'>('unpaid')
  const [tagihanSaving,    setTagihanSaving]    = useState(false)
  const [tagihanErr,       setTagihanErr]       = useState('')

  useEffect(()=>{fetchAll()},[kelasId,activeTab])
  useEffect(()=>{if(kelasId)fetchLevels()},[kelasId,activeTab])
  useEffect(()=>{if(kelasId)fetchProgress()},[kelasId,activeTab])

  // ── FETCH PROGRESS ──────────────────────────────────────────────
  async function fetchProgress() {
    const {data:cg} = await supabase.from('class_groups')
      .select('class_types(name),class_group_levels(level_id)').eq('id',kelasId).single()
    if(!cg) return
    const typeName = (cg.class_types as any)?.name ?? ''
    setClassType(typeName)

    const levelIds = (cg.class_group_levels as any[])?.map((l:any)=>l.level_id)||[]
    if(levelIds.length===0) return

    const {data:u} = await supabase.from('units')
      .select('id,unit_name,position,chapter_id,level_id').in('level_id',levelIds).order('position')

    const {data:lvls} = await supabase.from('levels').select('id,sort_order').in('id',levelIds)
    const levelOrderMap:Record<string,number>={}
    lvls?.forEach((l:any)=>{levelOrderMap[l.id]=l.sort_order??0})

    const chapterIds=[...new Set((u??[]).map(u=>u.chapter_id).filter(Boolean))] as string[]
    let chapterOrderMap:Record<string,number>={}
    if(chapterIds.length>0){
      const {data:ch} = await supabase.from('chapters')
        .select('id,chapter_title,order_number,level_id').in('id',chapterIds)
      const sortedCh=(ch??[]).sort((a:any,b:any)=>{
        const la=levelOrderMap[a.level_id]??0,lb=levelOrderMap[b.level_id]??0
        return la!==lb?la-lb:(a.order_number??0)-(b.order_number??0)
      })
      setChapters(sortedCh)
      setOpenChapters(new Set(sortedCh.map((c:any)=>c.id)))
      sortedCh.forEach((c:any)=>{chapterOrderMap[c.id]=(levelOrderMap[c.level_id]??0)*1000+(c.order_number??0)})
    }

    const sorted=(u??[]).sort((a,b)=>{
      const la=levelOrderMap[a.level_id]??0,lb=levelOrderMap[b.level_id]??0
      if(la!==lb)return la-lb
      const ca=a.chapter_id?(chapterOrderMap[a.chapter_id]??0):999
      const cb=b.chapter_id?(chapterOrderMap[b.chapter_id]??0):999
      if(ca!==cb)return ca-cb
      return(a.position??0)-(b.position??0)
    })
    setUnits(sorted.map((u,idx)=>({...u,globalPos:idx+1})))

    const unitIds=sorted.map(u=>u.id)
    if(unitIds.length>0){
      const {data:ls}=await supabase.from('lessons')
        .select('id,lesson_name,position,unit_id').in('unit_id',unitIds).order('position')
      setLessons(ls??[])
    }

    const {data:cgChProg}=await supabase.from('class_group_chapter_progress')
      .select('chapter_id,current_unit_position,current_lesson_position').eq('class_group_id',kelasId)
    const cgMap:Record<string,ChapterProgress>={}
    cgChProg?.forEach((cp:any)=>{cgMap[cp.chapter_id]={unit:cp.current_unit_position??1,lesson:cp.current_lesson_position??1}})
    setClassChapterProgress(cgMap)

    const {data:stChProg}=await supabase.from('student_chapter_progress')
      .select('student_id,chapter_id,current_unit_position,current_lesson_position').eq('class_group_id',kelasId)
    const stMap:Record<string,Record<string,ChapterProgress>>={}
    stChProg?.forEach((sp:any)=>{
      if(!stMap[sp.student_id])stMap[sp.student_id]={}
      stMap[sp.student_id][sp.chapter_id]={unit:sp.current_unit_position??1,lesson:sp.current_lesson_position??1}
    })
    setStudentChapterProgress(stMap)

    const {data:logs}=await supabase.from('progress_logs')
      .select('id,student_id,chapter_id,from_unit,from_lesson,to_unit,to_lesson,action,created_at')
      .eq('class_group_id',kelasId).order('created_at',{ascending:false}).limit(20)
    setProgressLogs(logs??[])
  }

  // ── HELPERS ──────────────────────────────────────────────────────
  async function logProgress(studentId:string|null,chapterId:string,fu:number,fl:number,tu:number,tl:number,action:string){
    await supabase.from('progress_logs').insert({class_group_id:kelasId,chapter_id:chapterId,student_id:studentId,from_unit:fu,from_lesson:fl,to_unit:tu,to_lesson:tl,action})
  }
  function confirmAction(message:string,onConfirm:()=>void){setConfirmDialog({message,onConfirm})}

  function getChUnits(chapterId:string):UnitRow[]{
    return units.filter(u=>u.chapter_id===chapterId).sort((a,b)=>a.position-b.position)
  }
  /** Look up unit by 1-based index within chapter */
  function getUnitByChapterIdx(chapterId:string,idx:number):UnitRow|undefined{
    return getChUnits(chapterId)[idx-1]
  }

  function getDisplayProgress(studentId?:string):{unitName:string;lessonName:string|null}|null{
    for(const chapter of chapters){
      const cp=studentId?studentChapterProgress[studentId]?.[chapter.id]:classChapterProgress[chapter.id]
      if(!cp)continue
      const chUnits=getChUnits(chapter.id)
      if(cp.unit>chUnits.length)continue
      const activeUnit=chUnits[cp.unit-1]
      if(!activeUnit)continue
      const lessonName=lessons.find(l=>l.unit_id===activeUnit.id&&l.position===cp.lesson)?.lesson_name??null
      return{unitName:activeUnit.unit_name,lessonName}
    }
    return null
  }

  // ── STUDENT PROGRESS FUNCTIONS (Privat) ────────────────────────
  async function advanceStudentLesson(studentId:string,chapterId:string,totalLessons:number){
    setSavingProgress(true)
    const cp=studentChapterProgress[studentId]?.[chapterId]??{unit:1,lesson:1}
    const maxUnit=getChUnits(chapterId).length
    if(cp.lesson>=totalLessons){
      const newUnit=Math.min(cp.unit+1,maxUnit+1)
      await supabase.from('student_chapter_progress')
        .upsert({student_id:studentId,class_group_id:kelasId,chapter_id:chapterId,current_unit_position:newUnit,current_lesson_position:1,updated_at:new Date().toISOString()},{onConflict:'student_id,class_group_id,chapter_id'})
      await logProgress(studentId,chapterId,cp.unit,cp.lesson,newUnit,1,'naik_unit')
      setStudentChapterProgress(prev=>({...prev,[studentId]:{...(prev[studentId]??{}),[chapterId]:{unit:newUnit,lesson:1}}}))
    }else{
      const newLesson=cp.lesson+1
      await supabase.from('student_chapter_progress')
        .upsert({student_id:studentId,class_group_id:kelasId,chapter_id:chapterId,current_unit_position:cp.unit,current_lesson_position:newLesson,updated_at:new Date().toISOString()},{onConflict:'student_id,class_group_id,chapter_id'})
      await logProgress(studentId,chapterId,cp.unit,cp.lesson,cp.unit,newLesson,'naik_lesson')
      setStudentChapterProgress(prev=>({...prev,[studentId]:{...(prev[studentId]??{}),[chapterId]:{unit:cp.unit,lesson:newLesson}}}))
    }
    setSavingProgress(false)
  }

  async function unlockAllStudentLessons(studentId:string,chapterId:string){
    const cp=studentChapterProgress[studentId]?.[chapterId]??{unit:1,lesson:1}
    const maxUnit=getChUnits(chapterId).length
    const newUnit=Math.min(cp.unit+1,maxUnit+1)
    confirmAction('Selesaikan unit ini dan naik ke unit berikutnya?',async()=>{
      setSavingProgress(true)
      await supabase.from('student_chapter_progress')
        .upsert({student_id:studentId,class_group_id:kelasId,chapter_id:chapterId,current_unit_position:newUnit,current_lesson_position:1,updated_at:new Date().toISOString()},{onConflict:'student_id,class_group_id,chapter_id'})
      await logProgress(studentId,chapterId,cp.unit,cp.lesson,newUnit,1,'selesaikan_unit')
      setStudentChapterProgress(prev=>({...prev,[studentId]:{...(prev[studentId]??{}),[chapterId]:{unit:newUnit,lesson:1}}}))
      setSavingProgress(false)
    })
  }

  async function revertStudentTo(studentId:string,chapterId:string,unitPosInChapter:number,lessonPos:number){
    const cp=studentChapterProgress[studentId]?.[chapterId]??{unit:1,lesson:1}
    const targetUnit=getUnitByChapterIdx(chapterId,unitPosInChapter)
    const unitName=targetUnit?.unit_name??`Unit ${unitPosInChapter}`
    confirmAction(`Kembalikan progress ke "${unitName}" — Lesson ${lessonPos}?`,async()=>{
      setSavingProgress(true)
      await supabase.from('student_chapter_progress')
        .upsert({student_id:studentId,class_group_id:kelasId,chapter_id:chapterId,current_unit_position:unitPosInChapter,current_lesson_position:lessonPos,updated_at:new Date().toISOString()},{onConflict:'student_id,class_group_id,chapter_id'})
      await logProgress(studentId,chapterId,cp.unit,cp.lesson,unitPosInChapter,lessonPos,'revert')
      setStudentChapterProgress(prev=>({...prev,[studentId]:{...(prev[studentId]??{}),[chapterId]:{unit:unitPosInChapter,lesson:lessonPos}}}))
      setSavingProgress(false)
    })
  }

  function jumpStudentTo(studentId:string,chapterId:string,unitPosInChapter:number,lessonPos:number){
    const cp=studentChapterProgress[studentId]?.[chapterId]??{unit:1,lesson:1}
    if(unitPosInChapter===cp.unit&&lessonPos===cp.lesson)return
    const targetUnit=getUnitByChapterIdx(chapterId,unitPosInChapter)
    const unitName=targetUnit?.unit_name??`Unit ${unitPosInChapter}`
    confirmAction(`Pindahkan progress ke "${unitName}" — Lesson ${lessonPos}?`,async()=>{
      setSavingProgress(true)
      await supabase.from('student_chapter_progress')
        .upsert({student_id:studentId,class_group_id:kelasId,chapter_id:chapterId,current_unit_position:unitPosInChapter,current_lesson_position:lessonPos,updated_at:new Date().toISOString()},{onConflict:'student_id,class_group_id,chapter_id'})
      await logProgress(studentId,chapterId,cp.unit,cp.lesson,unitPosInChapter,lessonPos,'jump')
      setStudentChapterProgress(prev=>({...prev,[studentId]:{...(prev[studentId]??{}),[chapterId]:{unit:unitPosInChapter,lesson:lessonPos}}}))
      setSavingProgress(false)
      setShowJumpDropdown(null)
    })
  }

  async function bulkSetProgress(chapterId:string,unitPosInChapter:number,lessonPos:number){
    const activeEnrs=enrollments.filter(e=>e.status==='active')
    if(activeEnrs.length===0)return
    const chapterTitle=chapters.find(c=>c.id===chapterId)?.chapter_title??'chapter ini'
    const targetUnit=getUnitByChapterIdx(chapterId,unitPosInChapter)
    const unitName=targetUnit?.unit_name??`Unit ${unitPosInChapter}`
    confirmAction(`Terapkan progress ${unitName} (L${lessonPos}) di "${chapterTitle}" ke semua ${activeEnrs.length} siswa aktif?`,async()=>{
      setSavingProgress(true)
      for(const enr of activeEnrs){
        const oldCp=studentChapterProgress[enr.student_id]?.[chapterId]??{unit:1,lesson:1}
        await supabase.from('student_chapter_progress')
          .upsert({student_id:enr.student_id,class_group_id:kelasId,chapter_id:chapterId,current_unit_position:unitPosInChapter,current_lesson_position:lessonPos,updated_at:new Date().toISOString()},{onConflict:'student_id,class_group_id,chapter_id'})
        await logProgress(enr.student_id,chapterId,oldCp.unit,oldCp.lesson,unitPosInChapter,lessonPos,'bulk_set')
        setStudentChapterProgress(prev=>({...prev,[enr.student_id]:{...(prev[enr.student_id]??{}),[chapterId]:{unit:unitPosInChapter,lesson:lessonPos}}}))
      }
      setSavingProgress(false)
    })
  }

  async function saveStudentProgress(studentId:string,chapterId:string,unitPosInChapter:number){
    setSavingProgress(true)
    await supabase.from('student_chapter_progress')
      .upsert({student_id:studentId,class_group_id:kelasId,chapter_id:chapterId,current_unit_position:unitPosInChapter,current_lesson_position:1,updated_at:new Date().toISOString()},{onConflict:'student_id,class_group_id,chapter_id'})
    setStudentChapterProgress(prev=>({...prev,[studentId]:{...(prev[studentId]??{}),[chapterId]:{unit:unitPosInChapter,lesson:1}}}))
    setSavingProgress(false)
  }

  // ── CLASS PROGRESS FUNCTIONS (Grup) ────────────────────────────
  async function advanceClassLesson(chapterId:string,totalLessons:number){
    setSavingProgress(true)
    const cp=classChapterProgress[chapterId]??{unit:1,lesson:1}
    const maxUnit=getChUnits(chapterId).length
    if(cp.lesson>=totalLessons){
      const newUnit=Math.min(cp.unit+1,maxUnit+1)
      await supabase.from('class_group_chapter_progress')
        .upsert({class_group_id:kelasId,chapter_id:chapterId,current_unit_position:newUnit,current_lesson_position:1,updated_at:new Date().toISOString()},{onConflict:'class_group_id,chapter_id'})
      await logProgress(null,chapterId,cp.unit,cp.lesson,newUnit,1,'naik_unit_kelas')
      setClassChapterProgress(prev=>({...prev,[chapterId]:{unit:newUnit,lesson:1}}))
    }else{
      const newLesson=cp.lesson+1
      await supabase.from('class_group_chapter_progress')
        .upsert({class_group_id:kelasId,chapter_id:chapterId,current_unit_position:cp.unit,current_lesson_position:newLesson,updated_at:new Date().toISOString()},{onConflict:'class_group_id,chapter_id'})
      await logProgress(null,chapterId,cp.unit,cp.lesson,cp.unit,newLesson,'naik_lesson_kelas')
      setClassChapterProgress(prev=>({...prev,[chapterId]:{unit:cp.unit,lesson:newLesson}}))
    }
    setSavingProgress(false)
  }

  async function unlockAllClassLessons(chapterId:string){
    const cp=classChapterProgress[chapterId]??{unit:1,lesson:1}
    const maxUnit=getChUnits(chapterId).length
    const newUnit=Math.min(cp.unit+1,maxUnit+1)
    confirmAction('Selesaikan unit ini dan naik ke unit berikutnya?',async()=>{
      setSavingProgress(true)
      await supabase.from('class_group_chapter_progress')
        .upsert({class_group_id:kelasId,chapter_id:chapterId,current_unit_position:newUnit,current_lesson_position:1,updated_at:new Date().toISOString()},{onConflict:'class_group_id,chapter_id'})
      await logProgress(null,chapterId,cp.unit,cp.lesson,newUnit,1,'selesaikan_unit_kelas')
      setClassChapterProgress(prev=>({...prev,[chapterId]:{unit:newUnit,lesson:1}}))
      setSavingProgress(false)
    })
  }

  async function revertClassTo(chapterId:string,unitPosInChapter:number,lessonPos:number){
    const cp=classChapterProgress[chapterId]??{unit:1,lesson:1}
    const targetUnit=getUnitByChapterIdx(chapterId,unitPosInChapter)
    const unitName=targetUnit?.unit_name??`Unit ${unitPosInChapter}`
    confirmAction(`Kembalikan progress kelas ke "${unitName}" — Lesson ${lessonPos}?`,async()=>{
      setSavingProgress(true)
      await supabase.from('class_group_chapter_progress')
        .upsert({class_group_id:kelasId,chapter_id:chapterId,current_unit_position:unitPosInChapter,current_lesson_position:lessonPos,updated_at:new Date().toISOString()},{onConflict:'class_group_id,chapter_id'})
      await logProgress(null,chapterId,cp.unit,cp.lesson,unitPosInChapter,lessonPos,'revert_kelas')
      setClassChapterProgress(prev=>({...prev,[chapterId]:{unit:unitPosInChapter,lesson:lessonPos}}))
      setSavingProgress(false)
    })
  }

  function jumpClassTo(chapterId:string,unitPosInChapter:number,lessonPos:number){
    const cp=classChapterProgress[chapterId]??{unit:1,lesson:1}
    if(unitPosInChapter===cp.unit&&lessonPos===cp.lesson)return
    const targetUnit=getUnitByChapterIdx(chapterId,unitPosInChapter)
    const unitName=targetUnit?.unit_name??`Unit ${unitPosInChapter}`
    confirmAction(`Pindahkan progress kelas ke "${unitName}" — Lesson ${lessonPos}?`,async()=>{
      setSavingProgress(true)
      await supabase.from('class_group_chapter_progress')
        .upsert({class_group_id:kelasId,chapter_id:chapterId,current_unit_position:unitPosInChapter,current_lesson_position:lessonPos,updated_at:new Date().toISOString()},{onConflict:'class_group_id,chapter_id'})
      await logProgress(null,chapterId,cp.unit,cp.lesson,unitPosInChapter,lessonPos,'jump_kelas')
      setClassChapterProgress(prev=>({...prev,[chapterId]:{unit:unitPosInChapter,lesson:lessonPos}}))
      setSavingProgress(false)
      setShowJumpDropdown(null)
    })
  }

  // ── FETCH ALL ────────────────────────────────────────────────────
  async function fetchAll(){
    setLoading(true)
    const {data:k}=await supabase.from('class_groups')
      .select('id,label,status,max_participants,zoom_link,class_type_id,courses(name),class_types(name),tutors(id,profiles(full_name))')
      .eq('id',kelasId).single()
    setKelas(k as any)

    const {data:enr}=await supabase.from('enrollments')
      .select('id,student_id,sessions_total,session_start_offset,sessions_used,status,enrolled_at').eq('class_group_id',kelasId)

    if(enr&&enr.length>0){
      const sIds=enr.map((e:any)=>e.student_id)
      const {data:studs}=await supabase.from('students').select('id,profile_id').in('id',sIds)
      const profIds=(studs??[]).map((s:any)=>s.profile_id).filter(Boolean)
      let nameMap:Record<string,string>={}
      if(profIds.length>0){
        const {data:profs}=await supabase.from('profiles').select('id,full_name').in('id',profIds)
        const profMap=Object.fromEntries((profs??[]).map((p:any)=>[p.id,p.full_name]))
        nameMap=Object.fromEntries((studs??[]).map((s:any)=>[s.id,profMap[s.profile_id]??'Siswa']))
      }
      const allCompleted=await supabase.from('sessions').select('id,scheduled_at').eq('class_group_id',kelasId).eq('status','completed')
      const attendedMap:Record<string,number>={}
      for(const e of enr){
        const enrolledAt=e.enrolled_at?new Date(e.enrolled_at):new Date(0)
        const relIds=(allCompleted.data??[]).filter((s:any)=>new Date(s.scheduled_at)>=enrolledAt).map((s:any)=>s.id)
        if(relIds.length>0){
          const {data:att}=await supabase.from('attendances').select('student_id').in('session_id',relIds).eq('student_id',e.student_id)
          attendedMap[e.id]=(att??[]).length
        }else{attendedMap[e.id]=0}
      }
      setEnrollments(enr.map((e:any)=>({...e,student_name:nameMap[e.student_id]??'Siswa',attended_count:attendedMap[e.id]??0})))
    }else{setEnrollments([])}

    const activeEnrollment=(enr??[]).find((e:any)=>e.status==='active')
    const {data:sess}=await supabase.from('sessions').select('id,scheduled_at,status,zoom_link,enrollment_id').eq('class_group_id',kelasId).order('scheduled_at',{ascending:true})
    setSessions((sess??[]) as Session[])

    const completedIds=(sess??[]).filter((s:any)=>s.status==='completed').map((s:any)=>s.id)
    if(completedIds.length>0){
      const {data:absCoverage}=await supabase.from('attendances').select('session_id').in('session_id',completedIds)
      const coverageMap:Record<string,number>={}
      absCoverage?.forEach((a:any)=>{coverageMap[a.session_id]=(coverageMap[a.session_id]||0)+1})
      setSessionAbsensiMap(coverageMap)
    }else{setSessionAbsensiMap({})}

    const enrollIds=(enr??[]).map((e:any)=>e.id)
    let payList:any[]=[]
    if(enrollIds.length>0){
      const {data:pays2}=await supabase.from('payments').select('id,amount,status,period_label,method,created_at,student_id').in('enrollment_id',enrollIds).order('created_at',{ascending:false})
      payList=pays2??[]
    }
    const sIds2=[...new Set(payList.map((p:any)=>p.student_id))]
    let payNameMap:Record<string,string>={}
    if(sIds2.length>0){
      const {data:studs2}=await supabase.from('students').select('id,profile_id').in('id',sIds2)
      const profIds2=(studs2??[]).map((s:any)=>s.profile_id).filter(Boolean)
      if(profIds2.length>0){
        const {data:profs2}=await supabase.from('profiles').select('id,full_name').in('id',profIds2)
        const profMap2=Object.fromEntries((profs2??[]).map((p:any)=>[p.id,p.full_name]))
        payNameMap=Object.fromEntries((studs2??[]).map((s:any)=>[s.id,profMap2[s.profile_id]??'Siswa']))
      }
    }
    setPayments(payList.map((p:any)=>({...p,student_name:payNameMap[p.student_id]??'—'})))
    setLoading(false)
  }

  async function fetchLevels(){
    const {data:cgl}=await supabase.from('class_group_levels').select('id,level_id,levels(id,name,description,target_age,sort_order)').eq('class_group_id',kelasId).order('levels(sort_order)')
    setClassLevels((cgl??[]).map((c:any)=>({id:c.id,level_id:c.level_id,level:c.levels})))
    const {data:k}=await supabase.from('class_groups').select('course_id').eq('id',kelasId).single()
    if(k?.course_id){
      const assignedIds=(cgl??[]).map((c:any)=>c.level_id)
      const {data:allLevels}=await supabase.from('levels').select('id,name,description,target_age,sort_order').eq('course_id',k.course_id).eq('is_active',true).order('sort_order')
      setAvailableLevels((allLevels??[]).filter((l:any)=>!assignedIds.includes(l.id)))
    }
  }

  async function handleAddLevel(){
    if(!selectedLevelId)return;setAddingLevel(true)
    const res=await fetch('/api/admin/class-group-levels',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({class_group_id:kelasId,level_id:selectedLevelId})})
    if(res.ok){setSelectedLevelId('');await fetchLevels()}
    setAddingLevel(false)
  }
  async function handleRemoveLevel(cglId:string){
    setRemovingLevelId(cglId)
    await fetch(`/api/admin/class-group-levels/${cglId}`,{method:'DELETE'})
    await fetchLevels();setRemovingLevelId(null)
  }

  function openEditSession(s:Session){
    const dt=new Date(s.scheduled_at)
    const witStr=dt.toLocaleString('en-CA',{timeZone:'Asia/Jayapura',hour12:false})
    const [datePart,timePart]=witStr.split(', ')
    setEDate(datePart);setETime(timePart.slice(0,5));setEZoom(s.zoom_link??'');setEStatus(s.status)
    setEErr('');setEOk(false);setEditSession(s)
  }
  async function handleSaveSession(){
    if(!editSession)return;setESaving(true);setEErr('');setEOk(false)
    const newScheduledAt=new Date(`${eDate}T${eTime}:00+09:00`).toISOString()
    const {error}=await supabase.from('sessions').update({scheduled_at:newScheduledAt,zoom_link:eZoom||null,status:eStatus}).eq('id',editSession.id)
    setESaving(false)
    if(error){setEErr(error.message);return}
    setSessions(prev=>prev.map(s=>s.id===editSession.id?{...s,scheduled_at:newScheduledAt,zoom_link:eZoom||null,status:eStatus}:s))
    setEOk(true);setTimeout(()=>setEditSession(null),700)
  }
  async function markSessionComplete(id:string){
    await supabase.from('sessions').update({status:'completed'}).eq('id',id)
    const {data:rem}=await supabase.from('sessions').select('id').eq('class_group_id',kelasId).in('status',['scheduled','rescheduled']).neq('id',id)
    if(!rem||rem.length===0)await supabase.from('class_groups').update({status:'inactive'}).eq('id',kelasId)
    fetchAll()
  }
  async function toggleSessionDetail(sessionId:string){
    if(expandedSessionId===sessionId){setExpandedSessionId(null);return}
    setExpandedSessionId(sessionId)
    if(sessionDetails[sessionId])return
    setSessionDetails(prev=>({...prev,[sessionId]:{attendances:[],reports:[],loading:true}}))
    const {data:attData}=await supabase.from('attendances').select('student_id,status,notes').eq('session_id',sessionId)
    const {data:repData}=await supabase.from('session_reports').select('student_id,materi,perkembangan,saran_siswa,saran_ortu,recording_url').eq('session_id',sessionId)
    const studentIdSet=new Set([...(attData??[]).map((a:any)=>a.student_id),...(repData??[]).map((r:any)=>r.student_id)])
    const nameMap:Record<string,string>={};enrollments.forEach(e=>{if(studentIdSet.has(e.student_id))nameMap[e.student_id]=e.student_name})
    const attendances:SessionAttendance[]=(attData??[]).map((a:any)=>({student_id:a.student_id,student_name:nameMap[a.student_id]??'Siswa',status:a.status,notes:a.notes}))
    const reports:SessionReport[]=(repData??[]).map((r:any)=>({student_id:r.student_id,student_name:nameMap[r.student_id]??'Siswa',materi:r.materi,perkembangan:r.perkembangan,saran_siswa:r.saran_siswa,saran_ortu:r.saran_ortu,recording_url:r.recording_url}))
    setSessionDetails(prev=>({...prev,[sessionId]:{attendances,reports,loading:false}}))
  }
  function openEditAbsensi(sessionId:string){
    const detail=sessionDetails[sessionId];if(!detail)return
    const initial:Record<string,string>={};detail.attendances.forEach(a=>{initial[a.student_id]=a.status})
    enrollments.forEach(e=>{if(!initial[e.student_id])initial[e.student_id]='tidak_hadir'})
    setEditAbsensiData(initial);setEditAbsensiSessionId(sessionId);setAbsensiErr('')
  }
  async function saveAbsensi(){
    if(!editAbsensiSessionId)return;setAbsensiSaving(true);setAbsensiErr('')
    try{
      for(const [studentId,status] of Object.entries(editAbsensiData)){
        const {error}=await supabase.from('attendances').upsert({session_id:editAbsensiSessionId,student_id:studentId,status},{onConflict:'session_id,student_id'})
        if(error)throw error
      }
      setSessionDetails(prev=>{
        const old=prev[editAbsensiSessionId!];if(!old)return prev
        const updated=old.attendances.map(a=>({...a,status:editAbsensiData[a.student_id]??a.status}))
        const existingIds=new Set(old.attendances.map(a=>a.student_id))
        enrollments.forEach(e=>{if(!existingIds.has(e.student_id)&&editAbsensiData[e.student_id])updated.push({student_id:e.student_id,student_name:e.student_name,status:editAbsensiData[e.student_id],notes:null})})
        return{...prev,[editAbsensiSessionId!]:{...old,attendances:updated}}
      })
      setSessionAbsensiMap(prev=>({...prev,[editAbsensiSessionId!]:Object.keys(editAbsensiData).length}))
      setEditAbsensiSessionId(null)
    }catch(err:any){setAbsensiErr(err.message??'Gagal menyimpan absensi')}finally{setAbsensiSaving(false)}
  }
  async function konfirmasiPembayaran(paymentId:string){
    if(!confirm('Konfirmasi pembayaran ini sudah LUNAS?'))return
    const {error} = await supabase.from('payments')
      .update({status:'paid',paid_at:new Date().toISOString()}).eq('id',paymentId)
    if(error){alert('Gagal konfirmasi: '+error.message);return}

    // Kirim WA ke ortu — fire and forget
    const p = payments.find(p=>p.id===paymentId)
    const enr = enrollments.find(e=>e.student_name===p?.student_name&&e.status==='active')
    if(p&&enr){
      fetch('/api/wa/notify-payment',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          student_id:    enr.student_id,
          class_group_id: kelasId,
          amount:        p.amount,
          period_label:  p.period_label,
        }),
      }).catch(()=>{})
    }

    fetchAll()
  }
  function openPerpanjang(enr:Enrollment){setPerpanjangEnr(enr);setShowPerpanjang(true)}

  function openBuatTagihan(){
    // Default ke siswa aktif pertama
    const firstActive = enrollments.find(e => e.status === 'active')
    setTagihanStudentId(firstActive?.student_id ?? '')
    setTagihanAmount('')
    setTagihanMethod('transfer')
    setTagihanPeriod('')
    setTagihanStatus('unpaid')
    setTagihanErr('')
    setShowBuatTagihan(true)
  }

  async function simpanTagihan(){
    if(!tagihanStudentId){setTagihanErr('Pilih siswa terlebih dahulu.');return}
    const nominal = parseInt(tagihanAmount.replace(/\D/g,''),10)
    if(!nominal||nominal<=0){setTagihanErr('Masukkan jumlah tagihan yang valid.');return}
    setTagihanSaving(true);setTagihanErr('')

    // Cari enrollment_id untuk siswa ini di kelas ini
    const enr = enrollments.find(e=>e.student_id===tagihanStudentId&&e.status==='active')
    if(!enr){setTagihanErr('Enrollment aktif siswa tidak ditemukan.');setTagihanSaving(false);return}

    const {error} = await supabase.from('payments').insert({
      student_id:    tagihanStudentId,
      enrollment_id: enr.id,
      amount:        nominal,
      method:        tagihanMethod,
      status:        tagihanStatus,
      period_label:  tagihanPeriod.trim()||null,
      is_new_student: false,
    })
    setTagihanSaving(false)
    if(error){setTagihanErr('Gagal menyimpan: '+error.message);return}

    // Kirim WA ke ortu jika langsung lunas — fire and forget
    if(tagihanStatus==='paid'){
      fetch('/api/wa/notify-payment',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          student_id:    tagihanStudentId,
          class_group_id: kelasId,
          amount:        nominal,
          period_label:  tagihanPeriod.trim()||null,
        }),
      }).catch(()=>{})
    }

    setShowBuatTagihan(false)
    fetchAll()
  }

  async function deleteSession(id:string){await supabase.from('sessions').delete().eq('id',id);fetchAll()}

  const statusLabel:Record<string,string>={active:'Aktif',inactive:'Nonaktif',completed:'Selesai'}
  const statusColor:Record<string,string>={active:'bg-green-100 text-green-700',inactive:'bg-gray-100 text-gray-500',completed:'bg-blue-100 text-blue-700'}
  const selesai=sessions.filter(s=>s.status==='completed').length
  const terjadwal=sessions.filter(s=>s.status==='scheduled').length
  const totalLunas=payments.filter(p=>p.status==='paid').reduce((a,p)=>a+p.amount,0)
  const missingAbsensiCount=sessions.filter(s=>s.status==='completed'&&!sessionAbsensiMap[s.id]).length

  if(loading)return<div className="p-6 text-sm text-[#7B78A8]">Memuat detail kelas...</div>
  if(!kelas)return<div className="p-6 text-sm text-red-500">Kelas tidak ditemukan.</div>

  // ── RENDER ────────────────────────────────────────────────────────
  return(
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/kelas" className="text-[#7B78A8] hover:text-[#5C4FE5] transition-colors"><ChevronLeft size={20}/></Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#1A1640] truncate" style={{fontFamily:'Sora,sans-serif'}}>{kelas.label}</h1>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${statusColor[kelas.status]??'bg-gray-100 text-gray-500'}`}>{statusLabel[kelas.status]??kelas.status}</span>
          </div>
          <p className="text-sm text-[#7B78A8] mt-0.5">{kelas.courses?.name} · {kelas.class_types?.name} · {(kelas.tutors as any)?.profiles?.full_name??'—'}</p>
        </div>
        <Link href={`/admin/kelas/${kelasId}/edit`} className="flex items-center gap-1.5 px-3 py-2 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition"><Pencil size={12}/> Edit</Link>
      </div>

      {/* Info bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 text-center">
          <div className="text-2xl font-black text-[#5C4FE5]">{enrollments.filter(e=>e.status==='active').length}/{kelas.max_participants}</div>
          <div className="text-xs text-[#7B78A8] mt-0.5 font-semibold">Peserta Aktif</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 text-center">
          <div className="text-2xl font-black text-[#27A05A]">{selesai}</div>
          <div className="text-xs text-[#7B78A8] mt-0.5 font-semibold">Sesi Selesai</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E3FF] p-4 text-center">
          <div className="text-2xl font-black text-[#1A1640]">{fmtRp(totalLunas)}</div>
          <div className="text-xs text-[#7B78A8] mt-0.5 font-semibold">Total Lunas</div>
        </div>
      </div>

      {/* Absensi Alert */}
      {missingAbsensiCount>0&&(
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0"/>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">{missingAbsensiCount} sesi selesai belum ada absensi</p>
            <p className="text-xs text-amber-600 mt-0.5">Buka tab Jadwal → klik sesi → isi absensi</p>
          </div>
          <button onClick={()=>setActiveTab('jadwal')} className="text-xs font-bold px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex-shrink-0">Lihat →</button>
        </div>
      )}

      {/* Zoom link */}
      {kelas.zoom_link&&(
        <div className="bg-[#EEEDFE] rounded-xl px-4 py-3 mb-5 flex items-center justify-between">
          <div><p className="text-xs font-bold text-[#3C3489]">Link Zoom</p><p className="text-xs text-[#5C4FE5] truncate max-w-[280px]">{kelas.zoom_link}</p></div>
          <a href={kelas.zoom_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition"><ExternalLink size={12}/> Buka</a>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F7F6FF] p-1 rounded-xl mb-5 border border-[#E5E3FF]">
        {([{key:'siswa',label:'Siswa'},{key:'jadwal',label:missingAbsensiCount>0?'Jadwal ⚠️':'Jadwal'},{key:'pembayaran',label:'Pembayaran'},{key:'level',label:'Level'},{key:'progress',label:'Progress'}] as const).map(tab=>(
          <button key={tab.key} onClick={()=>setActiveTab(tab.key as any)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab===tab.key?'bg-white text-[#5C4FE5] shadow-sm':'text-[#7B78A8] hover:text-[#5C4FE5]'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: SISWA ══ */}
      {activeTab==='siswa'&&(
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          {enrollments.length===0?(
            <div className="px-5 py-12 text-center"><div className="w-12 h-12 rounded-2xl bg-[#F0EFFF] flex items-center justify-center mx-auto mb-3"><Users size={20} className="text-[#C4BFFF]"/></div><p className="text-sm text-[#7B78A8] font-semibold">Belum ada siswa terdaftar</p></div>
          ):(() => {
            const grouped=new Map<string,Enrollment[]>()
            enrollments.forEach(e=>{if(!grouped.has(e.student_id))grouped.set(e.student_id,[]);grouped.get(e.student_id)!.push(e)})
            return Array.from(grouped.entries()).map(([studentId,enrs],idx)=>{
              const avatarColor=AVATAR_COLORS[idx%AVATAR_COLORS.length]
              const firstName=enrs[0].student_name,hasMultiple=enrs.length>1
              return(
                <div key={studentId} className={idx<grouped.size-1?'border-b border-[#E5E3FF]':''}>
                  {hasMultiple?(
                    <div>
                      <div className="flex items-center gap-3 px-5 py-3 bg-[#F7F6FF]">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{backgroundColor:avatarColor}}>{getInitials(firstName)}</div>
                        <span className="text-sm font-bold text-[#1A1640]">{firstName}</span>
                        <span className="text-[10px] text-[#7B78A8] font-medium">{enrs.length} periode</span>
                      </div>
                      {enrs.map((enr,pidx)=>{
                        const attended=enr.attended_count??0,display=Math.min(enr.session_start_offset+attended,enr.sessions_total)
                        const completed=Math.min(Math.max(0,enr.session_start_offset+attended-1),enr.sessions_total)
                        const pct=completed===0?0:Math.min((completed/enr.sessions_total)*100,100)
                        const isActive=enr.status==='active',isRenewed=enr.status==='renewed'
                        return(
                          <div key={enr.id} className={`flex items-center gap-3 pl-14 pr-5 py-3 ${isRenewed?'bg-[#FAFAFE] opacity-70':''} ${pidx<enrs.length-1?'border-b border-[#F0EFFE]':''}`}>
                            <span className="text-[10px] text-[#7B78A8] font-semibold flex-shrink-0 w-16">{pidx===enrs.length-1?'└──':'├──'} P{pidx+1}</span>
                            <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><div className="w-20 h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden flex-shrink-0"><div className={`h-full ${isRenewed?'bg-[#C4BFFF]':'bg-[#5C4FE5]'} rounded-full transition-all`} style={{width:`${pct}%`}}/></div><span className={`text-[10px] font-bold ${isRenewed?'text-[#C4BFFF]':'text-[#5C4FE5]'}`}>{display}/{enr.sessions_total} sesi</span></div></div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${isActive?'bg-[#E6F4EC] text-[#1A5C36]':isRenewed?'bg-[#EEEDFE] text-[#5C4FE5]':'bg-gray-100 text-gray-500'}`}>{isActive?'Aktif':isRenewed?'Diperpanjang':enr.status}</span>
                            {(isActive||enr.status==='completed')&&<button onClick={()=>openPerpanjang(enr)} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[#F0EFFF] text-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white transition-colors flex-shrink-0">🔄 Perpanjang</button>}
                          </div>
                        )
                      })}
                    </div>
                  ):(()=>{
                    const enr=enrs[0],attended=enr.attended_count??0
                    const display=Math.min(enr.session_start_offset+attended,enr.sessions_total)
                    const completed=Math.min(Math.max(0,enr.session_start_offset+attended-1),enr.sessions_total)
                    const pct=completed===0?0:Math.min((completed/enr.sessions_total)*100,100)
                    const isActive=enr.status==='active'
                    const st=isActive?{label:'Aktif',cls:'bg-[#E6F4EC] text-[#1A5C36]'}:enr.status==='inactive'?{label:'Berhenti',cls:'bg-[#FEE9E9] text-[#991B1B]'}:enr.status==='completed'?{label:'Selesai',cls:'bg-blue-100 text-blue-700'}:{label:enr.status,cls:'bg-gray-100 text-gray-600'}
                    return(
                      <div className="flex items-center gap-3 px-5 py-4">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{backgroundColor:avatarColor}}>{getInitials(enr.student_name)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-[#1A1640]">{enr.student_name}</div>
                          <div className="flex items-center gap-2 mt-1"><div className="w-24 h-1.5 bg-[#E5E3FF] rounded-full overflow-hidden"><div className="h-full bg-[#5C4FE5] rounded-full transition-all" style={{width:`${pct}%`}}/></div><span className="text-[10px] font-bold text-[#5C4FE5]">{display}/{enr.sessions_total} sesi</span></div>
                          {units.length>0&&(()=>{const dp=classType==='Privat'?getDisplayProgress(enr.student_id):getDisplayProgress();return dp?<div className="text-[10px] text-[#7B78A8] mt-0.5">📖 {dp.unitName}{dp.lessonName?` — ${dp.lessonName}`:''}</div>:null})()}
                        </div>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                        {(isActive||enr.status==='completed')&&<button onClick={()=>openPerpanjang(enr)} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[#F0EFFF] text-[#5C4FE5] hover:bg-[#5C4FE5] hover:text-white transition-colors flex-shrink-0">🔄 Perpanjang</button>}
                      </div>
                    )
                  })()}
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* ══ TAB: JADWAL ══ */}
      {activeTab==='jadwal'&&(
        <PeriodeJadwalTab
          sessions={sessions}
          enrollments={enrollments}
          sessionAbsensiMap={sessionAbsensiMap}
          expandedSessionId={expandedSessionId}
          sessionDetails={sessionDetails}
          missingAbsensiCount={missingAbsensiCount}
          onToggleSession={toggleSessionDetail}
          onEditAbsensi={openEditAbsensi}
          onMarkComplete={markSessionComplete}
          onEditSession={openEditSession}
          onDeleteSession={deleteSession}
        />
      )}

      {/* ══ TAB: PEMBAYARAN ══ */}
      {activeTab==='pembayaran'&&(
        <div className="space-y-3">
          {/* Header + tombol Buat Tagihan */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#7B78A8] font-semibold">
              {payments.length > 0 ? `${payments.length} tagihan` : 'Belum ada tagihan'}
            </p>
            <button onClick={openBuatTagihan}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#5C4FE5] text-white text-xs font-bold rounded-lg hover:bg-[#3D34C4] transition">
              <Plus size={13}/> Buat Tagihan
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          {payments.length===0?(<div className="px-5 py-12 text-center"><div className="w-12 h-12 rounded-2xl bg-[#F0EFFF] flex items-center justify-center mx-auto mb-3"><CreditCard size={20} className="text-[#C4BFFF]"/></div><p className="text-sm text-[#7B78A8] font-semibold">Belum ada tagihan</p><p className="text-xs text-[#7B78A8] mt-1">Klik tombol <strong>Buat Tagihan</strong> di atas untuk membuat tagihan baru</p></div>):(
          payments.map((p,idx)=>{
            const st=STATUS_BAYAR[p.status]??{label:p.status,cls:'bg-gray-100 text-gray-600'}
            return(<div key={p.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-[#F7F6FF] transition-colors ${idx<payments.length-1?'border-b border-[#E5E3FF]':''}`}>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-[#1A1640]">{p.student_name}</div><div className="text-xs text-[#7B78A8] mt-0.5">{p.period_label??'—'} · {p.method==='transfer'?'Transfer Bank':'Tunai'}</div></div>
              <div className="text-right"><div className="text-sm font-bold text-[#1A1640]">{fmtRp(p.amount)}</div><div className="text-xs text-[#7B78A8]">{new Date(p.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</div></div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
              {p.status==='pending'&&<button onClick={()=>konfirmasiPembayaran(p.id)} className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors flex-shrink-0 border border-emerald-200">✓ Konfirmasi Lunas</button>}
            </div>)
          }))}
          </div>
        </div>
      )}

      {/* ══ TAB: PROGRESS ══ */}
      {activeTab==='progress'&&(
        <div className="space-y-4">
          <div className="bg-[#F0EFFF] rounded-xl p-4 border border-[#E5E3FF]">
            <p className="text-sm text-[#4A4580]">{classType==='Privat'?'🎯 Kelas Privat — progress diset per siswa, per chapter':'👥 Kelas Grup — progress berlaku semua siswa, per chapter'}</p>
            <p className="text-xs text-[#7B78A8] mt-1">Progress disimpan independen per chapter — setting satu chapter tidak mempengaruhi chapter lain.</p>
          </div>

          {chapters.length===0?(
            <div className="bg-white rounded-xl border border-[#E5E3FF] p-8 text-center text-gray-400">Belum ada chapter/unit. Tambahkan level ke kelas ini terlebih dahulu.</div>
          ):classType==='Privat'?(
            /* ── PRIVAT ── */
            <div className="space-y-3">
              {enrollments.filter(e=>e.status==='active').map(enr=>{
                const currentStudentChProg=studentChapterProgress[enr.student_id]??{}
                return(
                  <div key={enr.student_id} className="bg-white rounded-xl border border-[#E5E3FF] p-4">
                    {/* Header + Pindah ke */}
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-bold text-[#1A1640]">{enr.student_name}</p>
                      <div className="relative">
                        <button onClick={()=>setShowJumpDropdown(showJumpDropdown===enr.student_id?null:enr.student_id)}
                          className="text-[10px] px-2.5 py-1 bg-[#F0EFFF] text-[#5C4FE5] rounded-lg hover:bg-[#5C4FE5] hover:text-white transition-colors font-bold">
                          🎯 Pindah ke...
                        </button>
                        {showJumpDropdown===enr.student_id&&(
                          <div className="absolute right-0 top-8 z-30 w-72 bg-white rounded-xl border border-[#E5E3FF] shadow-lg max-h-72 overflow-y-auto">
                            {chapters.map(chapter=>{
                              const chUnits=getChUnits(chapter.id)
                              if(chUnits.length===0)return null
                              const cp=currentStudentChProg[chapter.id]??{unit:1,lesson:1}
                              return(
                                <div key={chapter.id}>
                                  <div className="px-3 py-1.5 bg-[#EEEDFE] text-xs font-bold text-[#4A4580] sticky top-0">{chapter.chapter_title}</div>
                                  {chUnits.map((u,uIdx)=>{
                                    const uPos=uIdx+1  // ← 1-based per-chapter index
                                    const isCurrUnit=uPos===cp.unit
                                    const unitLessons=lessons.filter(l=>l.unit_id===u.id).sort((a,b)=>a.position-b.position)
                                    return(
                                      <div key={u.id}>
                                        <div className="px-3 py-1 bg-[#F7F6FF] text-[11px] font-semibold text-[#1A1640]">{u.unit_name}</div>
                                        {unitLessons.length>0?unitLessons.map(l=>(
                                          <button key={l.id}
                                            onClick={()=>jumpStudentTo(enr.student_id,chapter.id,uPos,l.position)}
                                            className={`w-full text-left px-5 py-1.5 text-xs hover:bg-[#F0EFFF] transition-colors ${isCurrUnit&&l.position===cp.lesson?'text-[#5C4FE5] font-bold bg-[#F0EFFF]':'text-[#1A1640]'}`}>
                                            {l.lesson_name} {isCurrUnit&&l.position===cp.lesson?'← saat ini':''}
                                          </button>
                                        )):(
                                          <button onClick={()=>jumpStudentTo(enr.student_id,chapter.id,uPos,1)}
                                            className={`w-full text-left px-5 py-1.5 text-xs hover:bg-[#F0EFFF] transition-colors ${isCurrUnit?'text-[#5C4FE5] font-bold bg-[#F0EFFF]':'text-gray-400'}`}>
                                            (tanpa lesson) {isCurrUnit?'← saat ini':''}
                                          </button>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Per-chapter units */}
                    <div className="space-y-1.5">
                      {chapters.map(chapter=>{
                        const cp=currentStudentChProg[chapter.id]??{unit:1,lesson:1}
                        const chUnits=getChUnits(chapter.id)
                        if(chUnits.length===0)return null
                        const isChOpen=openChapters.has(chapter.id)
                        // doneCh = number of completed units = cp.unit - 1 (capped at total)
                        const doneCh=Math.max(0,Math.min(cp.unit-1,chUnits.length))
                        return(
                          <div key={chapter.id} className="rounded-xl border border-[#E5E3FF] overflow-hidden">
                            <button onClick={()=>setOpenChapters(prev=>{const next=new Set(prev);next.has(chapter.id)?next.delete(chapter.id):next.add(chapter.id);return next})}
                              className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F7F6FF] hover:bg-[#EEEDFE] transition-colors text-left">
                              <div className="flex items-center gap-2">
                                {isChOpen?<ChevronDown size={14} className="text-[#5C4FE5]"/>:<ChevronRight size={14} className="text-gray-400"/>}
                                <span className="text-sm font-bold text-[#1A1640]">{chapter.chapter_title}</span>
                              </div>
                              <span className="text-xs text-[#7B78A8]">{doneCh}/{chUnits.length} unit selesai</span>
                            </button>
                            {isChOpen&&(
                              <div className="p-2 space-y-1.5">
                                {chUnits.map((unit,unitIdx)=>{
                                  const unitPosInCh=unitIdx+1  // ← KEY FIX: 1-based per-chapter index
                                  const isDone  =unitPosInCh<cp.unit
                                  const isActive=unitPosInCh===cp.unit
                                  const isLocked=unitPosInCh>cp.unit
                                  const unitLessons=lessons.filter(l=>l.unit_id===unit.id).sort((a,b)=>a.position-b.position)
                                  const hasLessons=unitLessons.length>0
                                  const unitKey=`${enr.student_id}_${unit.id}`,isUnitOpen=openUnits.has(unitKey)
                                  return(
                                    <div key={unit.id} className="rounded-lg overflow-hidden">
                                      <div onClick={()=>{if(hasLessons&&(isDone||isActive)){setOpenUnits(prev=>{const next=new Set(prev);next.has(unitKey)?next.delete(unitKey):next.add(unitKey);return next})}}}
                                        className={`flex items-center justify-between px-3 py-2.5 border ${isDone?'bg-green-50 border-green-200':isActive?'bg-purple-50 border-[#5C4FE5]':'bg-gray-50 border-gray-200'} ${hasLessons&&!isLocked?'cursor-pointer':''}`}>
                                        <div className="flex items-center gap-2">
                                          {hasLessons&&!isLocked&&(isUnitOpen?<ChevronDown size={12} className="text-[#5C4FE5]"/>:<ChevronRight size={12} className="text-gray-400"/>)}
                                          <span>{isDone?'✅':isActive?'📖':'🔒'}</span>
                                          <span className={`text-sm font-medium ${isLocked?'text-gray-400':'text-[#1A1640]'}`}>{unit.unit_name}</span>
                                          {hasLessons&&<span className="text-[10px] text-[#7B78A8]">({unitLessons.length} lesson)</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {isDone&&<button onClick={e=>{e.stopPropagation();revertStudentTo(enr.student_id,chapter.id,unitPosInCh,1)}} disabled={savingProgress} className="text-[10px] px-2 py-0.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors font-semibold">↩ Kembali</button>}
                                          {isActive&&!hasLessons&&<button onClick={e=>{e.stopPropagation();saveStudentProgress(enr.student_id,chapter.id,Math.min(cp.unit+1,chUnits.length+1))}} disabled={savingProgress||cp.unit>chUnits.length} className="text-xs px-3 py-1 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-40 font-semibold">Naik Unit →</button>}
                                          {isActive&&hasLessons&&<button onClick={e=>{e.stopPropagation();unlockAllStudentLessons(enr.student_id,chapter.id)}} disabled={savingProgress} className="text-[10px] px-2.5 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-bold shadow-sm">Selesaikan Unit ✓</button>}
                                        </div>
                                      </div>
                                      {isUnitOpen&&hasLessons&&(
                                        <div className="pl-8 pr-3 py-2 space-y-1 border-x border-b border-[#E5E3FF] bg-white">
                                          {unitLessons.map(lesson=>{
                                            const lessonDone  =isDone||(isActive&&lesson.position<cp.lesson)
                                            const lessonActive=isActive&&lesson.position===cp.lesson
                                            const canRevert   =(isActive||isDone)&&lessonDone
                                            return(
                                              <div key={lesson.id}
                                                onClick={()=>canRevert&&revertStudentTo(enr.student_id,chapter.id,unitPosInCh,lesson.position)}
                                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${lessonDone?'bg-green-50 text-[#1A1640]':lessonActive?'bg-[#F0EFFF] text-[#1A1640] border border-[#5C4FE5]':'bg-gray-50 text-gray-400'} ${canRevert?'cursor-pointer hover:bg-green-100 transition-colors':''}`}>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-xs">{lessonDone?'✅':lessonActive?'▶️':'🔒'}</span>
                                                  <span className={`font-medium ${lessonActive?'text-[#5C4FE5]':''}`}>{lesson.lesson_name}</span>
                                                </div>
                                                {lessonActive&&<button onClick={e=>{e.stopPropagation();advanceStudentLesson(enr.student_id,chapter.id,unitLessons.length)}} disabled={savingProgress} className="text-xs px-3 py-1 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-40 font-semibold">{cp.lesson>=unitLessons.length?'Naik Unit →':'Naik Lesson →'}</button>}
                                                {canRevert&&<span className="text-[10px] text-green-600 opacity-50">↩ klik untuk kembali</span>}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Bulk set per chapter */}
                    {enrollments.filter(e=>e.status==='active').length>1&&chapters.length>0&&(
                      <div className="mt-3 pt-3 border-t border-[#E5E3FF]">
                        <p className="text-[10px] text-[#7B78A8] font-semibold mb-2">Samakan progress siswa ini ke semua siswa aktif (per chapter):</p>
                        <div className="flex flex-wrap gap-1.5">
                          {chapters.map(ch=>{
                            const cp=currentStudentChProg[ch.id]??{unit:1,lesson:1}
                            const chUnits=getChUnits(ch.id)
                            if(chUnits.length===0)return null
                            return(
                              <button key={ch.id} onClick={()=>bulkSetProgress(ch.id,cp.unit,cp.lesson)} disabled={savingProgress}
                                className="text-[10px] px-2.5 py-1 bg-[#EEEDFE] text-[#5C4FE5] rounded-lg hover:bg-[#5C4FE5] hover:text-white transition-colors font-bold disabled:opacity-50">
                                {ch.chapter_title}: U{cp.unit}.L{cp.lesson}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ):(
            /* ── GRUP ── */
            <div className="bg-white rounded-xl border border-[#E5E3FF] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-[#1A1640]">Unit Progress Kelas</p>
                <div className="relative">
                  <button onClick={()=>setShowJumpDropdown(showJumpDropdown==='class'?null:'class')}
                    className="text-[10px] px-2.5 py-1 bg-[#F0EFFF] text-[#5C4FE5] rounded-lg hover:bg-[#5C4FE5] hover:text-white transition-colors font-bold">
                    🎯 Pindah ke...
                  </button>
                  {showJumpDropdown==='class'&&(
                    <div className="absolute right-0 top-8 z-30 w-72 bg-white rounded-xl border border-[#E5E3FF] shadow-lg max-h-72 overflow-y-auto">
                      {chapters.map(chapter=>{
                        const chUnits=getChUnits(chapter.id)
                        if(chUnits.length===0)return null
                        const cp=classChapterProgress[chapter.id]??{unit:1,lesson:1}
                        return(
                          <div key={chapter.id}>
                            <div className="px-3 py-1.5 bg-[#EEEDFE] text-xs font-bold text-[#4A4580] sticky top-0">{chapter.chapter_title}</div>
                            {chUnits.map((u,uIdx)=>{
                              const uPos=uIdx+1  // ← 1-based per-chapter index
                              const isCurrUnit=uPos===cp.unit
                              const unitLessons=lessons.filter(l=>l.unit_id===u.id).sort((a,b)=>a.position-b.position)
                              return(
                                <div key={u.id}>
                                  <div className="px-3 py-1 bg-[#F7F6FF] text-[11px] font-semibold text-[#1A1640]">{u.unit_name}</div>
                                  {unitLessons.length>0?unitLessons.map(l=>(
                                    <button key={l.id} onClick={()=>jumpClassTo(chapter.id,uPos,l.position)}
                                      className={`w-full text-left px-5 py-1.5 text-xs hover:bg-[#F0EFFF] transition-colors ${isCurrUnit&&l.position===cp.lesson?'text-[#5C4FE5] font-bold bg-[#F0EFFF]':'text-[#1A1640]'}`}>
                                      {l.lesson_name} {isCurrUnit&&l.position===cp.lesson?'← saat ini':''}
                                    </button>
                                  )):(
                                    <button onClick={()=>jumpClassTo(chapter.id,uPos,1)}
                                      className={`w-full text-left px-5 py-1.5 text-xs hover:bg-[#F0EFFF] transition-colors ${isCurrUnit?'text-[#5C4FE5] font-bold bg-[#F0EFFF]':'text-gray-400'}`}>
                                      (tanpa lesson) {isCurrUnit?'← saat ini':''}
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                {chapters.map(chapter=>{
                  const cp=classChapterProgress[chapter.id]??{unit:1,lesson:1}
                  const chUnits=getChUnits(chapter.id)
                  if(chUnits.length===0)return null
                  const isChOpen=openChapters.has(chapter.id)
                  const doneCh=Math.max(0,Math.min(cp.unit-1,chUnits.length))
                  return(
                    <div key={chapter.id} className="rounded-xl border border-[#E5E3FF] overflow-hidden">
                      <button onClick={()=>setOpenChapters(prev=>{const next=new Set(prev);next.has(chapter.id)?next.delete(chapter.id):next.add(chapter.id);return next})}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#F7F6FF] hover:bg-[#EEEDFE] transition-colors text-left">
                        <div className="flex items-center gap-2">
                          {isChOpen?<ChevronDown size={14} className="text-[#5C4FE5]"/>:<ChevronRight size={14} className="text-gray-400"/>}
                          <span className="text-sm font-bold text-[#1A1640]">{chapter.chapter_title}</span>
                        </div>
                        <span className="text-xs text-[#7B78A8]">{doneCh}/{chUnits.length} unit selesai</span>
                      </button>
                      {isChOpen&&(
                        <div className="p-2 space-y-1.5">
                          {chUnits.map((unit,unitIdx)=>{
                            const unitPosInCh=unitIdx+1  // ← KEY FIX
                            const isDone  =unitPosInCh<cp.unit
                            const isActive=unitPosInCh===cp.unit
                            const isLocked=unitPosInCh>cp.unit
                            const unitLessons=lessons.filter(l=>l.unit_id===unit.id).sort((a,b)=>a.position-b.position)
                            const hasLessons=unitLessons.length>0
                            const classKey=`class_${unit.id}`,isUnitOpen=openUnits.has(classKey)
                            return(
                              <div key={unit.id} className="rounded-lg overflow-hidden">
                                <div onClick={()=>{if(hasLessons&&!isLocked)setOpenUnits(prev=>{const next=new Set(prev);next.has(classKey)?next.delete(classKey):next.add(classKey);return next})}}
                                  className={`flex items-center justify-between px-3 py-2.5 border ${isDone?'bg-green-50 border-green-200':isActive?'bg-purple-50 border-[#5C4FE5]':'bg-gray-50 border-gray-200'} ${hasLessons&&!isLocked?'cursor-pointer':''}`}>
                                  <div className="flex items-center gap-2">
                                    {hasLessons&&!isLocked&&(isUnitOpen?<ChevronDown size={12} className="text-[#5C4FE5]"/>:<ChevronRight size={12} className="text-gray-400"/>)}
                                    <span>{isDone?'✅':isActive?'📖':'🔒'}</span>
                                    <span className={`text-sm font-medium ${isLocked?'text-gray-400':'text-[#1A1640]'}`}>{unit.unit_name}</span>
                                    {hasLessons&&<span className="text-[10px] text-[#7B78A8]">({unitLessons.length} lesson)</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isDone&&<button onClick={e=>{e.stopPropagation();revertClassTo(chapter.id,unitPosInCh,1)}} disabled={savingProgress} className="text-[10px] px-2 py-0.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors font-semibold">↩ Kembali</button>}
                                    {isActive&&!hasLessons&&<button onClick={e=>{e.stopPropagation();advanceClassLesson(chapter.id,1)}} disabled={savingProgress} className="text-xs px-3 py-1 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-40 font-semibold">Naik Unit →</button>}
                                    {isActive&&hasLessons&&<button onClick={e=>{e.stopPropagation();unlockAllClassLessons(chapter.id)}} disabled={savingProgress} className="text-[10px] px-2.5 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 font-bold shadow-sm">Selesaikan Unit ✓</button>}
                                  </div>
                                </div>
                                {isUnitOpen&&hasLessons&&(
                                  <div className="pl-8 pr-3 py-2 space-y-1 border-x border-b border-[#E5E3FF] bg-white">
                                    {unitLessons.map(lesson=>{
                                      const lessonDone  =isDone||(isActive&&lesson.position<cp.lesson)
                                      const lessonActive=isActive&&lesson.position===cp.lesson
                                      const canRevert   =(isActive||isDone)&&lessonDone
                                      return(
                                        <div key={lesson.id}
                                          onClick={()=>canRevert&&revertClassTo(chapter.id,unitPosInCh,lesson.position)}
                                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${lessonDone?'bg-green-50 text-[#1A1640]':lessonActive?'bg-[#F0EFFF] text-[#1A1640] border border-[#5C4FE5]':'bg-gray-50 text-gray-400'} ${canRevert?'cursor-pointer hover:bg-green-100 transition-colors':''}`}>
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs">{lessonDone?'✅':lessonActive?'▶️':'🔒'}</span>
                                            <span className={`font-medium ${lessonActive?'text-[#5C4FE5]':''}`}>{lesson.lesson_name}</span>
                                          </div>
                                          {lessonActive&&<button onClick={e=>{e.stopPropagation();advanceClassLesson(chapter.id,unitLessons.length)}} disabled={savingProgress} className="text-xs px-3 py-1 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7] disabled:opacity-40 font-semibold">{cp.lesson>=unitLessons.length?'Naik Unit →':'Naik Lesson →'}</button>}
                                          {canRevert&&<span className="text-[10px] text-green-600 opacity-50">↩ klik untuk kembali</span>}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Progress History */}
          {progressLogs.length>0&&(
            <div className="bg-white rounded-xl border border-[#E5E3FF] p-4">
              <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-2">📋 Riwayat Perubahan</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {progressLogs.map(log=>{
                  const studentName=log.student_id?enrollments.find(e=>e.student_id===log.student_id)?.student_name??'—':'Kelas'
                  const chapterName=log.chapter_id?chapters.find(c=>c.id===log.chapter_id)?.chapter_title??'—':'—'
                  const actionLabels:Record<string,string>={naik_lesson:'⬆️ Naik Lesson',naik_unit:'⬆️ Naik Unit',selesaikan_unit:'✅ Selesaikan Unit',revert:'↩ Kembali',jump:'🎯 Pindah',bulk_set:'👥 Bulk Set',naik_lesson_kelas:'⬆️ Naik Lesson',naik_unit_kelas:'⬆️ Naik Unit',selesaikan_unit_kelas:'✅ Selesaikan Unit',revert_kelas:'↩ Kembali',jump_kelas:'🎯 Pindah Kelas'}
                  return(
                    <div key={log.id} className="flex items-center gap-2 text-[10px] text-[#7B78A8] py-1 border-b border-[#F0EFFF] last:border-0">
                      <span className="font-semibold text-[#1A1640]">{studentName}</span>
                      <span>{actionLabels[log.action]??log.action}</span>
                      <span className="text-[#5C4FE5] font-medium truncate max-w-[80px]">{chapterName}</span>
                      <span>U{log.from_unit}.L{log.from_lesson}→U{log.to_unit}.L{log.to_lesson}</span>
                      <span className="ml-auto flex-shrink-0">{new Date(log.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: LEVEL ══ */}
      {activeTab==='level'&&(
        <div className="bg-white rounded-2xl border border-[#E5E3FF] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E3FF] bg-[#F7F6FF]">
            <p className="text-xs font-bold text-[#7B78A8] uppercase tracking-wide mb-2">Tambah Level ke Kelas Ini</p>
            {availableLevels.length===0?<p className="text-xs text-[#7B78A8]">{classLevels.length>0?'Semua level kursus ini sudah di-assign.':'Belum ada level tersedia.'}</p>:(
              <div className="flex gap-2">
                <select value={selectedLevelId} onChange={e=>setSelectedLevelId(e.target.value)} className="flex-1 px-3 py-2 rounded-xl border border-[#E5E3FF] text-sm text-[#1A1640] bg-white focus:outline-none focus:border-[#5C4FE5]">
                  <option value="">Pilih level...</option>
                  {availableLevels.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <button onClick={handleAddLevel} disabled={!selectedLevelId||addingLevel} className="flex items-center gap-1.5 px-4 py-2 bg-[#5C4FE5] text-white text-sm font-semibold rounded-xl hover:bg-[#3D34C4] transition disabled:opacity-50"><Plus size={14}/>{addingLevel?'Menambah...':'Tambah'}</button>
              </div>
            )}
          </div>
          {classLevels.length===0?(<div className="px-5 py-12 text-center"><div className="w-12 h-12 rounded-2xl bg-[#F0EFFF] flex items-center justify-center mx-auto mb-3"><BookOpen size={20} className="text-[#C4BFFF]"/></div><p className="text-sm text-[#7B78A8] font-semibold">Belum ada level</p></div>):(
            classLevels.map((cgl,idx)=>(
              <div key={cgl.id} className={`flex items-center gap-3 px-5 py-4 ${idx<classLevels.length-1?'border-b border-[#E5E3FF]':''}`}>
                <div className="w-7 h-7 rounded-lg bg-[#E5E3FF] flex items-center justify-center flex-shrink-0"><span className="text-xs font-black text-[#5C4FE5]">{idx+1}</span></div>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-[#1A1640]">{cgl.level?.name??'—'}</div>{cgl.level?.description&&<div className="text-xs text-[#7B78A8] truncate">{cgl.level.description}</div>}</div>
                {cgl.level?.target_age&&<span className="text-xs bg-[#E5E3FF] text-[#5C4FE5] font-semibold px-2 py-0.5 rounded-full flex-shrink-0">{cgl.level.target_age==='all'?'Semua Usia':cgl.level.target_age==='kids'?'Anak-anak':cgl.level.target_age==='teen'?'Remaja':cgl.level.target_age==='adult'?'Dewasa':cgl.level.target_age==='kids_teen'?'Anak & Remaja':'Remaja & Dewasa'}</span>}
                <button onClick={()=>handleRemoveLevel(cgl.id)} disabled={removingLevelId===cgl.id} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition disabled:opacity-50" title="Hapus dari kelas"><Trash size={14}/></button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MODALS ── */}
      {editSession&&(
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E3FF]"><div><h3 className="font-bold text-[#1A1640] text-sm">Edit Sesi</h3><p className="text-xs text-[#7B78A8] mt-0.5">{kelas?.label}</p></div><button onClick={()=>setEditSession(null)} className="p-1.5 rounded-lg hover:bg-[#F7F6FF] text-[#7B78A8]"><X size={16}/></button></div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Tanggal</label><input type="date" value={eDate} onChange={e=>setEDate(e.target.value)} className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"/></div>
                <div><label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Jam (WIT)</label><input type="time" value={eTime} onChange={e=>setETime(e.target.value)} className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"/></div>
              </div>
              <div><label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Status</label><select value={eStatus} onChange={e=>setEStatus(e.target.value)} className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"><option value="scheduled">Terjadwal</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option><option value="rescheduled">Dijadwal Ulang</option></select></div>
              <div><label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Link Zoom <span className="normal-case font-normal">(opsional)</span></label><input type="url" value={eZoom} onChange={e=>setEZoom(e.target.value)} placeholder="https://zoom.us/j/..." className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"/></div>
              {eErr&&<p className="text-[11px] text-red-600 px-3 py-2 bg-red-50 rounded-xl border border-red-200">{eErr}</p>}
              {eOk&&<p className="text-[11px] text-green-700 px-3 py-2 bg-green-50 rounded-xl border border-green-200 flex items-center gap-1.5"><Check size={12}/> Berhasil disimpan!</p>}
              <div className="flex gap-2 pt-1"><button onClick={()=>setEditSession(null)} className="flex-1 py-2.5 border border-[#E5E3FF] text-[#7B78A8] font-semibold rounded-xl text-sm hover:bg-[#F7F6FF] transition">Batal</button><button onClick={handleSaveSession} disabled={eSaving} className="flex-1 py-2.5 bg-[#5C4FE5] hover:bg-[#3D34C4] text-white font-bold rounded-xl text-sm transition disabled:opacity-60">{eSaving?'Menyimpan...':'Simpan'}</button></div>
            </div>
          </div>
        </div>
      )}
      {showPerpanjang&&perpanjangEnr&&kelas&&(
        <PerpanjangModal kelasId={kelasId} kelasLabel={kelas.label} kelasZoomLink={kelas.zoom_link} kelasClassTypeId={kelas.class_type_id} enrollment={perpanjangEnr} onClose={()=>setShowPerpanjang(false)} onSuccess={()=>{setShowPerpanjang(false);fetchAll()}}/>
      )}
      {editAbsensiSessionId&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E3FF]">
              <div><p className="text-[14px] font-extrabold text-[#1A1640]">Edit Absensi</p><p className="text-[11px] text-[#7B78A8] mt-0.5">{sessions.find(s=>s.id===editAbsensiSessionId)?new Date(sessions.find(s=>s.id===editAbsensiSessionId)!.scheduled_at).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Jayapura'}):''}</p></div>
              <button onClick={()=>setEditAbsensiSessionId(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F7F6FF] transition-colors"><X size={16} className="text-[#7B78A8]"/></button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-72 overflow-y-auto">
              {enrollments.map(e=>(<div key={e.student_id} className="flex items-center justify-between gap-3"><span className="text-[13px] font-semibold text-[#1A1640] flex-1 truncate">{e.student_name}</span><select value={editAbsensiData[e.student_id]??'tidak_hadir'} onChange={ev=>setEditAbsensiData(prev=>({...prev,[e.student_id]:ev.target.value}))} className="text-[12px] font-semibold px-2 py-1.5 rounded-lg border border-[#E5E3FF] bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5]"><option value="hadir">✓ Hadir</option><option value="tidak_hadir">✗ Tidak Hadir</option></select></div>))}
            </div>
            {absensiErr&&<p className="px-5 text-[11px] text-red-500 font-semibold">{absensiErr}</p>}
            <div className="px-5 py-4 border-t border-[#E5E3FF] flex gap-2">
              <button onClick={()=>setEditAbsensiSessionId(null)} className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-[#7B78A8] bg-[#F7F6FF] hover:bg-[#EEEDFE] transition-colors">Batal</button>
              <button onClick={saveAbsensi} disabled={absensiSaving} className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#5C4FE5] hover:bg-[#4338CA] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">{absensiSaving?(<><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Menyimpan...</>):'Simpan Absensi'}</button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-[#E5E3FF] shadow-xl p-6 max-w-sm w-full mx-4">
            <p className="text-sm font-semibold text-[#1A1640] mb-4">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={()=>setConfirmDialog(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#4A4580] border border-[#E5E3FF] hover:bg-[#F7F6FF] transition-colors">Batal</button>
              <button onClick={()=>{confirmDialog.onConfirm();setConfirmDialog(null)}} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-[#5C4FE5] hover:bg-[#4338CA] transition-colors">Ya, Lanjutkan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL BUAT TAGIHAN ── */}
      {showBuatTagihan&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E3FF]">
              <div>
                <p className="text-[14px] font-extrabold text-[#1A1640]">Buat Tagihan</p>
                <p className="text-[11px] text-[#7B78A8] mt-0.5">{kelas?.label}</p>
              </div>
              <button onClick={()=>setShowBuatTagihan(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F7F6FF] transition-colors">
                <X size={16} className="text-[#7B78A8]"/>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* Pilih Siswa */}
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Siswa</label>
                <select value={tagihanStudentId} onChange={e=>setTagihanStudentId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition">
                  <option value="">Pilih siswa...</option>
                  {enrollments.filter(e=>e.status==='active').map(e=>(
                    <option key={e.student_id} value={e.student_id}>{e.student_name}</option>
                  ))}
                </select>
              </div>
              {/* Jumlah */}
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Jumlah (Rp)</label>
                <input type="number" min="0" placeholder="Contoh: 500000"
                  value={tagihanAmount} onChange={e=>setTagihanAmount(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"/>
              </div>
              {/* Periode Label */}
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">
                  Label Periode <span className="normal-case font-normal">(opsional)</span>
                </label>
                <input type="text" placeholder="Contoh: Paket April 2026"
                  value={tagihanPeriod} onChange={e=>setTagihanPeriod(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E3FF] rounded-xl text-sm bg-[#F7F6FF] text-[#1A1640] focus:outline-none focus:border-[#5C4FE5] transition"/>
              </div>
              {/* Metode */}
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Metode Pembayaran</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['transfer','tunai'] as const).map(m=>(
                    <button key={m} onClick={()=>setTagihanMethod(m)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${tagihanMethod===m?'border-[#5C4FE5] bg-[#EEEDFE] text-[#5C4FE5]':'border-[#E5E3FF] text-[#7B78A8] hover:border-[#5C4FE5]'}`}>
                      {m==='transfer'?'💳 Transfer':'💵 Tunai'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Status */}
              <div>
                <label className="block text-[10px] font-bold text-[#7B78A8] uppercase tracking-wider mb-1.5">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    {v:'unpaid',label:'Belum Bayar'},
                    {v:'pending',label:'Menunggu'},
                    {v:'paid',label:'Lunas'},
                  ] as const).map(s=>(
                    <button key={s.v} onClick={()=>setTagihanStatus(s.v)}
                      className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${tagihanStatus===s.v?'border-[#5C4FE5] bg-[#EEEDFE] text-[#5C4FE5]':'border-[#E5E3FF] text-[#7B78A8] hover:border-[#5C4FE5]'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {tagihanErr&&<p className="text-[11px] text-red-600 px-3 py-2 bg-red-50 rounded-xl border border-red-200">{tagihanErr}</p>}
            </div>
            <div className="px-5 py-4 border-t border-[#E5E3FF] flex gap-2">
              <button onClick={()=>setShowBuatTagihan(false)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-[#7B78A8] bg-[#F7F6FF] hover:bg-[#EEEDFE] transition-colors">
                Batal
              </button>
              <button onClick={simpanTagihan} disabled={tagihanSaving}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#5C4FE5] hover:bg-[#4338CA] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {tagihanSaving?(<><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Menyimpan...</>):'Simpan Tagihan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
