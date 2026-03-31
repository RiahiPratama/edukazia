'use client'

interface ComponentRendererProps {
  jsxCode: string
  title: string
}

export default function ComponentRenderer({ jsxCode, title }: ComponentRendererProps) {
  const escapedCode = jsxCode
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const htmlContent = `
<!DOCTYPE html>
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
        
        // Stub icon components
        const BookOpen = (props) => React.createElement('span', { className: 'inline-block w-5 h-5 mr-1' }, '📖');
        const ChevronDown = (props) => React.createElement('span', { className: 'inline-block w-5 h-5' }, '▼');
        const ChevronUp = (props) => React.createElement('span', { className: 'inline-block w-5 h-5' }, '▲');
        const Globe = (props) => React.createElement('span', { className: 'inline-block w-5 h-5 mr-1' }, '🌐');
        const AlertTriangle = (props) => React.createElement('span', { className: 'inline-block w-5 h-5 mr-1' }, '⚠️');
        const Check = (props) => React.createElement('span', { className: 'inline-block w-5 h-5' }, '✓');
        const X = (props) => React.createElement('span', { className: 'inline-block w-5 h-5' }, '✕');
        const Info = (props) => React.createElement('span', { className: 'inline-block w-5 h-5 mr-1' }, 'ℹ️');
        const ChevronRight = (props) => React.createElement('span', { className: 'inline-block w-5 h-5' }, '▶');
        const ChevronLeft = (props) => React.createElement('span', { className: 'inline-block w-5 h-5' }, '◀');

        // JSX code with icon imports replaced
        const code = \`
          const { useState, useEffect, useRef, useCallback, useMemo } = React;
          const BookOpen = (props) => React.createElement('span', { className: 'inline-block w-5 h-5 mr-1' }, '📖');
          const ChevronDown = (props) => React.createElement('span', { className: 'inline-block w-5 h-5' }, '▼');
          const ChevronUp = (props) => React.createElement('span', { className: 'inline-block w-5 h-5' }, '▲');
          const Globe = (props) => React.createElement('span', { className: 'inline-block w-5 h-5 mr-1' }, '🌐');
          const AlertTriangle = (props) => React.createElement('span', { className: 'inline-block w-5 h-5 mr-1' }, '⚠️');
          
          \${escapedCode}
          
          // Export component
          if (typeof PronunciationGuideAE !== 'undefined') window.__Component = PronunciationGuideAE;
          else if (typeof App !== 'undefined') window.__Component = App;
          else if (typeof Component !== 'undefined') window.__Component = Component;
        \`;

        // Transpile JSX to JavaScript
        const transformed = Babel.transform(code, {
          presets: ['react']
        }).code;

        // Execute transformed code
        eval(transformed);

        // Render component
        if (window.__Component) {
          const root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(window.__Component));
        } else {
          throw new Error('Component not found');
        }
      } catch (error) {
        console.error('Error:', error);
        document.getElementById('root').innerHTML = \`
          <div style="padding: 32px; text-align: center; color: #ef4444;">
            <h2>Component Error</h2>
            <p>\${error.message}</p>
            <pre style="margin-top: 16px; padding: 12px; background: #fee; border-radius: 6px; overflow: auto; font-size: 12px; text-align: left;">\${error.stack}</pre>
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
