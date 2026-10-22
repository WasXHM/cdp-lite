import { Alert, Button, Empty, Skeleton, Space, Tag } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ValidationIssue } from '@cdp/contracts';
import { ApiError } from '../lib/api';

export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  return <Alert type="error" showIcon message={error instanceof Error ? error.message : '操作失败'} description={
    <Space direction="vertical">
      {error instanceof ApiError && error.body.details.map((issue, index) => <span key={index}>{issue.path}：{issue.message}</span>)}
      {retry && <Button size="small" onClick={retry}>重新加载</Button>}
    </Space>
  } />;
}
export function Issues({ issues, path }: { issues: ValidationIssue[]; path: string }) {
  const matches = issues.filter(issue => issue.path === path || issue.path.startsWith(`${path}.`));
  return matches.length ? <div role="alert" className="field-errors">{matches.map((issue, index) => <div key={index}>{issue.message}</div>)}</div> : null;
}
export function StatusTag({ status }: { status: string }) {
  const labels: Record<string, string> = { ENABLED: '已启用', DISABLED: '已停用', DRAFT: '草稿', CONFIGURED: '已配置' };
  return <Tag className={`status-tag status-${status.toLowerCase()}`}>{labels[status] || status}</Tag>;
}
export function PageHeading({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="page-heading"><h1>{title}</h1>{action}</div>;
}
export function ActionLink({ to, children, primary = false, icon }: { to: string; children: ReactNode; primary?: boolean; icon?: ReactNode }) {
  return <Link to={to} className={`action-link${primary ? ' action-link-primary' : ''}`}>{icon}<span>{children}</span></Link>;
}
export function QueryState({ pending, error, retry }: { pending: boolean; error: unknown; retry: () => void }) {
  if (pending) return <div className="surface loading-surface" role="status" aria-label="正在加载配置"><Skeleton active paragraph={{ rows: 6 }} /></div>;
  return <ErrorNotice error={error} retry={retry} />;
}
export function EmptyState({ label = '暂无数据', action }: { label?: string; action?: ReactNode }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={label}>{action}</Empty>;
}
