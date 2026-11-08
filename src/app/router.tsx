import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/common/ui';
import DashboardPage from '@/pages/DashboardPage';

const CameraPage = lazy(() => import('@/pages/CameraPage'));
const ReviewPage = lazy(() => import('@/pages/ReviewPage'));
const BranchSelectionPage = lazy(() => import('@/pages/BranchSelectionPage'));
const PosterEditorPage = lazy(() => import('@/pages/PosterEditorPage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));
const HistoryDetailPage = lazy(() => import('@/pages/HistoryDetailPage'));
const TemplateManagerPage = lazy(() => import('@/pages/TemplateManagerPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

const PageFallback = () => (
  <div className="space-y-4">
    <Skeleton className="h-10 w-64" />
    <Skeleton className="h-[60dvh] w-full" />
  </div>
);
const s = (el: ReactNode) => <Suspense fallback={<PageFallback />}>{el}</Suspense>;

function RouteError() {
  const err = useRouteError();
  const msg = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : 'Unexpected error';
  return (
    <div className="grid min-h-dvh place-items-center bg-navy-950 p-6 text-center text-white">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-slate-400">{msg}</p>
        <Link to="/" className="inline-block rounded-xl bg-electric-500 px-4 py-2 font-semibold">Back to dashboard</Link>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'camera', element: s(<CameraPage />) },
      { path: 'review', element: s(<ReviewPage />) },
      { path: 'branches', element: s(<BranchSelectionPage />) },
      { path: 'editor', element: s(<PosterEditorPage />) },
      { path: 'history', element: s(<HistoryPage />) },
      { path: 'history/:id', element: s(<HistoryDetailPage />) },
      { path: 'templates', element: s(<TemplateManagerPage />) },
      { path: 'settings', element: s(<SettingsPage />) },
      { path: '*', element: <RouteError /> },
    ],
  },
]);
