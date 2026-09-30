import { useQuery } from '@tanstack/react-query';
import { moduleQueries } from '../api/module-queries';
import { ErrorState, formatDate, Icon, LoadingState, ProgressBar } from '../components/ui';
import { PageHeader } from './GroupPages';

const statusLabel = {
  LOCKED: 'Bloqueado',
  IN_PROGRESS: 'En progreso',
  UNLOCKED: 'Obtenido',
} as const;

/** Logros con reglas y progreso visibles; se calculan en servidor con datos reales. */
export function AchievementsPage() {
  const achievements = useQuery(moduleQueries.achievements());
  if (achievements.isPending) return <LoadingState title="Cargando logros" />;
  if (achievements.isError)
    return (
      <ErrorState
        title="No pudimos cargar los logros"
        error={achievements.error}
        onRetry={() => void achievements.refetch()}
      />
    );
  const unlocked = achievements.data.filter((item) => item.status === 'UNLOCKED').length;
  return (
    <PageHeader eyebrow="Logros" title={`${unlocked} de ${achievements.data.length} obtenidos`}>
      <ul className="achievement-grid">
        {achievements.data.map((achievement) => (
          <li
            key={achievement.code}
            className={`glass-panel achievement ${achievement.status.toLowerCase()}`}
          >
            <span className="achievement-icon" aria-hidden="true">
              <Icon name="trophy" />
            </span>
            <h2>{achievement.name}</h2>
            <p>{achievement.description}</p>
            <ProgressBar
              value={(achievement.progress / Math.max(1, achievement.target)) * 100}
              label={`${achievement.name}: ${achievement.progress} de ${achievement.target}`}
            />
            <small>
              {statusLabel[achievement.status]}
              {achievement.awardedAt
                ? ` · ${formatDate(achievement.awardedAt)}`
                : ` · ${achievement.progress}/${achievement.target}`}
            </small>
          </li>
        ))}
      </ul>
    </PageHeader>
  );
}
