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

  const getStageLabel = () => {
    switch (stage) {
      case 'initializing': return 'Getting ready...';
      case 'generating': return 'Composing notes...';
      case 'processing': return 'Polishing your piece...';
      case 'complete': return 'All done!';
      case 'error': return 'Something went wrong';
      default: return 'Working on it...';
    }
  };

  const getBgStyle = () => {
    if (error) return 'bg-coral-50 border-coral-200';
    if (stage === 'complete') return 'bg-mint-50 border-mint-200';
    return 'bg-white/80 border-warm-200/60';
  };

  return (
    <div className={`rounded-2xl border p-6 ${getBgStyle()} backdrop-blur shadow-lg shadow-warm-100/50 transition-all`}>
      {/* Stage header */}
      <div className="flex items-center gap-3 mb-4">
        {/* Animated icon */}
        {isGenerating && !error && stage !== 'complete' && (
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-coral-400 to-warm-500 flex items-center justify-center shadow-lg shadow-coral-300/30">
            <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {stage === 'complete' && (
          <div className="w-10 h-10 rounded-2xl bg-mint-400 flex items-center justify-center shadow-lg shadow-mint-300/30">
            <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        {error && (
          <div className="w-10 h-10 rounded-2xl bg-coral-400 flex items-center justify-center shadow-lg shadow-coral-300/30">
            <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        )}

        <div className="flex-1">
          <h3 className="font-extrabold text-warm-600">{getStageLabel()}</h3>
          <p className="text-sm text-warm-400">{message}</p>
        </div>
      </div>

      {/* Progress bar */}
      {isGenerating && !error && (
        <div className="space-y-2">
          <div className="w-full bg-warm-200/50 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-coral-400 via-coral-500 to-warm-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-right text-xs font-bold text-warm-400">
            {progress}%
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-coral-100 border border-coral-200 rounded-xl">
          <p className="text-sm text-coral-600 font-medium">{error}</p>
        </div>
      )}

      {/* Bouncing dots */}
      {isGenerating && !error && (
        <div className="mt-4 flex justify-center gap-2.5">
          <div className="w-3 h-3 bg-coral-400 rounded-full anim-bounce-1" />
          <div className="w-3 h-3 bg-warm-400 rounded-full anim-bounce-2" />
          <div className="w-3 h-3 bg-coral-400 rounded-full anim-bounce-3" />
        </div>
      )}
    </div>
  );
}
