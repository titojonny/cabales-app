import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';

const LandingPage = lazy(() =>
  import('./pages/AuthPages').then(({ LandingPage }) => ({ default: LandingPage })),
);
const LoginPage = lazy(() =>
  import('./pages/AuthPages').then(({ LoginPage }) => ({ default: LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/AuthPages').then(({ RegisterPage }) => ({ default: RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/AuthPages').then(({ ForgotPasswordPage }) => ({ default: ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/AuthPages').then(({ ResetPasswordPage }) => ({ default: ResetPasswordPage })),
);
const VerifyEmailPage = lazy(() =>
  import('./pages/AuthPages').then(({ VerifyEmailPage }) => ({ default: VerifyEmailPage })),
);
const CreateExpensePage = lazy(() =>
  import('./pages/ExpensePages').then(({ CreateExpensePage }) => ({ default: CreateExpensePage })),
);
const ExpenseDetailPage = lazy(() =>
  import('./pages/ExpensePages').then(({ ExpenseDetailPage }) => ({ default: ExpenseDetailPage })),
);
const EventDetailPage = lazy(() =>
  import('./pages/EventDetailPage').then(({ EventDetailPage }) => ({ default: EventDetailPage })),
);
const EventEditPage = lazy(() =>
  import('./pages/EventEditPage').then(({ EventEditPage }) => ({ default: EventEditPage })),
);
const CreateEventPage = lazy(() =>
  import('./pages/GroupPages').then(({ CreateEventPage }) => ({ default: CreateEventPage })),
);
const CreateGroupPage = lazy(() =>
  import('./pages/GroupPages').then(({ CreateGroupPage }) => ({ default: CreateGroupPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/GroupPages').then(({ DashboardPage }) => ({ default: DashboardPage })),
);
const GroupDetailPage = lazy(() =>
  import('./pages/GroupPages').then(({ GroupDetailPage }) => ({ default: GroupDetailPage })),
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then(({ AccountPage }) => ({ default: AccountPage })),
);
const AchievementsPage = lazy(() =>
  import('./pages/AchievementsPage').then(({ AchievementsPage }) => ({
    default: AchievementsPage,
  })),
);
const BudgetsPage = lazy(() =>
  import('./pages/BudgetPages').then(({ BudgetsPage }) => ({ default: BudgetsPage })),
);
const CabudasPage = lazy(() =>
  import('./pages/CabudasPage').then(({ CabudasPage }) => ({ default: CabudasPage })),
);
const DocsPage = lazy(() =>
  import('./pages/DocsPage').then(({ DocsPage }) => ({ default: DocsPage })),
);
const SharedDocumentPage = lazy(() =>
  import('./pages/DocsPage').then(({ SharedDocumentPage }) => ({ default: SharedDocumentPage })),
);
const FundDetailPage = lazy(() =>
  import('./pages/FundPages').then(({ FundDetailPage }) => ({ default: FundDetailPage })),
);
const FundsPage = lazy(() =>
  import('./pages/FundPages').then(({ FundsPage }) => ({ default: FundsPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then(({ NotificationsPage }) => ({
    default: NotificationsPage,
  })),
);
const StatisticsPage = lazy(() =>
  import('./pages/StatisticsPage').then(({ StatisticsPage }) => ({ default: StatisticsPage })),
);
const AcceptInvitationPage = lazy(() =>
  import('./pages/InvitationPage').then(({ AcceptInvitationPage }) => ({
    default: AcceptInvitationPage,
  })),
);
const SettlementDetailPage = lazy(() =>
  import('./pages/SettlementPage').then(({ SettlementDetailPage }) => ({
    default: SettlementDetailPage,
  })),
);
const SettlementPage = lazy(() =>
  import('./pages/SettlementPage').then(({ SettlementPage }) => ({ default: SettlementPage })),
);
const PrivacyPage = lazy(() =>
  import('./pages/LegalPages').then(({ PrivacyPage }) => ({ default: PrivacyPage })),
);
const TermsPage = lazy(() =>
  import('./pages/LegalPages').then(({ TermsPage }) => ({ default: TermsPage })),
);

function RouteFallback() {
  return (
    <main className="status-panel" aria-live="polite" aria-busy="true">
      <h1>Cargando sección</h1>
      <p className="status-copy">Un momento…</p>
    </main>
  );
}

/** Declara rutas públicas, protección fail-secure y módulos del MVP en un solo mapa. */
export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/share/documents/:token" element={<SharedDocumentPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="groups" element={<DashboardPage />} />
            <Route path="groups/new" element={<CreateGroupPage />} />
            <Route path="groups/:groupId" element={<GroupDetailPage tab="summary" />} />
            <Route path="groups/:groupId/events" element={<GroupDetailPage tab="events" />} />
            <Route path="groups/:groupId/events/new" element={<CreateEventPage />} />
            <Route path="groups/:groupId/events/:eventId/edit" element={<EventEditPage />} />
            <Route path="groups/:groupId/events/:eventId" element={<EventDetailPage />} />
            <Route
              path="groups/:groupId/events/:eventId/expenses/new"
              element={<CreateExpensePage />}
            />
            <Route path="invitations/accept" element={<AcceptInvitationPage />} />
            <Route path="groups/:groupId/expenses/:expenseId" element={<ExpenseDetailPage />} />
            <Route path="groups/:groupId/settlements" element={<SettlementPage />} />
            <Route
              path="groups/:groupId/settlements/:settlementId"
              element={<SettlementDetailPage />}
            />
            <Route path="groups/:groupId/funds" element={<FundsPage />} />
            <Route path="groups/:groupId/funds/:fundId" element={<FundDetailPage />} />
            <Route path="groups/:groupId/budgets" element={<BudgetsPage />} />
            <Route path="cabudas" element={<CabudasPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="statistics" element={<StatisticsPage />} />
            <Route path="achievements" element={<AchievementsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="mas" element={<AccountPage />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
