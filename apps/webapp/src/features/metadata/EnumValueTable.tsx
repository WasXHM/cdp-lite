import { useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DataType, EnumValue } from '@cdp/contracts';
import { getAll, request } from '../../lib/api';
import { ErrorNotice, StatusTag } from '../../components/Feedback';
import { DataTable } from '../../components/DataTable';

export function EnumValueTable({ path, dataType }: { path: string; dataType: DataType }) {
  const [editing, setEditing] = useState<EnumValue | 'new'>();
  const [form] = Form.useForm();
  const client = useQueryClient();
  const { message } = App.useApp();
  const query = useQuery({ queryKey: ['values', path], queryFn: () => getAll<EnumValue>(path) });
  const mutation = useMutation({
    mutationFn: ({ id, body, remove }: { id?: string; body?: unknown; remove?: boolean }) => request(`${path}${id ? `/${id}` : ''}`, remove ? 'DELETE' : id ? 'PATCH' : 'POST', body),
    onSuccess: () => { setEditing(undefined); void client.invalidateQueries(); void message.success('枚举值已更新'); },
  });
  const open = (value: EnumValue | 'new') => {
    mutation.reset(); setEditing(value);
    form.setFieldsValue(value === 'new' ? { label: '', value: undefined, sortOrder: 0, status: 'ENABLED' } : value);
  };
  return <section className="subsection">
    <div className="section-heading"><h3>枚举值管理</h3><Button onClick={() => open('new')}>新增枚举值</Button></div>
    <ErrorNotice error={query.error || (!editing && mutation.error)} />
    <DataTable label="枚举值列表" scroll={{ x: 560 }} size="small" loading={query.isPending} rowKey="id" dataSource={query.data} pagination={{ pageSize: 10 }} columns={[
      { title: '值名称', dataIndex: 'label' }, { title: '值编码', dataIndex: 'value', render: value => <code>{String(value)}</code> },
      { title: '排序', dataIndex: 'sortOrder' }, { title: '状态', dataIndex: 'status', render: status => <StatusTag status={status} /> },
      { title: '操作', render: (_, row) => <Space><Button type="link" onClick={() => open(row)}>编辑</Button><Popconfirm title="删除此枚举值？" okText="删除" cancelText="取消" onConfirm={() => mutation.mutate({ id: row.id, remove: true })}><Button danger type="link" disabled={mutation.isPending}>删除</Button></Popconfirm></Space> },
    ]} />
    <Modal title={editing === 'new' ? '新增枚举值' : '编辑枚举值'} open={!!editing} onCancel={() => setEditing(undefined)} onOk={() => form.submit()} confirmLoading={mutation.isPending} okText="保存" cancelText="取消" destroyOnClose>
      <ErrorNotice error={mutation.error} />
      <Form name="enum-value" form={form} layout="vertical" onFinish={body => mutation.mutate({ id: editing !== 'new' ? editing?.id : undefined, body })}>
        <Form.Item name="label" label="值名称" rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item>
        <Form.Item name="value" label="值编码" rules={[{ required: true }]}>{dataType === 'Number' ? <InputNumber style={{ width: '100%' }} /> : <Input maxLength={100} />}</Form.Item>
        <Form.Item name="sortOrder" label="排序"><InputNumber min={0} max={100000} precision={0} /></Form.Item>
        <Form.Item name="status" label="状态"><Select options={[{ value: 'ENABLED', label: '启用' }, { value: 'DISABLED', label: '停用' }]} /></Form.Item>
      </Form>
    </Modal>
  </section>;
}
