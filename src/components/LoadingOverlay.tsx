// src/components/LoadingOverlay.tsx
"use client";

interface LoadingOverlayProps {
  isLoading?: boolean;
  message?: string;
  subMessage?: string;
  onCancel?: () => void;
}

export default function LoadingOverlay({
  isLoading = true,
  message = "Loading Workout",
  subMessage = "Syncing local database...",
  onCancel,
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black select-none px-6">
      {/* Lifter Squat Animation Canvas */}
      <div className="w-20 h-20 flex items-center justify-center">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full stroke-white fill-none stroke-[4] [stroke-linecap:round] [stroke-linejoin:round]"
        >
          {/* Barbell weights */}
          <line x1="20" y1="28" x2="80" y2="28" className="animate-bounce" />
          <line
            x1="20"
            y1="20"
            x2="20"
            y2="36"
            className="stroke-[6] animate-bounce"
          />
          <line
            x1="80"
            y1="20"
            x2="80"
            y2="36"
            className="stroke-[6] animate-bounce"
          />

          {/* Lifter Head */}
          <circle
            cx="50"
            cy="30"
            r="6"
            className="fill-white stroke-none animate-bounce"
          />

          {/* Torso */}
          <line x1="50" y1="36" x2="50" y2="58" className="animate-bounce" />

          {/* Arms holding barbell */}
          <path d="M 32 30 L 50 42 L 68 30" className="animate-bounce" />

          {/* Squatting legs */}
          <path d="M 50 58 L 35 68 L 30 84" />
          <path d="M 50 58 L 65 68 L 70 84" />

          {/* Ground Platform */}
          <line
            x1="15"
            y1="86"
            x2="85"
            y2="86"
            className="stroke-zinc-800 stroke-[2]"
          />
        </svg>
      </div>

      <div className="mt-4 flex flex-col items-center gap-1.5">
        <p className="text-xs font-semibold tracking-wider uppercase text-zinc-300">
          {message}
        </p>
        {subMessage && (
          <span className="text-[10px] text-zinc-600 font-mono">
            {subMessage}
          </span>
        )}
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-6 text-[11px] text-zinc-500 hover:text-zinc-300 underline transition-colors"
        >
          Cancel and return
        </button>
      )}
    </div>
  );
}