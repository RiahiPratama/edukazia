-- ================================================================
-- EDUKAZIA POST-MIGRATION VERIFICATION
-- Verifikasi migration phase1 sudah sukses atau belum
-- ================================================================

SELECT '=== POST-MIGRATION VERIFICATION RESULTS ===' as check;

-- 1. Check new tables created
SELECT 
  '1. New Tables Created' as metric,
  'chapters: ' || COALESCE((SELECT COUNT(*)::text FROM chapters), '0') ||
  ' | material_level_access: ' || COALESCE((SELECT COUNT(*)::text FROM material_level_access), '0') ||
  ' | material_access_overrides: ' || COALESCE((SELECT COUNT(*)::text FROM material_access_overrides), '0') as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chapters')
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_level_access')
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_access_overrides')
    THEN '✅ All new tables created'
    ELSE '❌ Some tables missing'
  END as status

UNION ALL

-- 2. Check curriculum_units renamed to units
SELECT 
  '2. Table Rename (curriculum_units → units)' as metric,
  'units exists: ' || 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'units')
    THEN 'YES' ELSE 'NO' END ||
  ' | curriculum_units exists: ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'curriculum_units')
    THEN 'YES (NOT renamed!)' ELSE 'NO (renamed successfully)' END as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'units')
         AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'curriculum_units')
    THEN '✅ Rename successful'
    ELSE '❌ Rename failed or incomplete'
  END as status

UNION ALL

-- 3. Check units table has chapter_id column
SELECT 
  '3. Units Table Structure' as metric,
  'Total units: ' || COALESCE((SELECT COUNT(*)::text FROM units), '0') ||
  ' | Has chapter_id: ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'chapter_id')
    THEN 'YES' ELSE 'NO' END ||
  ' | Has course_id: ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'course_id')
    THEN 'YES (should be removed!)' ELSE 'NO (removed successfully)' END as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'chapter_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = 'units' AND column_name = 'course_id')
    THEN '✅ Structure correct'
    ELSE '❌ Structure incomplete'
  END as status

UNION ALL

-- 4. Check materials table has unit_id column
SELECT 
  '4. Materials Table Structure' as metric,
  'Total materials: ' || COALESCE((SELECT COUNT(*)::text FROM materials), '0') ||
  ' | Has unit_id: ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'unit_id')
    THEN 'YES' ELSE 'NO' END ||
  ' | Has curriculum_unit_id: ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'curriculum_unit_id')
    THEN 'YES (should be removed!)' ELSE 'NO (renamed successfully)' END as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'unit_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'curriculum_unit_id')
    THEN '✅ Column renamed successfully'
    ELSE '❌ Rename incomplete'
  END as status

UNION ALL

-- 5. Check payments table enhancements
SELECT 
  '5. Payments Table Enhanced' as metric,
  'Total payments: ' || COALESCE((SELECT COUNT(*)::text FROM payments), '0') ||
  ' | Manual payments: ' || COALESCE((SELECT COUNT(*)::text FROM payments WHERE payment_method = 'manual'), '0') ||
  ' | Grandfathered: ' || COALESCE((SELECT COUNT(*)::text FROM payments WHERE admin_notes LIKE '%AUTO-GRANDFATHERED%'), '0') as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_method')
         AND EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'due_date')
         AND EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'created_at')
         AND EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'updated_at')
    THEN '✅ All columns added'
    ELSE '❌ Some columns missing'
  END as status

UNION ALL

-- 6. Check storage buckets
SELECT 
  '6. Storage Buckets (Private)' as metric,
  'audio: ' || 
    CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audio') 
    THEN 'EXISTS' ELSE 'NOT FOUND' END ||
  ' (public: ' || 
    COALESCE((SELECT public::text FROM storage.buckets WHERE id = 'audio'), 'N/A') || 
  ') | payment-receipts: ' ||
    CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'payment-receipts') 
    THEN 'EXISTS' ELSE 'NOT FOUND' END ||
  ' (public: ' ||
    COALESCE((SELECT public::text FROM storage.buckets WHERE id = 'payment-receipts'), 'N/A') ||
  ')' as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audio' AND public = false)
         AND EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'payment-receipts' AND public = false)
    THEN '✅ Both buckets created (PRIVATE)'
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audio')
         AND EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'payment-receipts')
    THEN '⚠️ Buckets exist but check public status'
    ELSE '❌ Buckets missing'
  END as status

UNION ALL

-- 7. Check RLS enabled
SELECT 
  '7. RLS Enabled on New Tables' as metric,
  'chapters: ' || 
    COALESCE((SELECT relrowsecurity::text FROM pg_class WHERE relname = 'chapters'), 'N/A') ||
  ' | units: ' ||
    COALESCE((SELECT relrowsecurity::text FROM pg_class WHERE relname = 'units'), 'N/A') ||
  ' | materials: ' ||
    COALESCE((SELECT relrowsecurity::text FROM pg_class WHERE relname = 'materials'), 'N/A') ||
  ' | material_level_access: ' ||
    COALESCE((SELECT relrowsecurity::text FROM pg_class WHERE relname = 'material_level_access'), 'N/A') as value,
  CASE 
    WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'chapters') = true
         AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'units') = true
         AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'materials') = true
         AND (SELECT relrowsecurity FROM pg_class WHERE relname = 'material_level_access') = true
    THEN '✅ RLS enabled on all tables'
    ELSE '⚠️ Check RLS status'
  END as status

UNION ALL

-- 8. Check materials new columns
SELECT 
  '8. Materials New Columns' as metric,
  'canva_urls: ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'canva_urls')
    THEN 'YES' ELSE 'NO' END ||
  ' | template_id: ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'template_id')
    THEN 'YES' ELSE 'NO' END ||
  ' | content_data: ' ||
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'content_data')
    THEN 'YES' ELSE 'NO' END as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'canva_urls')
         AND EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'template_id')
         AND EXISTS (SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'materials' AND column_name = 'content_data')
    THEN '✅ All new columns added'
    ELSE '❌ Some columns missing'
  END as status

UNION ALL

-- 9. Final migration status
SELECT 
  '9. 🎉 FINAL MIGRATION STATUS' as metric,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chapters')
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'units')
         AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'curriculum_units')
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_method')
         AND EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audio')
    THEN '✅ MIGRATION COMPLETED SUCCESSFULLY'
    ELSE '⚠️ MIGRATION INCOMPLETE - Check details above'
  END as value,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chapters')
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'units')
         AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'curriculum_units')
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_method')
         AND EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'audio')
    THEN '🚀 Database ready for Phase 1 deployment'
    ELSE '⚠️ Review failed checks above'
  END as status

ORDER BY metric;
