'use client';

interface ProgressDisplayProps {
  isGenerating: boolean;
  progress: number;
  stage: string;
  message: string;
  error: string | null;
}

export default function ProgressDisplay({
  isGenerating,
  progress,
  stage,
  message,
  error,
}: ProgressDisplayProps) {
  if (!isGenerating && !error) {
    return null;
  }

  const getStageIcon = () => {
    switch (stage) {
      case 'initializing':
        return '🔄';
      case 'generating':
        return '🎼';
      case 'processing':
        return '⚙️';
      case 'complete':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStageColor = () => {
    if (error) return 'bg-red-50 border-red-200';
    if (stage === 'complete') return 'bg-green-50 border-green-200';
    return 'bg-blue-50 border-blue-200';
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${getStageColor()} transition-all`}>
      {/* Stage Indicator */}
      <div className="flex items-center space-x-3 mb-4">
        <span className="text-3xl">{getStageIcon()}</span>
        <div className="flex-1">
          <h3 className="font-bold text-lg capitalize">{stage.replace('_', ' ')}</h3>
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {isGenerating && !error && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-right text-sm font-medium text-gray-700">
            {progress}%
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-red-800 font-medium">Error: {error}</p>
        </div>
      )}

      {/* Loading Animation */}
      {isGenerating && (
        <div className="mt-4 flex justify-center">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}
