'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Video, FileText, Headphones, Trash2, Edit, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Material = {
  id: string;
  title: string;
  type: string;
  category: string;
  course_id: string;
  level_id: string;
  unit_id: string;
  lesson_id: string;
  order_number: number;
  is_published: boolean;
  content_data: any;
  created_at: string;
};

type MaterialListProps = {
  category: 'live_zoom' | 'bacaan' | 'kosakata' | 'cefr';
  onEdit?: (material: Material) => void;
};

export default function MaterialList({ category, onEdit }: MaterialListProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchMaterials();
  }, [category]);

  const fetchMaterials = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('materials')
        .select('*')
        .eq('category', category)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setMaterials(data || []);
    } catch (err) {
      console.error('Error fetching materials:', err);
      setError('Gagal memuat daftar materi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus materi ini?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('materials')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      alert('✅ Materi berhasil dihapus!');
      fetchMaterials();
    } catch (err) {
      console.error('Error deleting material:', err);
      alert('❌ Gagal menghapus materi');
    }
  };

  const getCategoryIcon = () => {
    switch (category) {
      case 'live_zoom': return <Video size={16} className="text-blue-600" />;
      case 'bacaan': return <BookOpen size={16} className="text-green-600" />;
      case 'kosakata': return <FileText size={16} className="text-yellow-600" />;
      case 'cefr': return <Headphones size={16} className="text-red-600" />;
    }
  };

  const getCategoryLabel = () => {
    switch (category) {
      case 'live_zoom': return 'Live Zoom';
      case 'bacaan': return 'Bacaan';
      case 'kosakata': return 'Kosakata';
      case 'cefr': return 'CEFR';
    }
  };

  const getContentPreview = (material: Material) => {
    const data = material.content_data;
    
    switch (category) {
      case 'live_zoom':
        return (
          <div className="text-sm text-gray-600">
            <span className="font-medium">{data?.platform || 'N/A'}</span>
            {data?.url && (
              <a 
                href={data.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-2 text-[#5C4FE5] hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink size={12} />
                Link
              </a>
            )}
          </div>
        );
      case 'bacaan':
        return (
          <div className="text-sm text-gray-600">
            {data?.jsx_file_path && (
              <span className="text-green-600">✓ JSX Component uploaded</span>
            )}
            {data?.description && (
              <p className="mt-1 text-xs line-clamp-2">{data.description}</p>
            )}
          </div>
        );
      case 'kosakata':
        return (
          <div className="text-sm text-gray-600">
            <span className="font-medium">{data?.file_type || 'N/A'}</span>
            {data?.url && (
              <a 
                href={data.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-2 text-[#5C4FE5] hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink size={12} />
                Link
              </a>
            )}
          </div>
        );
      case 'cefr':
        return (
          <div className="text-sm text-gray-600">
            {data?.audio_url && (
              <span className="text-red-600">✓ Audio uploaded</span>
            )}
            <div className="flex gap-2 mt-1">
              {data?.skill_focus && (
                <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                  {data.skill_focus}
                </span>
              )}
              {data?.cefr_skill && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                  {data.cefr_skill}
                </span>
              )}
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#5C4FE5] border-t-transparent rounded-full mx-auto"></div>
        <p className="text-gray-600 mt-4">Memuat daftar materi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchMaterials}
          className="mt-4 px-4 py-2 bg-[#5C4FE5] text-white rounded-lg hover:bg-[#4a3ec7]"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          {getCategoryIcon()}
        </div>
        <p className="text-gray-600 font-medium">Belum ada materi {getCategoryLabel()}</p>
        <p className="text-sm text-gray-500 mt-1">Klik tombol "Tambah Materi" untuk membuat materi baru</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Daftar Materi {getCategoryLabel()} ({materials.length})
        </h3>
      </div>

      <div className="space-y-3">
        {materials.map((material) => (
          <div
            key={material.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getCategoryIcon()}
                  <h4 className="font-medium text-gray-900">{material.title}</h4>
                  {!material.is_published && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                      Draft
                    </span>
                  )}
                  {material.is_published && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                      Published
                    </span>
                  )}
                </div>

                {getContentPreview(material)}

                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span>Order: #{material.order_number}</span>
                  <span>•</span>
                  <span>{new Date(material.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                {onEdit && (
                  <button
                    onClick={() => onEdit(material)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={18} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(material.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Hapus"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
