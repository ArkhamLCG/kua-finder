import { formatBytes, loadPhaseLabel } from "../lib/progress";
import type { LoadProgress } from "../lib/progress";

type Props = {
  progress: LoadProgress | null;
};

export function CatalogLoader({ progress }: Props) {
  const ratio = progress?.ratio ?? null;
  const percent =
    ratio != null ? Math.min(100, Math.max(0, Math.round(ratio * 100))) : null;
  const label = progress ? loadPhaseLabel(progress.phase) : "Загрузка каталога";
  const sizeLabel =
    progress && progress.loadedBytes > 0
      ? progress.totalBytes != null
        ? `${formatBytes(progress.loadedBytes)} / ${formatBytes(progress.totalBytes)}`
        : formatBytes(progress.loadedBytes)
      : null;

  return (
    <div className="loader" role="status" aria-live="polite" aria-busy="true">
      <div className="loader__panel">
        <p className="loader__brand">Поиск сыщиков</p>
        <div className="loader__spinner" aria-hidden />
        <p className="loader__title">{label}</p>
        <p className="loader__hint">
          Каталог большой — обычно занимает несколько секунд
        </p>
        <div
          className={`loader__track${percent == null ? " loader__track--pulse" : ""}`}
        >
          <div
            className="loader__bar"
            style={percent != null ? { width: `${percent}%` } : undefined}
          />
        </div>
        <p className="loader__meta">
          {percent != null ? `${percent}%` : "считаем размер…"}
          {sizeLabel ? ` · ${sizeLabel}` : ""}
        </p>
      </div>
    </div>
  );
}
