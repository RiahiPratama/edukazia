'use client'

interface ComponentRendererProps {
  jsxCode: string
  title: string
}

export default function ComponentRenderer({ jsxCode, title }: ComponentRendererProps) {
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
    console.log('✅ Lucide loaded');
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; background: #F7F6FF; }
    #root { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 400px; }
    .status { padding: 24px; font-size: 14px; line-height: 1.8; }
    .status-item { margin: 8px 0; padding: 8px; background: #f3f4f6; border-radius: 6px; }
    .error { color: #ef4444; font-weight: bold; }
    .success { color: #10b981; font-weight: bold; }
  </style>
</head>
<body>
  <div id="root">
    <div class="status">
      <div class="status-item">📦 Loading React...</div>
      <div id="status"></div>
    </div>
  </div>
  <script>
    const status = document.getElementById('status');
    
    function log(msg, isError = false) {
      console.log(msg);
      const div = document.createElement('div');
      div.className = 'status-item ' + (isError ? 'error' : 'success');
      div.textContent = msg;
      status.appendChild(div);
    }

    function waitForLibraries() {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
          attempts++;
          
          if (window.React) log('✅ React loaded');
          if (window.ReactDOM) log('✅ ReactDOM loaded');
          if (window.LucideReact) log('✅ Lucide loaded');
          
          if (window.React && window.ReactDOM && window.LucideReact) {
            log('✅ All libraries loaded! Rendering component...');
            resolve();
          } else if (attempts > 100) {
            log('❌ Timeout waiting for libraries', true);
            reject(new Error('Library load timeout'));
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }

    waitForLibraries()
      .then(() => {
        log('🔧 Executing component code...');
        
        const { useState, useEffect, useRef, useCallback, useMemo } = React;
        const { 
          BookOpen, ChevronDown, ChevronUp, Globe, AlertTriangle, 
          Check, X, Info, ChevronRight, ChevronLeft
        } = window.LucideReact;

        const ComponentFunction = new Function(
          'React', 'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo',
          'BookOpen', 'ChevronDown', 'ChevronUp', 'Globe', 'AlertTriangle',
          'Check', 'X', 'Info', 'ChevronRight', 'ChevronLeft',
          \`
          ${escapedCode}
          
          if (typeof PronunciationGuideAE !== 'undefined') return PronunciationGuideAE;
          if (typeof App !== 'undefined') return App;
          if (typeof Component !== 'undefined') return Component;
          
          throw new Error('No component found');
          \`
        );

        log('🎨 Creating component instance...');
        const Component = ComponentFunction(
          React, useState, useEffect, useRef, useCallback, useMemo,
          BookOpen, ChevronDown, ChevronUp, Globe, AlertTriangle,
          Check, X, Info, ChevronRight, ChevronLeft
        );

        log('🚀 Rendering to DOM...');
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Component));
        
        log('✅ Component rendered successfully!');
      })
      .catch(error => {
        log('❌ ERROR: ' + error.message, true);
        log('Stack: ' + error.stack, true);
        document.getElementById('root').innerHTML = \`
          <div class="status">
            <div class="status-item error">
              <h2>❌ Component Render Error</h2>
              <p><strong>Message:</strong> \${error.message}</p>
              <pre style="margin-top: 16px; padding: 12px; background: #fee; border-radius: 6px; overflow-x: auto; font-size: 12px;">\${error.stack}</pre>
            </div>
          </div>
        \`;
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
