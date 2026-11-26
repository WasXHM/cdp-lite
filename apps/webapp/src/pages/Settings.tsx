import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Form, Input, Modal, Popconfirm, Result, Select, Space, Tag } from 'antd';
import { ArrowClockwise, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import type { CreateUserInput, ManagedUser, UpdateUserInput, UserRole } from '@cdp/contracts';
import { DataTable } from '../components/DataTable';
import { EmptyState, ErrorNotice, PageHeading, StatusTag } from '../components/Feedback';
import { dateLabel } from '../lib/api';
import { createUser, deleteUser, listUsers, updateUser } from '../lib/users';
import { useAuth } from '../features/auth/AuthProvider';

type UserForm = {
  username: string;
  displayName: string;
  password?: string;
  role: UserRole;
  status: 'ENABLED' | 'DISABLED';
};
type Editing = 'new' | ManagedUser | undefined;
type MutationInput =
  | { action: 'save'; id?: string; input: CreateUserInput | UpdateUserInput; currentUser: boolean }
  | { action: 'delete'; id: string; currentUser: false };

const roleOptions = [{ value: 'USER', label: '普通用户' }, { value: 'ADMIN', label: '系统管理员' }];
const statusOptions = [{ value: 'ENABLED', label: '已启用' }, { value: 'DISABLED', label: '已停用' }];

export default function Settings() {
  const { user } = useAuth();
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<UserRole>();
  const [status, setStatus] = useState<'ENABLED' | 'DISABLED'>();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Editing>();
  const [form] = Form.useForm<UserForm>();
  const client = useQueryClient();
  const { message } = App.useApp();
  const params = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (keyword) params.set('keyword', keyword);
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  const query = useQuery({
    queryKey: ['users', params.toString()],
    queryFn: () => listUsers(params.toString()),
    enabled: user.role === 'ADMIN',
  });
  const mutation = useMutation<unknown, Error, MutationInput>({
    mutationFn: (variables: MutationInput) => variables.action === 'delete'
      ? deleteUser(variables.id)
      : variables.id ? updateUser(variables.id, variables.input as UpdateUserInput) : createUser(variables.input as CreateUserInput),
    onSuccess: (_result, variables) => {
      setEditing(undefined);
      void client.invalidateQueries({ queryKey: ['users'] });
      void message.success(variables.action === 'delete' ? '用户已删除' : '用户已保存');
      if (variables.currentUser) window.location.reload();
    },
    onError: error => { void message.error(error.message); },
  });

  useEffect(() => {
    if (!editing) return;
    form.resetFields();
    form.setFieldsValue(editing === 'new'
      ? { role: 'USER', status: 'ENABLED' }
      : { username: editing.username, displayName: editing.displayName, role: editing.role, status: editing.status });
  }, [editing, form]);

  if (user.role !== 'ADMIN') return <Result status="403" title="无权访问设置" subTitle="只有系统管理员可以管理用户。" />;

  const save = (values: UserForm) => {
    const currentUser = editing !== 'new' && editing?.id === user.id;
    if (editing === 'new') {
      mutation.mutate({ action: 'save', input: values as CreateUserInput, currentUser: false });
      return;
    }
    if (!editing) return;
    const { password, ...fields } = values;
    mutation.mutate({ action: 'save', id: editing.id, input: { ...fields, ...(password ? { password } : {}) }, currentUser });
  };
  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 190, render: (value: string, row: ManagedUser) => <div className="table-name"><strong>{value}</strong>{row.id === user.id && <Tag color="blue">当前用户</Tag>}</div> },
    { title: '显示名称', dataIndex: 'displayName', key: 'displayName', width: 180 },
    { title: '角色', dataIndex: 'role', key: 'role', width: 120, render: (value: UserRole) => value === 'ADMIN' ? '系统管理员' : '普通用户' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: (value: string) => <StatusTag status={value} /> },
    { title: '最近更新', dataIndex: 'updatedAt', key: 'updatedAt', width: 170, render: (value: string) => <span className="date-cell">{dateLabel(value)}</span> },
    { title: '操作', key: 'actions', width: 140, fixed: 'right' as const, render: (_: unknown, row: ManagedUser) => <Space size={10}>
      <Button type="link" size="small" onClick={() => { mutation.reset(); setEditing(row); }}>编辑</Button>
      {row.id === user.id
        ? <Button type="link" danger size="small" disabled title="不能删除当前登录用户">删除</Button>
        : <Popconfirm title={`删除用户“${row.username}”？`} description="删除后，该用户的所有登录会话将立即失效。" okText="确认删除" cancelText="取消" onConfirm={() => mutation.mutate({ action: 'delete', id: row.id, currentUser: false })}><Button type="link" danger size="small" disabled={mutation.isPending}>删除</Button></Popconfirm>}
    </Space> },
  ];
  const editingSelf = editing !== 'new' && editing?.id === user.id;
  return <>
    <PageHeading title="设置" />
    <div className="surface list-surface settings-surface">
      <div className="settings-section-heading"><div><h2>用户管理</h2><p>创建账号、调整角色和状态，或重置用户密码。</p></div><Button type="primary" icon={<Plus size={16} />} onClick={() => { mutation.reset(); setEditing('new'); }}>创建用户</Button></div>
      <div className="list-toolbar"><div className="list-actions"><span className="list-total">共 <b>{query.data?.pagination.total ?? '—'}</b> 个用户</span></div><div className="list-filters">
        <Input.Search className="list-search" allowClear placeholder="搜索用户名或显示名称" aria-label="搜索用户名或显示名称" prefix={<MagnifyingGlass size={16} />} onSearch={value => { setKeyword(value); setPage(1); }} />
        <Select className="status-filter" placeholder="全部角色" aria-label="筛选角色" allowClear value={role} onChange={value => { setRole(value); setPage(1); }} options={roleOptions} />
        <Select className="status-filter" placeholder="全部状态" aria-label="筛选状态" allowClear value={status} onChange={value => { setStatus(value); setPage(1); }} options={statusOptions} />
        <Button aria-label="刷新用户列表" icon={<ArrowClockwise size={17} />} onClick={() => { void query.refetch(); }} />
      </div></div>
      <ErrorNotice error={query.error || mutation.error} retry={() => { void query.refetch(); }} />
      <DataTable<ManagedUser> label="用户列表" rowKey="id" columns={columns} dataSource={query.data?.data} loading={query.isPending} scroll={{ x: 900 }} locale={{ emptyText: <EmptyState label="还没有符合条件的用户" action={<Button type="link" onClick={() => setEditing('new')}>创建用户</Button>} /> }} pagination={{ current: page, pageSize: 20, total: query.data?.pagination.total, onChange: setPage, showSizeChanger: false, showTotal: total => `共 ${total} 个用户` }} />
    </div>
    <Modal title={editing === 'new' ? '创建用户' : `编辑用户 · ${editing?.username || ''}`} open={!!editing} onCancel={() => { mutation.reset(); setEditing(undefined); }} onOk={() => form.submit()} confirmLoading={mutation.isPending} okText="保存" cancelText="取消" destroyOnClose>
      <Form<UserForm> form={form} layout="vertical" requiredMark={false} onFinish={save}>
        <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }, { min: 3, max: 64, message: '用户名长度为 3 到 64 个字符' }, { pattern: /^[a-z0-9][a-z0-9._-]*$/, message: '仅支持小写字母、数字、点、下划线和连字符' }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }, { max: 100 }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item name="password" label={editing === 'new' ? '登录密码' : '重置密码（留空则不修改）'} rules={[{ required: editing === 'new', message: '请输入登录密码' }, { min: 12, message: '密码至少 12 个字符' }, { max: 256 }]}><Input.Password autoComplete="new-password" /></Form.Item>
        <Form.Item name="role" label="角色" rules={[{ required: true }]} extra={editingSelf ? '不能修改自己的角色。' : undefined}><Select disabled={editingSelf} options={roleOptions} /></Form.Item>
        <Form.Item name="status" label="状态" rules={[{ required: true }]} extra={editingSelf ? '不能停用当前登录用户。' : undefined}><Select disabled={editingSelf} options={statusOptions} /></Form.Item>
        {editingSelf && <p className="form-helper">修改自己的用户名、显示名称或密码后，页面将刷新；重置密码会要求重新登录。</p>}
      </Form>
    </Modal>
  </>;
}
