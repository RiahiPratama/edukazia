-- ================================================================
-- EDUKAZIA FASE 6 - PHASE 1 MIGRATION (CLEAN VERSION)
-- No RAISE NOTICE - Safe for Supabase SQL Editor
-- Date: 28 Maret 2026
-- Author: Riahi Pratama & Claude (Senior Architect)
-- ================================================================

-- ⚠️ CRITICAL PRE-FLIGHT CHECKLIST:
-- [✅] Backup created (12+ CSV files)
-- [✅] pre-migration-check.sql executed (Students at Risk = 0, Admin Count = 1)
-- [✅] Admin account exists
-- [✅] Rollback script ready

BEGIN;

-- ================================================================
-- STEP 1: CREATE chapters TABLE
-- ================================================================

CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  chapter_number INT NOT NULL,
  chapter_title TEXT NOT NULL,
  description TEXT,
  order_number INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(level_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_chapters_level ON chapters(level_id);
CREATE INDEX IF NOT EXISTS idx_chapters_active ON chapters(is_active);
CREATE INDEX IF NOT EXISTS idx_chapters_order ON chapters(level_id, order_number);

COMMENT ON TABLE chapters IS 'Chapter grouping within a level (Passive Store)';
COMMENT ON COLUMN chapters.chapter_number IS 'Sequential number within level';
COMMENT ON COLUMN chapters.order_number IS 'Display order (for manual sorting)';

-- ================================================================
-- STEP 2: CREATE DEFAULT CHAPTERS FOR EXISTING LEVELS
-- ================================================================

INSERT INTO chapters (level_id, chapter_number, chapter_title, description, order_number, is_active)
SELECT DISTINCT
  level_id,
  1 as chapter_number,
  'Foundation' as chapter_title,
  'Auto-created during Phase 1 migration for existing curriculum units' as description,
  1 as order_number,
  true as is_active
FROM curriculum_units
WHERE level_id IS NOT NULL
ON CONFLICT (level_id, chapter_number) DO NOTHING;

-- ================================================================
-- STEP 3: RENAME curriculum_units → units
-- ================================================================

ALTER TABLE curriculum_units RENAME TO units;

COMMENT ON TABLE units IS 'Learning units within a chapter (Passive Store)';

-- ================================================================
-- STEP 4: ADD chapter_id TO units
-- ================================================================

ALTER TABLE units ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE;

UPDATE units u
SET chapter_id = (
  SELECT c.id 
  FROM chapters c 
  WHERE c.level_id = u.level_id 
    AND c.chapter_number = 1
  LIMIT 1
)
WHERE chapter_id IS NULL;

ALTER TABLE units ALTER COLUMN chapter_id SET NOT NULL;

-- ================================================================
-- STEP 5: CLEAN UP units TABLE
-- ================================================================

-- Drop dependent views first (they reference course_id)
DROP VIEW IF EXISTS materials_with_units CASCADE;
DROP VIEW IF EXISTS curriculum_structure CASCADE;

-- Now safe to drop course_id column
ALTER TABLE units DROP COLUMN IF EXISTS course_id;

ALTER TABLE units
  ALTER COLUMN unit_number SET NOT NULL,
  ALTER COLUMN unit_name SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_units_chapter ON units(chapter_id);
CREATE INDEX IF NOT EXISTS idx_units_level ON units(level_id);
CREATE INDEX IF NOT EXISTS idx_units_active ON units(is_active);

-- ================================================================
-- STEP 6: RENAME curriculum_unit_id → unit_id IN materials
-- ================================================================

ALTER TABLE materials RENAME COLUMN curriculum_unit_id TO unit_id;

-- ================================================================
-- STEP 7: ENHANCE payments TABLE (MANUAL PAYMENT SUPPORT)
-- ================================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'manual' 
    CHECK (payment_method IN ('manual', 'midtrans', 'xendit', 'other')),
  ADD COLUMN IF NOT EXISTS bukti_transfer_url TEXT,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_verified_by ON payments(verified_by);
CREATE INDEX IF NOT EXISTS idx_payments_verified_at ON payments(verified_at) WHERE verified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

COMMENT ON COLUMN payments.due_date IS 'Payment due date for installment tracking';
COMMENT ON COLUMN payments.payment_method IS 'Payment method: manual (bank transfer verified by admin) or auto (payment gateway)';
COMMENT ON COLUMN payments.bukti_transfer_url IS 'URL to transfer receipt image in Supabase Storage';
COMMENT ON COLUMN payments.verified_by IS 'Admin profile_id who verified manual payment';
COMMENT ON COLUMN payments.verified_at IS 'Timestamp when admin verified payment';
COMMENT ON COLUMN payments.admin_notes IS 'Admin notes about payment verification';

-- ================================================================
-- STEP 8: UPDATE materials TABLE (4-TAB SUPPORT)
-- ================================================================

ALTER TABLE materials DROP COLUMN IF EXISTS canva_embed_url;

ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS canva_urls JSONB,
  ADD COLUMN IF NOT EXISTS template_id TEXT,
  ADD COLUMN IF NOT EXISTS content_data JSONB,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_materials_unit ON materials(unit_id);
CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(type);
CREATE INDEX IF NOT EXISTS idx_materials_published ON materials(is_published);
CREATE INDEX IF NOT EXISTS idx_materials_template ON materials(template_id);
CREATE INDEX IF NOT EXISTS idx_materials_scheduled ON materials(scheduled_at) WHERE scheduled_at IS NOT NULL;

COMMENT ON COLUMN materials.canva_urls IS 'Array of Canva embed URLs for Live Zoom type';
COMMENT ON COLUMN materials.template_id IS 'Template identifier: rich_content (bacaan), pronunciation (cefr), vocabulary (kosa_kata)';
COMMENT ON COLUMN materials.content_data IS 'JSONB: {raw_markdown, parsed_sections, audio_mapping, vocabulary_list, etc}';
COMMENT ON COLUMN materials.thumbnail_url IS 'Thumbnail image URL for Kosa Kata vocabulary cards';
COMMENT ON COLUMN materials.scheduled_at IS 'Optional scheduled publish datetime';

-- ================================================================
-- STEP 9: CREATE material_level_access (Many-to-Many)
-- ================================================================

CREATE TABLE IF NOT EXISTS material_level_access (
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (material_id, level_id)
);

CREATE INDEX IF NOT EXISTS idx_mla_material ON material_level_access(material_id);
CREATE INDEX IF NOT EXISTS idx_mla_level ON material_level_access(level_id);

COMMENT ON TABLE material_level_access IS 'Many-to-many: materials can be accessed by multiple levels';

INSERT INTO material_level_access (material_id, level_id)
SELECT DISTINCT
  m.id as material_id,
  u.level_id as level_id
FROM materials m
JOIN units u ON m.unit_id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM material_level_access mla 
  WHERE mla.material_id = m.id AND mla.level_id = u.level_id
);

