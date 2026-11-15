import { createBrowserRouter } from "react-router";
import { AppLayout } from "./modules/private/layout";
import { OnboardingLayout } from "./modules/private/onboarding/layout";

import { lazy } from 'react';
import BaseLayout from "./modules/BaseLayout";

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

export const router = createBrowserRouter([
  {
    path: "/",
    Component: BaseLayout,
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
      }
    ]
  },
]);