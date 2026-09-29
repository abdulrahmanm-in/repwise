// src/app/loading.tsx
import LoadingOverlay from "@/components/LoadingOverlay";

export default function Loading() {
  return (
    <LoadingOverlay
      isLoading={true}
      message="Loading Workout"
      subMessage="Syncing local database..."
    />
  );
}