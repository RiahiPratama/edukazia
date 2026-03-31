'use client'

interface ComponentRendererProps {
  jsxCode: string
  title: string
}

export default function ComponentRenderer({ jsxCode, title }: ComponentRendererProps) {
  // Escape JSX code for safe embedding
  const escapedCode = jsxCode
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/</g, '\\x3C')
    .replace(/>/g, '\\x3E');

  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script type="module">
    import * as LucideReact from 'https://cdn.jsdelivr.net/npm/lucide-react@0.263.1/dist/esm/lucide-react.js';
    window.LucideReact = LucideReact;
    window.lucideLoaded = true;
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      margin: 0; 
      padding: 20px; 
      font-family: system-ui, sans-serif; 
      background: #F7F6FF; 
      min-height: 100vh;
    }
    #root { 
      max-width: 1200px; 
      margin: 0 auto; 
      background: white; 
      border-radius: 12px; 
      padding: 24px; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
      min-height: 400px; 
    }
    .loading { 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      min-height: 400px; 
      color: #5C4FE5; 
      font-size: 18px; 
      font-weight: 500; 
    }
    .error { padding: 32px; text-align: center; color: #ef4444; }
  </style>
</head>
<body>
  <div id="root"><div class="loading">Loading component...</div></div>
  <script>
    function waitForLibraries() {
      return new Promise((resolve) => {
        const check = () => {
          if (window.React && window.ReactDOM && window.LucideReact) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    }

    waitForLibraries().then(() => {
      try {
        const { useState, useEffect, useRef, useCallback, useMemo } = React;
        const { 
          BookOpen, ChevronDown, ChevronUp, Globe, AlertTriangle, 
          Check, X, Info, ChevronRight, ChevronLeft,
          Home, User, Calendar, FileText, Settings, LogOut,
          Search, Filter, Plus, Minus, Edit, Trash2, Save,
          Download, Upload, Share2, Copy, ExternalLink
        } = window.LucideReact;

        const ComponentFunction = new Function(
          'React', 'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo',
          'BookOpen', 'ChevronDown', 'ChevronUp', 'Globe', 'AlertTriangle',
          'Check', 'X', 'Info', 'ChevronRight', 'ChevronLeft',
          'Home', 'User', 'Calendar', 'FileText', 'Settings', 'LogOut',
          'Search', 'Filter', 'Plus', 'Minus', 'Edit', 'Trash2', 'Save',
          'Download', 'Upload', 'Share2', 'Copy', 'ExternalLink',
          \`
          ${escapedCode}
          
          if (typeof PronunciationGuideAE !== 'undefined') return PronunciationGuideAE;
          if (typeof App !== 'undefined') return App;
          if (typeof Component !== 'undefined') return Component;
          
          const keys = Object.keys(this).filter(k => typeof this[k] === 'function');
          if (keys.length > 0) return this[keys[keys.length - 1]];
          
          throw new Error('No component found');
          \`
        );

        const Component = ComponentFunction(
          React, useState, useEffect, useRef, useCallback, useMemo,
          BookOpen, ChevronDown, ChevronUp, Globe, AlertTriangle,
          Check, X, Info, ChevronRight, ChevronLeft,
          Home, User, Calendar, FileText, Settings, LogOut,
          Search, Filter, Plus, Minus, Edit, Trash2, Save,
          Download, Upload, Share2, Copy, ExternalLink
        );

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Component));
      } catch (error) {
        console.error('Error:', error);
        document.getElementById('root').innerHTML = \`
          <div class="error">
            <h2>Error Loading Component</h2>
            <p>\${error.message}</p>
          </div>
        \`;
      }
    });
  </script>
</body>
</html>
`;

  return (
    <div className="min-h-screen bg-white">
      <iframe
        srcDoc={htmlContent}
        className="w-full h-screen border-0"
        title={title}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}
