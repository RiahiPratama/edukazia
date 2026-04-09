'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, ExternalLink, Code, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  materialId: string;
  materialTitle: string;
  storageBucket: string;
  storagePath: string;
  onClose: () => void;
};

export default function PreviewModal({ materialId, materialTitle, storageBucket, storagePath, onClose }: Props) {
  const [jsxSource, setJsxSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const supabase = createClient();

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
      setJsxSource(text);
    } catch (err) {
      setError(`Gagal memuat file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Build preview HTML that uses Babel standalone to transpile + render JSX
  const getPreviewHtml = (source: string) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js"></script>
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
      const { useState, useEffect, useRef, useMemo, useCallback, Fragment, createElement } = React;

      try {
        var componentSource = ${JSON.stringify(source)};

        // Remove import/export statements for browser compatibility
        var cleanSource = componentSource
          .replace(/^import\\s+.*?from\\s+['"].*?['"];?\\s*$/gm, '')
          .replace(/^import\\s+['"].*?['"];?\\s*$/gm, '')
          .replace(/^export\\s+default\\s+/gm, 'var __DefaultComponent__ = ')
          .replace(/^export\\s+/gm, 'var __export__ = ');

        // If no default component found, try to detect component name
        if (cleanSource.indexOf('__DefaultComponent__') === -1) {
          var funcMatch = cleanSource.match(/(?:function|const|var|let)\\s+(\\w+)\\s*(?:=\\s*(?:\\(|function)|\\()/);
          if (funcMatch) {
            cleanSource += '\\nvar __DefaultComponent__ = ' + funcMatch[1] + ';';
          }
        }

        cleanSource += '\\nreturn __DefaultComponent__;';

        // Transpile JSX → JS using Babel
        var transpiled = Babel.transform(cleanSource, {
          presets: ['react'],
          filename: 'component.jsx',
        }).code;

        // Execute transpiled code
        var factory = new Function('React', 'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'Fragment', 'createElement', transpiled);
        var Component = factory(React, useState, useEffect, useRef, useMemo, useCallback, Fragment, createElement);

        if (typeof Component === 'function') {
          ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));
        } else {
          document.getElementById('root').innerHTML = '<div class="error-box">Component tidak ditemukan. File mungkin bukan React component.</div>';
        }
      } catch (err) {
        document.getElementById('root').innerHTML = '<div class="error-box"><strong>Render Error:</strong>\\n' + err.message + '</div>';
      }
    };
  </script>
</body>
</html>`;
  };

  useEffect(() => {
    if (jsxSource && viewMode === 'preview' && iframeRef.current) {
      const html = getPreviewHtml(jsxSource);
      const blob = new Blob([html], { type: 'text/html' });
      iframeRef.current.src = URL.createObjectURL(blob);
    }
  }, [jsxSource, viewMode]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-4xl h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-[#5C4FE5]" />
            <span className="font-bold text-gray-900">{materialTitle}</span>
            <span className="text-xs text-gray-400 font-mono">{storagePath.split('/').pop()}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === 'preview' ? 'bg-white text-[#5C4FE5] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button
                onClick={() => setViewMode('source')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === 'source' ? 'bg-white text-[#5C4FE5] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Code className="w-3.5 h-3.5" /> Source
              </button>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              Memuat preview...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full px-8">
              <div className="text-center">
                <p className="text-red-600 font-semibold mb-2">{error}</p>
                <button onClick={fetchSource} className="px-4 py-2 bg-[#5C4FE5] text-white rounded-lg text-sm">Coba Lagi</button>
              </div>
            </div>
          ) : viewMode === 'preview' ? (
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              sandbox="allow-scripts"
              title="Preview"
            />
          ) : (
            <pre className="w-full h-full overflow-auto p-6 bg-gray-900 text-green-400 text-sm font-mono leading-relaxed whitespace-pre-wrap">
              {jsxSource}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
