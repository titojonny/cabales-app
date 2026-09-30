import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import {
  ForgotPasswordPage,
  LandingPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './pages/AuthPages';
import { CreateExpensePage, ExpenseDetailPage } from './pages/ExpensePages';
import { EventDetailPage } from './pages/EventDetailPage';
import {
  CreateEventPage,
  CreateGroupPage,
  DashboardPage,
  GroupDetailPage,
} from './pages/GroupPages';
import { AccountPage } from './pages/AccountPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { BudgetsPage } from './pages/BudgetPages';
import { CabudasPage } from './pages/CabudasPage';
import { DocsPage } from './pages/DocsPage';
import { FundDetailPage, FundsPage } from './pages/FundPages';
import { NotificationsPage } from './pages/NotificationsPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { AcceptInvitationPage } from './pages/InvitationPage';
import { SettlementDetailPage, SettlementPage } from './pages/SettlementPage';
import { PrivacyPage, TermsPage } from './pages/LegalPages';

/** Declara rutas públicas, protección fail-secure y módulos del MVP en un solo mapa. */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="groups" element={<DashboardPage />} />
          <Route path="groups/new" element={<CreateGroupPage />} />
          <Route path="groups/:groupId" element={<GroupDetailPage tab="summary" />} />
          <Route path="groups/:groupId/events" element={<GroupDetailPage tab="events" />} />
          <Route path="groups/:groupId/events/new" element={<CreateEventPage />} />
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
  );
}
