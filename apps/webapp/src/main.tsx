import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App, ConfigProvider, Result, Skeleton } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import { AppLayout } from './app/App';
import { ResourceList } from './pages/ResourceList';
import { workspaceTheme, installWorkspaceTokens } from './styles/theme';
import './styles/app.css';

installWorkspaceTokens();
dayjs.locale('zh-cn');
const MetadataEdit = lazy(() => import('./pages/MetadataEdit').then(module => ({ default: module.MetadataEdit })));
const EventEdit = lazy(() => import('./pages/EventEdit').then(module => ({ default: module.EventEdit })));
const AudienceEdit = lazy(() => import('./pages/AudienceEdit').then(module => ({ default: module.AudienceEdit })));
const router = createBrowserRouter([{
  element: <AppLayout />,
  errorElement: <Result status="error" title="页面加载失败" subTitle="请刷新页面后重试。" />,
  children: [
    { index: true, element: <Navigate to="/audiences" replace /> },
    ...(['tags', 'attributes', 'events', 'audiences'] as const).flatMap(section => {
      const path = section === 'audiences' ? '/audiences' : `/metadata/${section}`;
      const editor = section === 'audiences' ? <AudienceEdit /> : section === 'events' ? <EventEdit /> : <MetadataEdit type={section === 'tags' ? 'TAG' : 'ATTRIBUTE'} />;
      return [
        { path, element: <ResourceList key={section} section={section} /> },
        { path: `${path}/new`, element: <Suspense fallback={<Skeleton active />}>{editor}</Suspense> },
        { path: `${path}/:id/edit`, element: <Suspense fallback={<Skeleton active />}>{editor}</Suspense> },
      ];
    }),
    { path: '*', element: <Result status="404" title="页面不存在" /> },
  ],
}]);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ConfigProvider locale={zhCN} theme={workspaceTheme}>
    <App><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></App>
  </ConfigProvider></React.StrictMode>,
);
