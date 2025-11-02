import { useState } from 'react'
import YouTubePlayer from './components/YouTubePlayer'
import LocalFilePlayer from './components/LocalFilePlayer'

function App() {
  const [activeTab, setActiveTab] = useState<'youtube' | 'local'>('youtube')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 shadow-sm">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white truncate">Music Speed Controller</h1>
            <p className="text-xs sm:text-sm text-gray-300 mt-1 hidden sm:block">Practice with slowed down tracks</p>
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
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/50'
                : 'bg-white/10 text-gray-300 hover:bg-white/20 border border-transparent'
            }`}
          >
            <span className="hidden sm:inline">YouTube Player</span>
            <span className="sm:hidden">YouTube</span>
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
              activeTab === 'local'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/50'
                : 'bg-white/10 text-gray-300 hover:bg-white/20 border border-transparent'
            }`}
          >
            Local Files
          </button>
        </div>

        {/* Player Area */}
        <div className="bg-white/5 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border border-white/10 shadow-xl">
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