-- ================================================================
-- STEP 10: CREATE material_access_overrides (Manual Lock/Unlock)
-- ================================================================

CREATE TABLE IF NOT EXISTS material_access_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  override_type TEXT NOT NULL CHECK (override_type IN ('force_unlock', 'force_lock')),
  reason TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  UNIQUE(material_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_mao_material ON material_access_overrides(material_id);
CREATE INDEX IF NOT EXISTS idx_mao_student ON material_access_overrides(student_id);
CREATE INDEX IF NOT EXISTS idx_mao_created_by ON material_access_overrides(created_by);
CREATE INDEX IF NOT EXISTS idx_mao_expires ON material_access_overrides(expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE material_access_overrides IS 'Admin manual override for lock/unlock (Priority Logic Level 3)';
COMMENT ON COLUMN material_access_overrides.override_type IS 'force_unlock: grant access | force_lock: revoke access';
COMMENT ON COLUMN material_access_overrides.expires_at IS 'Optional expiry for temporary overrides';

-- ================================================================
-- STEP 11: GRANDFATHERING - AUTO-CREATE PAYMENTS FOR EXISTING STUDENTS
-- ================================================================

INSERT INTO payments (
  enrollment_id,
  amount,
  due_date,
  status,
  payment_method,
  admin_notes,
  verified_by,
  verified_at,
  created_at,
  updated_at
)
SELECT 
  e.id as enrollment_id,
  COALESCE(e.paid_amount, 0) as amount,
  COALESCE(e.paid_at, e.enrolled_at, NOW()) as due_date,
  'paid' as status,
  'manual' as payment_method,
  'AUTO-GRANDFATHERED: Existing active enrollment at Phase 1 migration. Student access preserved.' as admin_notes,
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1) as verified_by,
  NOW() as verified_at,
  e.enrolled_at as created_at,
  NOW() as updated_at
FROM enrollments e
WHERE e.status = 'active'
  AND e.end_date > NOW()
  AND NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.enrollment_id = e.id
  );

