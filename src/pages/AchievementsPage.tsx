import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moduleKeys, moduleQueries } from '../api/module-queries';
import { modulesApi } from '../api/modules-api';
import {
  ErrorMessage,
  ErrorState,
  formatDate,
  Icon,
  LoadingState,
  ProgressBar,
} from '../components/ui';
import { PageHeader } from './GroupPages';

const statusLabel = {
  LOCKED: 'Bloqueado',
  IN_PROGRESS: 'En progreso',
  UNLOCKED: 'Obtenido',
} as const;
const levelLabel = { BRONZE: 'Bronce', SILVER: 'Plata', GOLD: 'Oro' } as const;

/** Catalogo con niveles y progreso calculados en el servidor a partir de actividad real. */
export function AchievementsPage() {
  const queryClient = useQueryClient();
  const achievements = useQuery(moduleQueries.achievements());
  const privacy = useQuery(moduleQueries.achievementPrivacy());
  const updatePrivacy = useMutation({
    mutationFn: (rankingVisible: boolean) => modulesApi.updateAchievementPrivacy(rankingVisible),
    onSuccess: (data) => queryClient.setQueryData(moduleKeys.achievementPrivacy, data),
  });
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
    <PageHeader eyebrow="Logros" title={`${unlocked} de ${achievements.data.length} en progreso`}>
      <section className="form-card glass-panel" aria-labelledby="ranking-privacy-title">
        <h2 id="ranking-privacy-title">Ranking amistoso</h2>
        <p className="muted small">
          En cada grupo puedes aparecer junto a tus insignias. Solo lo ven integrantes de ese grupo.
        </p>
        {privacy.isPending && <p aria-busy="true">Cargando privacidad…</p>}
        {privacy.isError && <ErrorMessage error={privacy.error} />}
        {privacy.data && (
          <label className="participant">
            <input
              type="checkbox"
              checked={privacy.data.rankingVisible}
              disabled={updatePrivacy.isPending}
              onChange={(event) => updatePrivacy.mutate(event.target.checked)}
            />
            <span>Mostrarme en los rankings de mis grupos</span>
          </label>
        )}
        {updatePrivacy.isError && <ErrorMessage error={updatePrivacy.error} />}
      </section>
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
              {achievement.currentLevel ? ` · ${levelLabel[achievement.currentLevel]}` : ''}
              {achievement.awardedAt
                ? ` · ${formatDate(achievement.awardedAt)}`
                : ` · ${achievement.progress}/${achievement.target}`}
            </small>
            {achievement.levels.length > 0 && (
              <div className="chip-list" aria-label={`Niveles de ${achievement.name}`}>
                {achievement.levels.map((level) => (
                  <span
                    key={level.level}
                    className={`status-chip ${level.achieved ? 'success' : 'pending'}`}
                  >
                    {levelLabel[level.level]} · {level.threshold}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </PageHeader>
  );
}
