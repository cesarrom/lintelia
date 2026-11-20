import { createBrowserRouter } from "react-router";
import { AppLayout } from "./modules/private/layout";
import { OnboardingLayout } from "./modules/private/onboarding/layout";

import { lazy } from 'react';
import BaseLayout from "./modules/BaseLayout";
import { PortalLayout } from "./modules/portal/PortalLayout";
import NotFoundPage from "./modules/public/NotFoundPage";

const TablePage = lazy(() => import("./modules/private/database/TablePage"));
const LandingPage = lazy(() => import("./modules/public/landing/page"));
const LoginPage = lazy(() => import("./modules/public/auth/pages/login/page"));
const SignOnPage = lazy(() => import("./modules/public/auth/pages/sign-on/page"));
const SignOutPage = lazy(() => import("./modules/public/auth/pages/sign-out/page"));
const OnboardingPage = lazy(() => import("./modules/private/onboarding/OnboardingPage"));
const DashboardPage = lazy(() => import("./modules/private/dashboard/DashboardPage"));
const FormsPage = lazy(() => import("./modules/private/forms/FormsPage"));
const FormInstancesPage = lazy(() => import("./modules/private/forms/FormInstancesPage"));
const FormAnswersPage = lazy(() => import("./modules/private/forms/FormInstancePage"));
const NewAnswerPage = lazy(() => import("./modules/private/forms/NewAnswerPage"));
const UsersPage = lazy(() => import("./modules/private/users/UsersPage"));
const SettingsPage = lazy(() => import("./modules/private/settings/SettingsPage"));
const RolesPage = lazy(() => import("./modules/private/roles/RolesPage"));
const RolePage = lazy(() => import("./modules/private/roles/RolePage"));
const WhoPage = lazy(() => import("./modules/private/roles/RolePage").then((m) => ({ default: m.WhoPage })));
const AccessChangesPage = lazy(() => import("./modules/private/access/AccessChangesPage"));
const BackOfficePageRoute = lazy(() => import("@/back-office/pages").then((m) => ({ default: m.BackOfficePageRoute })));
const ProfilePage = lazy(() => import("./modules/private/profile/ProfilePage"));
const KeysPage = lazy(() => import("./modules/private/keys/KeysPage"));
const TablesPage = lazy(() => import("./modules/private/database/TablesPage"));
const WebhooksPage = lazy(() => import("./modules/private/api/WebhooksPage"));
const LogsPage = lazy(() => import("./modules/private/logs/LogsPage"));
const WorkflowsPage = lazy(() => import("./modules/private/workflows/WorkflowsPage"));
const ExistingWorkflowPage = lazy(() => import("./modules/private/workflows/WorkflowByIdPage"));
const NewWorkflowPage = lazy(() => import("./modules/private/workflows/NewWorkflowPage"));
const EmailTemplatesPage = lazy(() => import("./modules/private/emails/EmailTemplatesPage"));
const DocumentsPage = lazy(() => import("./modules/private/documents/DocumentsPage"));
const TasksPage = lazy(() => import("./modules/private/tasks/TasksPage"));
const TaskPage = lazy(() => import("./modules/private/tasks/TaskPage"));
const CasesPage = lazy(() => import("./modules/private/cases/CasesPage"));
const CasePage = lazy(() => import("./modules/private/cases/CasePage"));
const ClientsPage = lazy(() => import("./modules/private/clients/ClientsPage"));
const ClientPage = lazy(() => import("./modules/private/clients/ClientPage"));
const AuditPage = lazy(() => import("./modules/private/audit/AuditPage"));
const InstitutionsPage = lazy(() => import("./modules/private/platform/InstitutionsPage"));
const PortalCasePage = lazy(() => import("./modules/portal/PortalCasePage"));
const PortalRequestsPage = lazy(() => import("./modules/portal/PortalRequestsPage"));
const JoinPage = lazy(() => import("./modules/portal/JoinPage"));
const PortalPrivacyPage = lazy(() => import("./modules/portal/PortalPrivacyPage"));
const PortalIndex = lazy(() => import("./modules/portal/PortalIndex"));
const ClientAppPageRoute = lazy(() => import("@/client-app/pages").then((m) => ({ default: m.ClientAppPageRoute })));
const StudioPage = lazy(() => import("./modules/private/experience/StudioPage"));
const BackOfficeStudioPage = lazy(() => import("./modules/private/experience/back-office/BackOfficeStudioPage"));
const MapPage = lazy(() => import("./modules/private/map/MapPage"));
const StudioPreviewFrame = lazy(() => import("@/client-app/preview"));
const EmbedAppFrame = lazy(() => import("@/client-app/embed"));
const ClientJourneyRoute = lazy(() => import("@/client-app/pages").then((m) => ({ default: m.ClientJourneyRoute })));
const ClientStartJourneyRoute = lazy(() => import("@/client-app/pages").then((m) => ({ default: m.ClientStartJourneyRoute })));
const DataRequestsPage = lazy(() => import("./modules/private/data-requests/DataRequestsPage"));
const StaffPage = lazy(() => import("./modules/private/platform/StaffPage"));
const PlatformAuditPage = lazy(() => import("./modules/private/platform/PlatformAuditPage"));
const SupportAccessRequestsPage = lazy(() => import("./modules/private/platform/SupportAccessRequestsPage"));
const SupportAccessPage = lazy(() => import("./modules/private/support-access/SupportAccessPage"));
const IntegrationsPage = lazy(() => import("./modules/private/integrations/IntegrationsPage"));
const ConnectorsPage = lazy(() => import("./modules/private/platform/ConnectorsPage"));
const EmbedFormPage = lazy(() => import("./modules/public/embed/EmbedFormPage"));
const ResetPasswordPage = lazy(() => import("./modules/public/auth/pages/reset-password/page"));

