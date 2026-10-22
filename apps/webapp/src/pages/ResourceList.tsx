import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Input, Popconfirm, Select, Space, Tag } from 'antd';
import { Plus, MagnifyingGlass, ArrowClockwise } from '@phosphor-icons/react';
import type { ListResponse } from '@cdp/contracts';
import { dateLabel, request } from '../lib/api';
import { ActionLink, EmptyState, ErrorNotice, PageHeading, StatusTag } from '../components/Feedback';
import { DataTable } from '../components/DataTable';

export type Section = 'tags' | 'attributes' | 'events' | 'audiences';
export const sections = {
  tags: { title: '标签', path: '/metadata/tags', api: '/metadata', type: 'TAG' },
  attributes: { title: '属性', path: '/metadata/attributes', api: '/metadata', type: 'ATTRIBUTE' },
  events: { title: '行为模型', path: '/metadata/events', api: '/event-models', type: '' },
  audiences: { title: '人群', path: '/audiences', api: '/audiences', type: '' },
};
type ListRow = { id: string; name: string; description: string; status: string; fieldName?: string; eventCode?: string; audienceCode?: string; dataType?: string; displayType?: string; isEnum?: boolean; ruleCount?: number; createdAt: string; updatedAt: string };
const displayLabels: Record<string, string> = { TEXT: '文本输入', NUMBER: '数字输入', SELECT: '下拉单选', MULTI_SELECT: '下拉多选', BOOLEAN: '布尔选择', DATE: '日期选择', DATETIME: '日期时间' };
export function ResourceList({ section }: { section: Section }) {
  const config = sections[section];
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>();
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (keyword) params.set('keyword', keyword);
  if (status) params.set('status', status);
  if (config.type) params.set('type', config.type);
  const query = useQuery({ queryKey: ['list', section, params.toString()], queryFn: () => request<ListResponse<ListRow>>(`${config.api}?${params}`) });
  const mutation = useMutation({
    mutationFn: async ({ row, action }: { row: ListRow; action: 'delete' | 'toggle' | 'copy' }) => {
      if (action === 'copy') return request<{ data: ListRow }>(`${config.api}/${row.id}/copy`, 'POST', {});
      return request(`${config.api}/${row.id}`, action === 'delete' ? 'DELETE' : 'PATCH', action === 'toggle' ? { status: row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED' } : undefined);
    },
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries();
      void message.success(variables.action === 'delete' ? '已删除' : variables.action === 'copy' ? '已创建独立副本' : '状态已更新');
      if (variables.action === 'copy' && result) navigate(`${config.path}/${(result as { data: ListRow }).data.id}/edit`);
    },
  });
  const codeField = section === 'audiences' ? 'audienceCode' : section === 'events' ? 'eventCode' : 'fieldName';
  const columns = [
    { title: `${config.title}名称`, key: 'name', width: 220, ellipsis: true, render: (_: unknown, row: ListRow) => <div className="table-name"><Link to={`${config.path}/${row.id}/edit`} title={row.description || row.name}>{row.name}</Link></div> },
    { title: '技术编码', dataIndex: codeField, key: 'code', width: 180, ellipsis: true, render: (value: string) => <code title={value}>{value}</code> },
    ...(section === 'tags' || section === 'attributes' ? [
      { title: '数据类型', dataIndex: 'dataType', key: 'type', render: (value: string) => <Tag>{value}</Tag> },
      { title: '展示类型', dataIndex: 'displayType', key: 'display', render: (value: string) => displayLabels[value] },
      { title: '枚举', dataIndex: 'isEnum', key: 'enum', render: (value: boolean) => value ? '是' : '否' },
    ] : section === 'audiences' ? [{ title: '规则数量', dataIndex: 'ruleCount', key: 'rules', render: (value: number) => <span className="rule-count">{value} <small>条条件</small></span> }] : []),
    { title: '状态', dataIndex: 'status', key: 'status', width: 88, render: (value: string) => <StatusTag status={value} /> },
    ...(section === 'audiences' ? [{ title: '创建时间', dataIndex: 'createdAt', key: 'created', width: 160, render: (value: string) => <span className="date-cell">{dateLabel(value)}</span> }] : []),
    { title: '最近更新', dataIndex: 'updatedAt', key: 'updated', width: 160, render: (value: string) => <span className="date-cell">{dateLabel(value)}</span> },
    { title: '操作', key: 'actions', width: 148, fixed: 'right' as const, render: (_: unknown, row: ListRow) => <Space size={10}>
      <Link to={`${config.path}/${row.id}/edit`}>编辑</Link>
      {section === 'audiences' ? <Button type="link" size="small" disabled={mutation.isPending} onClick={() => mutation.mutate({ row, action: 'copy' })}>复制</Button> :
        <Button type="link" size="small" disabled={mutation.isPending} onClick={() => mutation.mutate({ row, action: 'toggle' })}>{row.status === 'ENABLED' ? '停用' : '启用'}</Button>}
      <Popconfirm title={`删除“${row.name}”？`} description="已被人群引用的资源无法删除。" okText="确认删除" cancelText="取消" onConfirm={() => mutation.mutate({ row, action: 'delete' })}><Button type="link" danger size="small" disabled={mutation.isPending}>删除</Button></Popconfirm>
    </Space> },
  ];
  return <>
    <PageHeading title={section === 'events' ? '行为模型' : `${config.title}管理`} />
    <div className="surface list-surface">
      <div className="list-toolbar"><div className="list-actions"><ActionLink to={`${config.path}/new`} primary icon={<Plus size={16} aria-hidden="true" />}>新建{config.title}</ActionLink><span className="list-total">共 <b>{query.data?.pagination.total ?? '—'}</b> 条</span></div><div className="list-filters">
        <Input.Search className="list-search" allowClear placeholder="搜索名称或编码" aria-label="搜索名称或编码" prefix={<MagnifyingGlass size={16} />} onSearch={value => { setKeyword(value); setPage(1); }} />
        <Select className="status-filter" placeholder="全部状态" aria-label="筛选状态" allowClear value={status} onChange={value => { setStatus(value); setPage(1); }} options={(section === 'audiences' ? [{ value: 'DRAFT', label: '草稿' }, { value: 'CONFIGURED', label: '已配置' }, { value: 'DISABLED', label: '停用' }] : [{ value: 'ENABLED', label: '启用' }, { value: 'DISABLED', label: '停用' }])} />
        <Button aria-label="刷新列表" icon={<ArrowClockwise size={17} />} onClick={() => { void query.refetch(); }} />
      </div></div>
      <ErrorNotice error={query.error || mutation.error} retry={() => { void query.refetch(); }} />
      <DataTable label={`${config.title}列表`} rowKey="id" columns={columns} dataSource={query.data?.data} loading={query.isPending} scroll={{ x: 1000 }} locale={{ emptyText: <EmptyState label={keyword || status ? '没有符合筛选条件的记录，请调整关键词或状态。' : `还没有${config.title}，从第一条配置开始`} action={!keyword && !status && <Link to={`${config.path}/new`}>新建{config.title}</Link>} /> }} pagination={{ current: page, pageSize: 20, total: query.data?.pagination.total, onChange: setPage, showSizeChanger: false, showTotal: total => `共 ${total} 条记录` }} />
    </div>
  </>;
}
