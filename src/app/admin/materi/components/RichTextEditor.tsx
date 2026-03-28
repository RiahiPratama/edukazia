'use client';

import { useState } from 'react';
import { 
  Bold, Italic, Underline, List, ListOrdered,
  Table, Type, Highlighter
} from 'lucide-react';

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  // Simple HTML formatting (akan di-upgrade ke Lexical nanti)
  const insertHTML = (htmlTag: string) => {
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    let newText = '';
    switch (htmlTag) {
      case 'bold':
        newText = `<strong>${selectedText || 'bold text'}</strong>`;
        break;
      case 'italic':
        newText = `<em>${selectedText || 'italic text'}</em>`;
        break;
      case 'underline':
        newText = `<u>${selectedText || 'underlined text'}</u>`;
        break;
      case 'table':
        newText = `
<table style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr>
      <th style="border: 1px solid #ddd; padding: 8px;">Header 1</th>
      <th style="border: 1px solid #ddd; padding: 8px;">Header 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #ddd; padding: 8px;">Cell 1</td>
      <td style="border: 1px solid #ddd; padding: 8px;">Cell 2</td>
    </tr>
  </tbody>
</table>`;
        break;
      case 'list':
        newText = `<ul><li>Item 1</li><li>Item 2</li></ul>`;
        break;
      default:
        return;
    }

    const newValue = value.substring(0, start) + newText + value.substring(end);
    onChange(newValue);
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-gray-50 border-b border-gray-300 flex-wrap">
        <button
          type="button"
          onClick={() => insertHTML('bold')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Bold"
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={() => insertHTML('italic')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Italic"
        >
          <Italic size={18} />
        </button>
        <button
          type="button"
          onClick={() => insertHTML('underline')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Underline"
        >
          <Underline size={18} />
        </button>
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <button
          type="button"
          onClick={() => insertHTML('table')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Insert Table"
        >
          <Table size={18} />
        </button>
        <button
          type="button"
          onClick={() => insertHTML('list')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Insert List"
        >
          <List size={18} />
        </button>
      </div>

      {/* Editor */}
      <textarea
        id="content-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Masukkan text content...'}
        className="w-full p-4 min-h-[300px] resize-none focus:outline-none font-mono text-sm"
      />

      {/* Preview Hint */}
      <div className="p-2 bg-gray-50 border-t border-gray-300 text-xs text-gray-600">
        💡 Tip: HTML akan di-render otomatis untuk siswa. Gunakan toolbar untuk formatting.
      </div>
    </div>
  );
}