export const router = createBrowserRouter([
  {
    path: "/",
    Component: BaseLayout,
    ErrorBoundary: NotFoundPage,
    children: [
      {
        index: true,
        path: "",
        Component: LandingPage,
      },
      {
        path: 'login',
        Component: LoginPage
      },
      {
        path: 'sign-on',
        Component: SignOnPage
      },
      {
        path: 'sign-out',
        Component: SignOutPage
      },
      {
        path: 'reset-password',
        Component: ResetPasswordPage
      },
      {
        path: 'embed/forms/:publicKey',
        Component: EmbedFormPage
      },
      // The client app embedded in the institution's site or mobile app (@lintelia/client-sdk).
      {
        path: 'embed/app',
        Component: EmbedAppFrame,
        children: [
          { index: true, Component: ClientAppPageRoute },
          { path: 'p/:page', Component: ClientAppPageRoute },
          { path: 'journeys/:caseId', Component: ClientJourneyRoute },
          { path: 'start/:journey', Component: ClientStartJourneyRoute },
          { path: 'cases/:caseId', Component: PortalCasePage },
          { path: 'requests', Component: PortalRequestsPage },
        ],
      },
      { path: 'join', Component: JoinPage },
      {
        path: 'portal',
        Component: PortalLayout,
        children: [
          { index: true, Component: PortalIndex },
          // Client app (docs/plans/11): its pages and journeys.
          { path: 'p/:page', Component: ClientAppPageRoute },
          { path: 'journeys/:caseId', Component: ClientJourneyRoute },
          { path: 'start/:journey', Component: ClientStartJourneyRoute },
          { path: 'cases/:caseId', Component: PortalCasePage },
          { path: 'requests', Component: PortalRequestsPage },
          { path: 'privacy', Component: PortalPrivacyPage },
        ]
      },
      // The studio's canvas: the client app in a frame (no back-office chrome).
      {
        path: 'app/experience/preview',
        Component: StudioPreviewFrame,
        children: [
          { index: true, Component: ClientAppPageRoute },
          { path: 'p/:page', Component: ClientAppPageRoute },
        ],
      },
      {
        path: 'app/forms/:formId/instances/:instanceId/answers/new',
        Component: NewAnswerPage
      },
      {
        path: 'app',
        children: [
          {
            Component: AppLayout,
            children: [
              {
                path: 'dashboard',
                index: true,
                Component: DashboardPage
              },
              {
                path: 'documents',
                Component: DocumentsPage
              },
              { path: 'tasks', Component: TasksPage },
              { path: 'tasks/:taskId', Component: TaskPage },
              { path: 'cases', Component: CasesPage },
              { path: 'cases/:caseId', Component: CasePage },
              { path: 'clients', Component: ClientsPage },
              { path: 'clients/:clientId', Component: ClientPage },
              { path: 'audit', Component: AuditPage },
              { path: 'data-requests', Component: DataRequestsPage },
              { path: 'platform/institutions', Component: InstitutionsPage },
              { path: 'platform/staff', Component: StaffPage },
              { path: 'platform/audit', Component: PlatformAuditPage },
              { path: 'platform/support-access', Component: SupportAccessRequestsPage },
              { path: 'support-access', Component: SupportAccessPage },
              { path: 'integrations', Component: IntegrationsPage },
              { path: 'experience', Component: StudioPage },
              { path: 'back-office', Component: BackOfficeStudioPage },
              { path: 'map', Component: MapPage },
              { path: 'platform/connectors', Component: ConnectorsPage },
              {
                path: 'database',
                Component: TablesPage,
                children: [
                  {
                    path: ':tableName',
                    Component: TablePage,
                  }
                ]
              },
              {
                path: 'webhooks',
                Component: WebhooksPage
              },
              {
                path: 'emails',
                Component: EmailTemplatesPage
              },
              {
                path: 'me',
                Component: ProfilePage
              },
              {
                path: 'workflows',
                children: [
                  {
                    index: true,
                    path: '',
                    Component: WorkflowsPage
                  },
                  {
                    path: 'new',
                    Component: NewWorkflowPage,
                  },
                  {
                    path: ':workflowId',
                    Component: ExistingWorkflowPage,
                  },
                ]
              },
              {
                path: 'users',
                Component: UsersPage
              },
              {
                path: 'roles',
                Component: RolesPage
              },
              { path: 'roles/who', Component: WhoPage },
              { path: 'roles/:roleKey', Component: RolePage },
              { path: 'access-changes', Component: AccessChangesPage },
              { path: 'x/:page', Component: BackOfficePageRoute },
              {
                path: 'logs',
                Component: LogsPage
              },
              {
                path: 'settings',
                Component: SettingsPage
              },
              {
                path: 'keys',
                Component: KeysPage
              },
              {
                path: 'forms',
                children: [
                  {
                    index: true,
                    path: '',
                    Component: FormsPage
                  },
                  {
                    path: ':formId/instances',
                    children: [
                      {
                        index: true,
                        path: '',
                        Component: FormInstancesPage,
                      },
                      {
                        path: ':instanceId/answers',
                        Component: FormAnswersPage,
                      }
                    ]
                  }
                ]
              },
            ]
          },
          {
            Component: OnboardingLayout,
            children: [
              {
                path: 'onboarding',
                Component: OnboardingPage,
              }
            ]
          },
        ]
      },
      { path: '*', Component: NotFoundPage },
    ]
  },
]);