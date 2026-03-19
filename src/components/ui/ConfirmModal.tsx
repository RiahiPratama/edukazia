'use client'

import { Trash2, AlertTriangle, Archive, X } from 'lucide-react'

type ConfirmVariant = 'danger' | 'warning' | 'archive'

interface ConfirmModalProps {
  open:        boolean
  title:       string
  description: string
  confirmText?: string
  cancelText?:  string
  loading?:     boolean
  variant?:     ConfirmVariant
  note?:        string        // kotak info kuning opsional (misal: "Gunakan Jeda daripada hapus")
  onConfirm:   () => void
  onCancel:    () => void
}

const VARIANT_CONFIG: Record<ConfirmVariant, {
  iconBg:   string
  icon:     React.ReactNode
  btnCls:   string
}> = {
  danger: {
    iconBg: 'bg-red-100',
    icon:   <Trash2 size={22} className="text-red-500"/>,
    btnCls: 'bg-red-500 hover:bg-red-600 text-white',
  },
  warning: {
    iconBg: 'bg-amber-100',
    icon:   <AlertTriangle size={22} className="text-amber-500"/>,
    btnCls: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  archive: {
    iconBg: 'bg-[#EEEDFE]',
    icon:   <Archive size={22} className="text-[#5C4FE5]"/>,
    btnCls: 'bg-[#5C4FE5] hover:bg-[#3D34C4] text-white',
  },
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = 'Ya, Lanjutkan',
  cancelText  = 'Batal',
  loading     = false,
  variant     = 'danger',
  note,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  const cfg = VARIANT_CONFIG[variant]

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">

        {/* Icon */}
        <div className={`w-12 h-12 rounded-full ${cfg.iconBg} flex items-center justify-center mb-4`}>
          {cfg.icon}
        </div>

        {/* Title & description */}
        <h3 className="text-lg font-bold text-[#1A1640] mb-1">{title}</h3>
        <p className="text-sm text-[#7B78A8] mb-4">{description}</p>

        {/* Optional note box */}
        {note && (
          <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 mb-4">
            💡 {note}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-[#7B78A8] border border-[#E5E3FF] hover:bg-gray-50 transition disabled:opacity-60"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60 ${cfg.btnCls}`}
          >
            {loading ? 'Memproses...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
