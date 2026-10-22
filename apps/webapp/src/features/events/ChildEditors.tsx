import { useState } from 'react';
import { App, Button, Drawer, Form, Input, Modal, Popconfirm, Select, Space } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fieldSchema, metricSchema, type Dimension, type Metric } from '@cdp/contracts';
import { request } from '../../lib/api';
import { ErrorNotice, StatusTag } from '../../components/Feedback';
import { MetadataFields } from '../metadata/MetadataFields';
import { EnumValueTable } from '../metadata/EnumValueTable';
import { DataTable } from '../../components/DataTable';

export function DimensionEditor({ eventId, rows }: { eventId: string; rows: Dimension[] }) {
  return <ChildEditor eventId={eventId} rows={rows} kind="dimensions" />;
}
export function MetricEditor({ eventId, rows }: { eventId: string; rows: Metric[] }) {
  return <ChildEditor eventId={eventId} rows={rows} kind="metrics" />;
}
function ChildEditor({ eventId, rows, kind }: { eventId: string; rows: (Dimension | Metric)[]; kind: 'dimensions' | 'metrics' }) {
  const [editing, setEditing] = useState<Dimension | Metric | 'new'>();
  const [valuesFor, setValuesFor] = useState<Dimension>();
  const [dirty, setDirty] = useState(false);
  const [form] = Form.useForm();
  const client = useQueryClient();
  const { message, modal } = App.useApp();
  const isDimension = kind === 'dimensions';
  const label = isDimension ? '维度' : '指标';
  const path = `/event-models/${eventId}/${kind}`;
  const mutation = useMutation({
    mutationFn: async ({ id, body, remove }: { id?: string; body?: unknown; remove?: boolean }) => {
      const parsed = remove ? undefined : (isDimension ? fieldSchema : metricSchema).parse(body);
      return request(`${path}${id ? `/${id}` : ''}`, remove ? 'DELETE' : id ? 'PATCH' : 'POST', parsed);
    },
    onSuccess: () => { setEditing(undefined); setDirty(false); void client.invalidateQueries(); void message.success(`${label}已更新`); },
  });
  const open = (row: Dimension | Metric | 'new') => {
    form.resetFields();
    form.setFieldsValue(row === 'new' ? { status: 'ENABLED', dataType: isDimension ? 'String' : 'Number', displayType: 'TEXT', isEnum: false, description: '' } : row);
    mutation.reset(); setEditing(row); setDirty(false);
  };
  const close = () => {
    if (dirty) modal.confirm({ title: '放弃未保存的修改？', okText: '放弃修改', cancelText: '继续编辑', onOk: () => setEditing(undefined) });
    else setEditing(undefined);
  };
  return <section className="subsection">
    <div className="section-heading"><h3>{label}管理</h3><Button onClick={() => open('new')}>新增{label}</Button></div>
    <ErrorNotice error={!editing && mutation.error} />
    <DataTable label={`${label}列表`} scroll={{ x: 640 }} rowKey="id" size="small" dataSource={rows} pagination={false} columns={[
      { title: `${label}名称`, dataIndex: 'name' }, { title: '字段名称', dataIndex: 'fieldName', render: value => <code>{value}</code> },
      { title: '数据类型', dataIndex: 'dataType' }, { title: '状态', dataIndex: 'status', render: status => <StatusTag status={status} /> },
      { title: '操作', render: (_, row) => <Space><Button type="link" onClick={() => open(row)}>编辑</Button>
        {'isEnum' in row && row.isEnum && <Button type="link" onClick={() => setValuesFor(row)}>枚举值</Button>}
        <Popconfirm title={`删除此${label}？`} okText="删除" cancelText="取消" onConfirm={() => mutation.mutate({ id: row.id, remove: true })}><Button type="link" danger disabled={mutation.isPending}>删除</Button></Popconfirm></Space> },
    ]} />
    <Modal title={`${editing === 'new' ? '新增' : '编辑'}${label}`} width={760} open={!!editing} onCancel={close} onOk={() => form.submit()} confirmLoading={mutation.isPending} okText="保存" cancelText="取消" destroyOnClose>
      <ErrorNotice error={mutation.error} />
      <Form name={kind} form={form} layout="vertical" onValuesChange={() => setDirty(true)} onFinish={body => {
        mutation.mutate({ id: editing !== 'new' ? editing?.id : undefined, body });
      }}>
        {isDimension ? <MetadataFields editing={editing !== 'new'} /> : <>
          <Form.Item name="name" label="指标名称" rules={[{ required: true, whitespace: true }]}><Input maxLength={100} /></Form.Item>
          <Form.Item name="fieldName" label="字段名称" rules={[{ required: true, pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/ }]}><Input maxLength={64} disabled={editing !== 'new'} /></Form.Item>
          <Form.Item name="dataType" label="数据类型"><Select disabled options={[{ value: 'Number', label: 'Number（数值型）' }]} /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea maxLength={1000} /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={[{ value: 'ENABLED', label: '启用' }, { value: 'DISABLED', label: '停用' }]} /></Form.Item>
        </>}
      </Form>
    </Modal>
    <Drawer title={`${valuesFor?.name || ''} · 维度值`} width={720} open={!!valuesFor} onClose={() => setValuesFor(undefined)} destroyOnClose>
      {valuesFor && <EnumValueTable path={`/event-models/${eventId}/dimensions/${valuesFor.id}/values`} dataType={valuesFor.dataType} />}
    </Drawer>
  </section>;
}