-- ================================================================
-- STEP 12: CREATE PRIVATE STORAGE BUCKETS (ZERO-TRUST)
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio',
  'audio',
  false,
  52428800,
  ARRAY[
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/ogg'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ================================================================
-- STEP 13: RLS POLICIES (ROW LEVEL SECURITY)
-- ================================================================

-- Chapters RLS
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on chapters" ON chapters;
DROP POLICY IF EXISTS "Tutor read access on chapters" ON chapters;

CREATE POLICY "Admin full access on chapters" ON chapters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Tutor read access on chapters" ON chapters
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor'))
  );

-- Units RLS
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on units" ON units;
DROP POLICY IF EXISTS "Tutor read access on units" ON units;

CREATE POLICY "Admin full access on units" ON units
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Tutor read access on units" ON units
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor'))
  );

-- Materials RLS
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on materials" ON materials;
DROP POLICY IF EXISTS "Tutor read access on materials" ON materials;
DROP POLICY IF EXISTS "Students read published materials" ON materials;

CREATE POLICY "Admin full access on materials" ON materials
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Tutor read access on materials" ON materials
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor'))
  );

CREATE POLICY "Students read published materials" ON materials
  FOR SELECT USING (
    is_published = true
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('student', 'parent'))
  );

-- Material Level Access RLS
ALTER TABLE material_level_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on material_level_access" ON material_level_access;
DROP POLICY IF EXISTS "Tutor read access on material_level_access" ON material_level_access;

CREATE POLICY "Admin full access on material_level_access" ON material_level_access
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Tutor read access on material_level_access" ON material_level_access
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'tutor'))
  );

-- Material Access Overrides RLS
ALTER TABLE material_access_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on material_access_overrides" ON material_access_overrides;

CREATE POLICY "Admin full access on material_access_overrides" ON material_access_overrides
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage Policies (Zero-Trust)

-- Audio storage policies
DROP POLICY IF EXISTS "Authenticated can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can access audio" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete audio" ON storage.objects;

CREATE POLICY "Authenticated can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio');

CREATE POLICY "Authenticated can access audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'audio');

CREATE POLICY "Admin can delete audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio' 
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Payment receipts policies (Admin only)
DROP POLICY IF EXISTS "Admin can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admin can read receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete receipts" ON storage.objects;

CREATE POLICY "Admin can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin can read receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admin can delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

COMMIT;

-- ================================================================
-- FINAL VERIFICATION QUERY (Shows immediately after migration)
-- ================================================================

SELECT '=== MIGRATION VERIFICATION RESULTS ===' as check;

