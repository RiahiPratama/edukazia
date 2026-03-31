'use client'

interface ComponentRendererProps {
  jsxCode: string
  title: string
}

export default function ComponentRenderer({ jsxCode, title }: ComponentRendererProps) {
  // Escape for safe embedding in HTML
  const escapedCode = jsxCode
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/</g, '\\x3C')
    .replace(/>/g, '\\x3E');

  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.23.5/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; background: #F7F6FF; }
    #root { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 400px; }
    .loading { display: flex; align-items: center; justify-content: center; min-height: 400px; color: #5C4FE5; font-size: 18px; }
  </style>
</head>
<body>
  <div id="root"><div class="loading">Loading component...</div></div>
  <script>
    window.COMPONENT_CODE = \`${escapedCode}\`;
  </script>
  <script>
    function waitForLibraries() {
      return new Promise((resolve) => {
        const check = () => {
          if (window.React && window.ReactDOM && window.Babel) {
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
        
        // Icon stub components with emojis
        const iconStubs = {
          BookOpen: '📖',
          ChevronDown: '▼',
          ChevronUp: '▲',
          Globe: '🌐',
          AlertTriangle: '⚠️',
          Check: '✓',
          X: '✕',
          Info: 'ℹ️',
          ChevronRight: '▶',
          ChevronLeft: '◀'
        };

        // Build code with icon definitions
        const iconDefs = Object.entries(iconStubs).map(([name, emoji]) => 
          "const " + name + " = (props) => React.createElement('span', { className: 'inline-block w-5 h-5 mx-1' }, '" + emoji + "');"
        ).join('\\n');

        const fullCode = 
          "const { useState, useEffect, useRef, useCallback, useMemo } = React;\\n" +
          iconDefs + "\\n" +
          window.COMPONENT_CODE + "\\n" +
          "if (typeof PronunciationGuideAE !== 'undefined') window.__Component = PronunciationGuideAE;\\n" +
          "else if (typeof App !== 'undefined') window.__Component = App;\\n" +
          "else if (typeof Component !== 'undefined') window.__Component = Component;";

        // Transpile JSX to JavaScript
        const transformed = Babel.transform(fullCode, {
          presets: ['react']
        }).code;

        // Execute transformed code
        eval(transformed);

        // Render component
        if (window.__Component) {
          const root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(window.__Component));
        } else {
          throw new Error('Component not found in code');
        }
      } catch (error) {
        console.error('Render error:', error);
        document.getElementById('root').innerHTML = 
          '<div style="padding: 32px; text-align: center; color: #ef4444;">' +
          '<h2>Component Error</h2>' +
          '<p>' + error.message + '</p>' +
          '<pre style="margin-top: 16px; padding: 12px; background: #fee; border-radius: 6px; overflow: auto; font-size: 12px; text-align: left; white-space: pre-wrap;">' + 
          (error.stack || '') + 
          '</pre></div>';
      }
    });
  </script>
</body>
</html>`;

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
