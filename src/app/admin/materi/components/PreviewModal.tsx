'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, Code, Eye, Save, Columns, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  materialId: string;
  materialTitle: string;
  storageBucket: string;
  storagePath: string;
  onClose: () => void;
};

export default function PreviewModal({ materialId, materialTitle, storageBucket, storagePath, onClose }: Props) {
  const [originalSource, setOriginalSource] = useState<string>('');
  const [editedSource, setEditedSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'source' | 'split'>('preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const splitIframeRef = useRef<HTMLIFrameElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = createClient();
  const hasChanges = editedSource !== originalSource;

  useEffect(() => {
    fetchSource();
  }, []);

  const fetchSource = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = supabase.storage.from(storageBucket).getPublicUrl(storagePath);
      const res = await fetch(data.publicUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setOriginalSource(text);
      setEditedSource(text);
    } catch (err) {
      setError(`Gagal memuat file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getPreviewHtml = (source: string) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js"><\/script>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; margin: 0; background: #fff; color: #1a1a1a; }
    .error-box { background: #FEE2E2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 16px; color: #991B1B; font-size: 14px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.onload = function() {
      var h = React.createElement;
      var useState = React.useState;
      var useEffect = React.useEffect;
      var useRef = React.useRef;
      var useMemo = React.useMemo;
      var useCallback = React.useCallback;
      var Fragment = React.Fragment;

      try {
        var componentSource = ${JSON.stringify(source)};

        var cleanSource = componentSource
          .replace(/^import\\s+.*?from\\s+['"].*?['"];?\\s*$/gm, '')
          .replace(/^import\\s+['"].*?['"];?\\s*$/gm, '')
          .replace(/^export\\s+default\\s+/gm, 'var __DefaultComponent__ = ')
          .replace(/^export\\s+/gm, 'var __export__ = ');

        if (cleanSource.indexOf('__DefaultComponent__') === -1) {
          var funcMatch = cleanSource.match(/(?:function|const|var|let)\\s+(\\w+)\\s*(?:=\\s*(?:\\(|function)|\\()/);
          if (funcMatch) {
            cleanSource += '\\nvar __DefaultComponent__ = ' + funcMatch[1] + ';';
          }
        }

        var transpiled = Babel.transform(cleanSource, {
          presets: ['react'],
          filename: 'component.jsx',
        }).code;

        var wrappedCode = transpiled + '\\nreturn __DefaultComponent__;';
        var factory = new Function('React', 'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'Fragment', 'createElement', wrappedCode);
        var Component = factory(React, useState, useEffect, useRef, useMemo, useCallback, Fragment, h);

        if (typeof Component === 'function') {
          ReactDOM.createRoot(document.getElementById('root')).render(h(Component));
        } else {
          document.getElementById('root').innerHTML = '<div class="error-box">Component tidak ditemukan.</div>';
        }
      } catch (err) {
        document.getElementById('root').innerHTML = '<div class="error-box"><strong>Render Error:</strong>\\n' + err.message + '</div>';
      }
    };
  <\/script>
</body>
</html>`;
  };

  // Render preview in iframe
  const renderPreview = useCallback((source: string, iframe: HTMLIFrameElement | null) => {
    if (!iframe || !source) return;
    const html = getPreviewHtml(source);
    const blob = new Blob([html], { type: 'text/html' });
    iframe.src = URL.createObjectURL(blob);
  }, []);

  // Update preview when source changes (debounced for split mode)
  useEffect(() => {
    if (!editedSource) return;

    if (viewMode === 'preview') {
      renderPreview(editedSource, iframeRef.current);
    } else if (viewMode === 'split') {
      // Debounce preview update saat typing
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        renderPreview(editedSource, splitIframeRef.current);
      }, 800);
    }
  }, [editedSource, viewMode, renderPreview]);

  // Save edited source back to storage
  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const file = new Blob([editedSource], { type: 'text/javascript' });

      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .update(storagePath, file, { upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      setOriginalSource(editedSource);
      alert('✅ File berhasil disimpan!');
    } catch (err) {
      alert(`❌ Gagal menyimpan: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!hasChanges) return;
    if (confirm('Reset semua perubahan?')) {
      setEditedSource(originalSource);
    }
  };

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges) handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasChanges, editedSource]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Eye className="w-5 h-5 text-[#5C4FE5] flex-shrink-0" />
            <span className="font-bold text-gray-900 truncate">{materialTitle}</span>
            <span className="text-xs text-gray-400 font-mono flex-shrink-0">{storagePath.split('/').pop()}</span>
            {hasChanges && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded flex-shrink-0">Belum disimpan</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View mode toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${viewMode === 'preview' ? 'bg-white text-[#5C4FE5] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${viewMode === 'split' ? 'bg-white text-[#5C4FE5] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Columns className="w-3.5 h-3.5" /> Split
              </button>
              <button onClick={() => setViewMode('source')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${viewMode === 'source' ? 'bg-white text-[#5C4FE5] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Code className="w-3.5 h-3.5" /> Source
              </button>
            </div>

            {/* Save & Reset */}
            {hasChanges && (
              <>
                <button onClick={handleReset} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Reset perubahan">
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Menyimpan...' : 'Simpan (Ctrl+S)'}
                </button>
              </>
            )}

            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors ml-1">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Memuat file...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full px-8">
              <div className="text-center">
                <p className="text-red-600 font-semibold mb-2">{error}</p>
                <button onClick={fetchSource} className="px-4 py-2 bg-[#5C4FE5] text-white rounded-lg text-sm">Coba Lagi</button>
              </div>
            </div>
          ) : viewMode === 'preview' ? (
            /* Full preview */
            <iframe ref={iframeRef} className="w-full h-full border-0" sandbox="allow-scripts" title="Preview" />
          ) : viewMode === 'source' ? (
            /* Full source editor */
            <textarea
              value={editedSource}
              onChange={(e) => setEditedSource(e.target.value)}
              className="w-full h-full p-6 bg-gray-900 text-green-400 text-sm font-mono leading-relaxed resize-none border-0 outline-none"
              spellCheck={false}
            />
          ) : (
            /* Split view: source left, preview right */
            <div className="flex h-full">
              <div className="w-1/2 border-r border-gray-300 flex flex-col">
                <div className="px-3 py-1.5 bg-gray-800 text-gray-400 text-xs font-semibold border-b border-gray-700 flex items-center justify-between">
                  <span>Source (editable)</span>
                  <span className="text-gray-500">{editedSource.split('\n').length} baris</span>
                </div>
                <textarea
                  value={editedSource}
                  onChange={(e) => setEditedSource(e.target.value)}
                  className="flex-1 p-4 bg-gray-900 text-green-400 text-xs font-mono leading-relaxed resize-none border-0 outline-none"
                  spellCheck={false}
                />
              </div>
              <div className="w-1/2 flex flex-col">
                <div className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-semibold border-b border-gray-200 flex items-center justify-between">
                  <span>Preview (auto-refresh 0.8s)</span>
                  {hasChanges && <span className="text-yellow-600">ada perubahan</span>}
                </div>
                <iframe ref={splitIframeRef} className="flex-1 border-0" sandbox="allow-scripts" title="Split Preview" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