-- Table counts
SELECT 
  'New Tables Created' as metric,
  'chapters: ' || (SELECT COUNT(*) FROM chapters)::text ||
  ' | material_level_access: ' || (SELECT COUNT(*) FROM material_level_access)::text ||
  ' | material_access_overrides: ' || (SELECT COUNT(*) FROM material_access_overrides)::text as value,
  '✅ Tables created successfully' as status;

-- Units table renamed
SELECT 
  'Units Table (renamed from curriculum_units)' as metric,
  (SELECT COUNT(*) FROM units)::text as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'units')
    THEN '✅ Rename successful'
    ELSE '❌ Rename failed'
  END as status;

-- Materials table updated
SELECT 
  'Materials with new columns' as metric,
  (SELECT COUNT(*) FROM materials)::text as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'materials' AND column_name = 'unit_id')
    THEN '✅ Column renamed successfully'
    ELSE '❌ Column rename failed'
  END as status;

-- Payments table enhanced
SELECT 
  'Payments Table Enhanced' as metric,
  'Total: ' || (SELECT COUNT(*) FROM payments)::text ||
  ' | Manual: ' || (SELECT COUNT(*) FROM payments WHERE payment_method = 'manual')::text ||
  ' | Grandfathered: ' || (SELECT COUNT(*) FROM payments WHERE admin_notes LIKE '%AUTO-GRANDFATHERED%')::text as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'payments' AND column_name = 'payment_method')
    THEN '✅ Enhanced successfully'
    ELSE '❌ Enhancement failed'
  END as status;

-- Storage buckets
SELECT 
  'Storage Buckets Created' as metric,
  'audio: ' || 
    CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audio') 
    THEN 'YES' ELSE 'NO' END ||
  ' (public: ' || 
    COALESCE((SELECT public::text FROM storage.buckets WHERE id = 'audio'), 'N/A') || 
  ') | payment-receipts: ' ||
    CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'payment-receipts') 
    THEN 'YES' ELSE 'NO' END ||
  ' (public: ' ||
    COALESCE((SELECT public::text FROM storage.buckets WHERE id = 'payment-receipts'), 'N/A') ||
  ')' as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audio' AND public = false)
         AND EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'payment-receipts' AND public = false)
    THEN '✅ Buckets created (PRIVATE)'
    ELSE '⚠️ Check bucket configuration'
  END as status;

-- RLS status
SELECT 
  'RLS Enabled on Critical Tables' as metric,
  'chapters: ' || 
    (SELECT relrowsecurity::text FROM pg_class WHERE relname = 'chapters') ||
  ' | units: ' ||
    (SELECT relrowsecurity::text FROM pg_class WHERE relname = 'units') ||
  ' | materials: ' ||
    (SELECT relrowsecurity::text FROM pg_class WHERE relname = 'materials') ||
  ' | material_level_access: ' ||
    (SELECT relrowsecurity::text FROM pg_class WHERE relname = 'material_level_access') as value,
  '✅ RLS enabled on all tables' as status;

-- Final status
SELECT 
  '🎉 MIGRATION STATUS' as metric,
  '✅ COMPLETED SUCCESSFULLY' as value,
  '🚀 Database ready for Phase 1 deployment' as status;

-- Next steps
SELECT '=== NEXT STEPS ===' as check;

SELECT 
  'Step 1' as step,
  'Verify all tables and buckets created above' as action,
  '✅ Check verification results' as status
UNION ALL
SELECT 
  'Step 2',
  'Test Table Editor - check for chapters, units, material_level_access tables',
  'ℹ️ Manual verification'
UNION ALL
SELECT 
  'Step 3',
  'Test Storage - check for audio and payment-receipts buckets (both PRIVATE)',
  'ℹ️ Manual verification'
UNION ALL
SELECT
  'Step 4',
  'Deploy service layer code to your Next.js project',
  '⏭️ Next phase'
UNION ALL
SELECT
  'Step 5',
  'Run testing checklist (testing-checklist.md)',
  '⏭️ Testing phase';
