// ================================================================
// ACCESS CONTROL HELPER
// Bulk material access check using our PostgreSQL function
// ================================================================

import { createClient } from '@/lib/supabase/server';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
export type AccessResult = {
  material_id: string;
  can_access: boolean;
  reason: 'override_unlock' | 'override_lock' | 'paid_enrollment' | 'no_access';
};

export type MaterialWithAccess = {
  id: string;
  title: string;
  type: string;
  level_id: string;
  unit_id: string;
  is_published: boolean;
  content_data: any;
  can_access: boolean;
  access_reason: string;
  order_number: number;
  lesson_number?: number;
  lesson_name?: string;
};

// ----------------------------------------------------------------
// Main function: Check bulk material access
// ----------------------------------------------------------------
export async function checkBulkMaterialAccess(
  studentId: string,
  materialIds: string[]
): Promise<Map<string, AccessResult>> {
  const supabase = createClient();

  // Call our PostgreSQL function
  const { data, error } = await supabase.rpc('check_bulk_material_access', {
    p_student_id: studentId,
    p_material_ids: materialIds,
  });

  if (error) {
    console.error('Bulk access check error:', error);
    // Return empty access (no access to anything)
    return new Map();
  }

  // Convert array to Map for easy lookup
  const accessMap = new Map<string, AccessResult>();
  
  if (data && Array.isArray(data)) {
    data.forEach((item: AccessResult) => {
      accessMap.set(item.material_id, item);
    });
  }

  return accessMap;
}

// ----------------------------------------------------------------
// Helper: Filter materials by access
// ----------------------------------------------------------------
export function filterMaterialsByAccess(
  materials: any[],
  accessMap: Map<string, AccessResult>
): MaterialWithAccess[] {
  return materials.map(material => {
    const access = accessMap.get(material.id);
    
    return {
      ...material,
      can_access: access?.can_access || false,
      access_reason: access?.reason || 'no_access',
    };
  });
}

// ----------------------------------------------------------------
// Helper: Get accessible materials only
// ----------------------------------------------------------------
export function getAccessibleMaterials(
  materials: any[],
  accessMap: Map<string, AccessResult>
): MaterialWithAccess[] {
  const withAccess = filterMaterialsByAccess(materials, accessMap);
  return withAccess.filter(m => m.can_access);
}
