import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage, LoginPage, RegisterPage } from './pages/AuthPages';
import { CreateExpensePage, ExpenseDetailPage } from './pages/ExpensePages';
import { EventDetailPage } from './pages/EventDetailPage';
import {
  CreateEventPage,
  CreateGroupPage,
  DashboardPage,
  GroupDetailPage,
} from './pages/GroupPages';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { AcceptInvitationPage } from './pages/InvitationPage';
import { SettlementDetailPage, SettlementPage } from './pages/SettlementPage';

/** Declara rutas públicas, protección fail-secure y módulos del MVP en un solo mapa. */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
          <Route path="cabudas" element={<PlaceholderPage module="cabudas" />} />
          <Route path="docs" element={<PlaceholderPage module="docs" />} />
          <Route path="statistics" element={<PlaceholderPage module="statistics" />} />
          <Route path="achievements" element={<PlaceholderPage module="achievements" />} />
          <Route path="mas" element={<PlaceholderPage module="more" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
