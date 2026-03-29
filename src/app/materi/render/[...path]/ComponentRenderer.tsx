'use client'

import React, { useState, useMemo } from 'react'
import * as LucideIcons from 'lucide-react'

type Props = {
  jsxContent: string
}

export default function ComponentRenderer({ jsxContent }: Props) {
  // Parse JSX and extract component
  const Component = useMemo(() => {
    try {
      // Remove import statements (we'll provide dependencies globally)
      let code = jsxContent
        .replace(/import\s+.*?from\s+['"]react['"];?/g, '')
        .replace(/import\s+.*?from\s+['"]lucide-react['"];?/g, '')
        .replace(/export\s+default\s+/g, 'return ')

      // Wrap in function that has access to React and icons
      const componentFactory = new Function(
        'React',
        'useState',
        'BookOpen',
        'ChevronDown',
        'ChevronUp',
        'Globe',
        'AlertTriangle',
        code
      )

      // Execute with dependencies
      return componentFactory(
        React,
        useState,
        LucideIcons.BookOpen,
        LucideIcons.ChevronDown,
        LucideIcons.ChevronUp,
        LucideIcons.Globe,
        LucideIcons.AlertTriangle
      )
    } catch (error) {
      console.error('Component render error:', error)
      return null
    }
  }, [jsxContent])

  if (!Component) {
    return (
      <div className="min-h-screen bg-red-50 p-8 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">
            Gagal Memuat Komponen
          </h2>
          <p className="text-sm text-gray-600">
            Terjadi kesalahan saat memuat materi pembelajaran.
          </p>
        </div>
      </div>
    )
  }

  return <Component />
}
