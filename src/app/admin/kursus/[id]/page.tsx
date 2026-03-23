import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import KursusEditClient from './KursusEditClient'

export default async function KursusEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: kursus } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single()

  if (!kursus) notFound()

  const { data: levels } = await supabase
    .from('levels')
    .select('*')
    .eq('course_id', id)
    .order('sort_order')

  return <KursusEditClient kursus={kursus} levels={levels ?? []} />
}
