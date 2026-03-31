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
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; background: #F7F6FF; }
    #root { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 400px; }
    .loading { display: flex; align-items: center; justify-content: center; min-height: 400px; color: #5C4FE5; font-size: 18px; }
  </style>
</head>
<body>
  <div id="root"><div class="loading">Loading...</div></div>
  <script>
    // Wait for React libraries
    function waitForReact() {
      return new Promise((resolve) => {
        const check = () => {
          if (window.React && window.ReactDOM) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    }

    waitForReact().then(() => {
      try {
        const { useState, useEffect, useRef, useCallback, useMemo } = React;
        
        // Create stub icon components (simple divs)
        const IconStub = ({ name }) => React.createElement('span', { 
          style: { display: 'inline-block', width: '20px', height: '20px', marginRight: '4px' }
        }, '•');
        
        const BookOpen = (props) => React.createElement(IconStub, { name: 'book', ...props });
        const ChevronDown = (props) => React.createElement(IconStub, { name: 'down', ...props });
        const ChevronUp = (props) => React.createElement(IconStub, { name: 'up', ...props });
        const Globe = (props) => React.createElement(IconStub, { name: 'globe', ...props });
        const AlertTriangle = (props) => React.createElement(IconStub, { name: 'alert', ...props });
        const Check = (props) => React.createElement(IconStub, { name: 'check', ...props });
        const X = (props) => React.createElement(IconStub, { name: 'x', ...props });
        const Info = (props) => React.createElement(IconStub, { name: 'info', ...props });
        const ChevronRight = (props) => React.createElement(IconStub, { name: 'right', ...props });
        const ChevronLeft = (props) => React.createElement(IconStub, { name: 'left', ...props });

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

        const Component = ComponentFunction(
          React, useState, useEffect, useRef, useCallback, useMemo,
          BookOpen, ChevronDown, ChevronUp, Globe, AlertTriangle,
          Check, X, Info, ChevronRight, ChevronLeft
        );

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(Component));
      } catch (error) {
        console.error('Error:', error);
        document.getElementById('root').innerHTML = \`
          <div style="padding: 32px; text-align: center; color: #ef4444;">
            <h2>Component Error</h2>
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
