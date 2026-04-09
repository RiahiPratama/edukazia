'use client';

import { useState, useEffect } from 'react';
import { BarChart3, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type LevelProgress = {
  levelId: string;
  levelName: string;
  sortOrder: number;
  chapters: number;
  units: number;
  lessons: number;
  totalMaterials: number;
  published: number;
  draft: number;
};

type Props = {
  category: 'live_zoom' | 'bacaan' | 'kosakata' | 'cefr';
};

export default function ProgressOverview({ category }: Props) {
  const [data, setData] = useState<LevelProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchProgress();
  }, [category]);

  const fetchProgress = async () => {
    setLoading(true);
    try {
      // 1. Fetch all materials for this category
      const { data: materials } = await supabase
        .from('materials')
        .select('id, lesson_id, is_published')
        .eq('category', category);

      if (!materials || materials.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // 2. Fetch lessons
      const lessonIds = [...new Set(materials.map(m => m.lesson_id).filter(Boolean))];
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, unit_id')
        .in('id', lessonIds);

      // 3. Fetch units
      const unitIds = [...new Set((lessons || []).map(l => l.unit_id).filter(Boolean))];
      const { data: units } = await supabase
        .from('units')
        .select('id, chapter_id, level_id')
        .in('id', unitIds);

      // 4. Fetch chapters
      const chapterIds = [...new Set((units || []).map(u => u.chapter_id).filter(Boolean))];
      const { data: chapters } = await supabase
        .from('chapters')
        .select('id, level_id')
        .in('id', chapterIds);

      // 5. Fetch all levels
      const levelIds = [...new Set((units || []).map(u => u.level_id).filter(Boolean))];
      const { data: levels } = await supabase
        .from('levels')
        .select('id, name, sort_order')
        .in('id', levelIds)
        .order('sort_order');

      // 6. Build lookup maps
      const lessonToUnit = new Map((lessons || []).map(l => [l.id, l.unit_id]));
      const unitToLevel = new Map((units || []).map(u => [u.id, u.level_id]));
      const unitToChapter = new Map((units || []).map(u => [u.id, u.chapter_id]));

      // 7. Aggregate per level
      const levelMap = new Map<string, LevelProgress>();

      (levels || []).forEach(l => {
        levelMap.set(l.id, {
          levelId: l.id,
          levelName: l.name,
          sortOrder: l.sort_order || 0,
          chapters: 0,
          units: 0,
          lessons: 0,
          totalMaterials: 0,
          published: 0,
          draft: 0,
        });
      });

      // Count chapters per level
      const chaptersByLevel = new Map<string, Set<string>>();
      (chapters || []).forEach(ch => {
        if (!chaptersByLevel.has(ch.level_id)) chaptersByLevel.set(ch.level_id, new Set());
        chaptersByLevel.get(ch.level_id)!.add(ch.id);
      });

      // Count units per level
      const unitsByLevel = new Map<string, Set<string>>();
      (units || []).forEach(u => {
        if (!unitsByLevel.has(u.level_id)) unitsByLevel.set(u.level_id, new Set());
        unitsByLevel.get(u.level_id)!.add(u.id);
      });

      // Count lessons & materials per level
      const lessonsByLevel = new Map<string, Set<string>>();

      materials.forEach(m => {
        const unitId = lessonToUnit.get(m.lesson_id);
        if (!unitId) return;
        const levelId = unitToLevel.get(unitId);
        if (!levelId) return;

        const lp = levelMap.get(levelId);
        if (!lp) return;

        lp.totalMaterials++;
        if (m.is_published) lp.published++;
        else lp.draft++;

        if (!lessonsByLevel.has(levelId)) lessonsByLevel.set(levelId, new Set());
        lessonsByLevel.get(levelId)!.add(m.lesson_id);
      });

      // Fill counts
      levelMap.forEach((lp, levelId) => {
        lp.chapters = chaptersByLevel.get(levelId)?.size || 0;
        lp.units = unitsByLevel.get(levelId)?.size || 0;
        lp.lessons = lessonsByLevel.get(levelId)?.size || 0;
      });

      setData([...levelMap.values()].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (err) {
      console.error('Error fetching progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const totals = data.reduce(
    (acc, d) => ({
      chapters: acc.chapters + d.chapters,
      units: acc.units + d.units,
      lessons: acc.lessons + d.lessons,
      totalMaterials: acc.totalMaterials + d.totalMaterials,
      published: acc.published + d.published,
      draft: acc.draft + d.draft,
    }),
    { chapters: 0, units: 0, lessons: 0, totalMaterials: 0, published: 0, draft: 0 }
  );

  return (
    <div className="border-2 border-[#E5E3FF] rounded-xl overflow-hidden mb-6">
      {/* Header — collapsible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white hover:from-purple-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#5C4FE5]" />
          <span className="text-sm font-bold text-gray-900">Progress Materi</span>
          {!loading && (
            <span className="text-xs text-gray-500 font-medium">
              {totals.published}/{totals.totalMaterials} published
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!loading && totals.totalMaterials > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${(totals.published / totals.totalMaterials) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-green-600">
                {Math.round((totals.published / totals.totalMaterials) * 100)}%
              </span>
            </div>
          )}
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Table */}
      {expanded && (
        <div className="border-t border-[#E5E3FF]">
          {loading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Memuat progress...
            </div>
          ) : data.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">Belum ada materi di kategori ini</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5 font-semibold">Level</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Chapter</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Unit</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Lesson</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Published</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Draft</th>
                    <th className="text-center px-3 py-2.5 font-semibold">Total</th>
                    <th className="text-center px-4 py-2.5 font-semibold w-32">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => {
                    const pct = row.totalMaterials > 0 ? Math.round((row.published / row.totalMaterials) * 100) : 0;
                    return (
                      <tr key={row.levelId} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-gray-900">{row.levelName}</td>
                        <td className="text-center px-3 py-2.5 text-gray-600">{row.chapters}</td>
                        <td className="text-center px-3 py-2.5 text-gray-600">{row.units}</td>
                        <td className="text-center px-3 py-2.5 text-gray-600">{row.lessons}</td>
                        <td className="text-center px-3 py-2.5">
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">{row.published}</span>
                        </td>
                        <td className="text-center px-3 py-2.5">
                          {row.draft > 0 ? (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">{row.draft}</span>
                          ) : (
                            <span className="text-gray-300">0</span>
                          )}
                        </td>
                        <td className="text-center px-3 py-2.5 font-semibold text-gray-700">{row.totalMaterials}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-blue-500' : pct > 0 ? 'bg-yellow-500' : 'bg-gray-300'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold min-w-[32px] text-right ${pct === 100 ? 'text-green-600' : 'text-gray-500'}`}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="border-t-2 border-[#E5E3FF] bg-purple-50 font-semibold">
                    <td className="px-4 py-2.5 text-[#5C4FE5]">Total ({data.length} level)</td>
                    <td className="text-center px-3 py-2.5 text-gray-700">{totals.chapters}</td>
                    <td className="text-center px-3 py-2.5 text-gray-700">{totals.units}</td>
                    <td className="text-center px-3 py-2.5 text-gray-700">{totals.lessons}</td>
                    <td className="text-center px-3 py-2.5">
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">{totals.published}</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">{totals.draft}</span>
                    </td>
                    <td className="text-center px-3 py-2.5 text-gray-700">{totals.totalMaterials}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#5C4FE5] rounded-full transition-all"
                            style={{ width: `${totals.totalMaterials > 0 ? Math.round((totals.published / totals.totalMaterials) * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-[#5C4FE5] min-w-[32px] text-right">
                          {totals.totalMaterials > 0 ? Math.round((totals.published / totals.totalMaterials) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
