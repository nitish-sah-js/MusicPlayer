import { X, Keyboard } from 'lucide-react'

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

export default function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null

  const shortcuts = [
    { key: 'Space', action: 'Play / Pause' },
    { key: '← →', action: 'Seek backward / forward 5s' },
    { key: '↑ ↓', action: 'Increase / decrease speed by 0.25x' },
    { key: '1-8', action: 'Set speed preset (0.25x - 2x)' },
    { key: 'A', action: 'Set loop start point' },
    { key: 'B', action: 'Set loop end point' },
    { key: 'C', action: 'Clear loop' },
    { key: '?', action: 'Show this help' },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-gray-900 to-purple-900 border border-purple-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-purple-600/20 rounded-lg">
              <Keyboard className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-white">
              <span className="hidden sm:inline">Keyboard Shortcuts</span>
              <span className="sm:hidden">Shortcuts</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="space-y-1.5 sm:space-y-2">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 sm:py-3 px-3 sm:px-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors gap-3"
            >
              <span className="text-gray-300 text-sm sm:text-base flex-1">{shortcut.action}</span>
              <kbd className="px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-800 border border-gray-700 rounded-md text-xs sm:text-sm font-mono text-purple-400 flex-shrink-0">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-white/10">
          <p className="text-xs text-gray-400 text-center">
            Press <kbd className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-800 border border-gray-700 rounded text-purple-400 text-xs">?</kbd> anytime to toggle this help
          </p>
        </div>
      </div>
    </div>
  )
}
