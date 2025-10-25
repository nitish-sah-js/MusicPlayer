import { useState } from 'react'
import YouTubePlayer from './components/YouTubePlayer'
import LocalFilePlayer from './components/LocalFilePlayer'
import { useTheme } from './contexts/ThemeContext'
import { Moon, Sun } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState<'youtube' | 'local'>('youtube')
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 light:from-purple-50 light:via-pink-50 light:to-blue-50 transition-colors duration-300">
      {/* Header */}
      <header className="bg-black/30 dark:bg-black/30 light:bg-white/70 backdrop-blur-sm border-b border-white/10 dark:border-white/10 light:border-gray-200">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white dark:text-white light:text-gray-900 truncate">Music Speed Controller</h1>
            <p className="text-xs sm:text-sm text-gray-300 dark:text-gray-300 light:text-gray-600 mt-1 hidden sm:block">Practice with slowed down tracks</p>
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={toggleTheme}
              className="p-2 sm:p-3 rounded-full bg-white/10 dark:bg-white/10 light:bg-gray-200 hover:bg-white/20 dark:hover:bg-white/20 light:hover:bg-gray-300 transition-all"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
              ) : (
                <Moon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 md:mb-8">
          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
              activeTab === 'youtube'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white/10 dark:bg-white/10 light:bg-white/60 text-gray-300 dark:text-gray-300 light:text-gray-700 hover:bg-white/20 dark:hover:bg-white/20 light:hover:bg-white/80'
            }`}
          >
            <span className="hidden sm:inline">YouTube Player</span>
            <span className="sm:hidden">YouTube</span>
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
              activeTab === 'local'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white/10 dark:bg-white/10 light:bg-white/60 text-gray-300 dark:text-gray-300 light:text-gray-700 hover:bg-white/20 dark:hover:bg-white/20 light:hover:bg-white/80'
            }`}
          >
            Local Files
          </button>
        </div>

        {/* Player Area */}
        <div className="bg-white/5 dark:bg-white/5 light:bg-white/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border border-white/10 dark:border-white/10 light:border-gray-200">
          {activeTab === 'youtube' ? (
            <YouTubePlayer />
          ) : (
            <LocalFilePlayer />
          )}
        </div>
      </main>
    </div>
  )
}

export default App
