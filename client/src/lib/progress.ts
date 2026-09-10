export type LoadPhase = "download" | "parse" | "prepare";

export type LoadProgress = {
  phase: LoadPhase;
  /** 0..1 overall progress; null when unknown */
  ratio: number | null;
  loadedBytes: number;
  totalBytes: number | null;
};

const PHASE_LABELS: Record<LoadPhase, string> = {
  download: "Загрузка каталога",
  parse: "Разбор данных",
  prepare: "Подготовка списка",
};

export function loadPhaseLabel(phase: LoadPhase): string {
  return PHASE_LABELS[phase];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
