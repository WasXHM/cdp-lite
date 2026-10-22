import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Alert, Button, Form, Input, Select } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventSchema, type EventModel } from '@cdp/contracts';
import { ActionLink, ErrorNotice, PageHeading, QueryState } from '../components/Feedback';
import { getDetail, request } from '../lib/api';
import { useLeaveGuard } from '../hooks/useLeaveGuard';
import { DimensionEditor, MetricEditor } from '../features/events/ChildEditors';

export function EventEdit() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ['event', id], queryFn: () => getDetail<EventModel>(`/event-models/${id}`), enabled: !!id });
  if (id && (query.isPending || query.error)) return <QueryState pending={query.isPending} error={query.error} retry={() => { void query.refetch(); }} />;
  return <EventForm key={id || 'new'} initial={query.data} />;
}
function EventForm({ initial }: { initial?: EventModel }) {
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(dirty);
  const navigate = useNavigate();
  const client = useQueryClient();
  const { message } = App.useApp();
  const mutation = useMutation({
    mutationFn: (input: unknown) => request<{ data: EventModel }>(`/event-models${initial ? `/${initial.id}` : ''}`, initial ? 'PATCH' : 'POST', eventSchema.parse(input)),
    onSuccess: result => {
      setDirty(false); void client.invalidateQueries(); void message.success('行为模型已保存');
      if (!initial) { allowLeave(); navigate(`/metadata/events/${result.data.id}/edit`, { replace: true }); }
    },
  });
  return <>
    <PageHeading title={`${initial ? '编辑' : '新建'}行为模型`} action={<ActionLink to="/metadata/events">返回列表</ActionLink>} />
    <section className="surface editor-surface">
      <div className="section-heading"><h2>基础信息</h2></div>
      <ErrorNotice error={mutation.error} />
      <Form name="event" layout="vertical" initialValues={initial || { description: '', status: 'ENABLED' }} onValuesChange={() => setDirty(true)} onFinish={values => mutation.mutate(values)}>
        <div className="form-grid">
          <Form.Item name="name" label="行为名称" rules={[{ required: true, whitespace: true }]}><Input placeholder="例如：商品购买" maxLength={100} /></Form.Item>
          <Form.Item name="eventCode" label="行为编码" rules={[{ required: true, pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/ }]}><Input placeholder="例如：product_purchase" maxLength={64} disabled={!!initial} /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea maxLength={1000} autoSize={{ minRows: 1, maxRows: 3 }} /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={[{ value: 'ENABLED', label: '启用' }, { value: 'DISABLED', label: '停用' }]} /></Form.Item>
        </div>
        <div className="form-actions"><Button type="primary" htmlType="submit" loading={mutation.isPending}>保存基础信息</Button></div>
      </Form>
      {initial ? <><DimensionEditor eventId={initial.id} rows={initial.dimensions || []} /><MetricEditor eventId={initial.id} rows={initial.metrics || []} /></> : <Alert className="spaced" message="保存后可添加维度和指标。" type="info" showIcon />}
    </section>
  </>;
}
