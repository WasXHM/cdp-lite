import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Form, Space } from 'antd';
import { fieldIssues, metadataSchema, type Metadata } from '@cdp/contracts';
import { getDetail, request } from '../lib/api';
import { ActionLink, ErrorNotice, PageHeading, QueryState } from '../components/Feedback';
import { MetadataFields } from '../features/metadata/MetadataFields';
import { EnumValueTable } from '../features/metadata/EnumValueTable';
import { useLeaveGuard } from '../hooks/useLeaveGuard';
import { sections } from './ResourceList';

export function MetadataEdit({ type }: { type: 'TAG' | 'ATTRIBUTE' }) {
  const { id } = useParams();
  const query = useQuery({ queryKey: ['metadata', id], queryFn: () => getDetail<Metadata>(`/metadata/${id}`), enabled: !!id });
  if (id && (query.isPending || query.error)) return <QueryState pending={query.isPending} error={query.error} retry={() => { void query.refetch(); }} />;
  return <MetadataForm key={id || type} type={type} initial={query.data} />;
}
function MetadataForm({ type, initial }: { type: 'TAG' | 'ATTRIBUTE'; initial?: Metadata }) {
  const [form] = Form.useForm();
  const [dirty, setDirty] = useState(false);
  const allowLeave = useLeaveGuard(dirty);
  const navigate = useNavigate();
  const client = useQueryClient();
  const { message } = App.useApp();
  const config = sections[type === 'TAG' ? 'tags' : 'attributes'];
  const mutation = useMutation({
    mutationFn: async (input: unknown) => {
      const body = metadataSchema.parse({ ...(input as object), metadataType: type });
      const issues = fieldIssues(body);
      if (issues.length) throw new Error(issues.map(issue => issue.message).join('；'));
      return request<{ data: Metadata }>(`/metadata${initial ? `/${initial.id}` : ''}`, initial ? 'PATCH' : 'POST', body);
    },
    onSuccess: result => {
      setDirty(false); void client.invalidateQueries(); void message.success('基础信息已保存');
      if (!initial) { allowLeave(); navigate(`${config.path}/${result.data.id}/edit`, { replace: true }); }
    },
  });
  return <>
    <PageHeading title={`${initial ? '编辑' : '新建'}${config.title}`} action={<ActionLink to={config.path}>返回列表</ActionLink>} />
    <section className="surface editor-surface">
      <div className="section-heading"><h2>基础信息</h2></div>
      <ErrorNotice error={mutation.error} />
      <Form name="metadata" form={form} layout="vertical" initialValues={initial || { status: 'ENABLED', dataType: 'String', displayType: 'TEXT', isEnum: false, description: '' }} onValuesChange={() => setDirty(true)} onFinish={input => mutation.mutate(input)}>
        <MetadataFields editing={!!initial} />
        <div className="form-actions"><Space><Button type="primary" htmlType="submit" loading={mutation.isPending}>保存基础信息</Button><ActionLink to={config.path}>取消</ActionLink></Space></div>
      </Form>
      {initial?.isEnum && <EnumValueTable path={`/metadata/${initial.id}/enum-values`} dataType={initial.dataType} />}
    </section>
  </>;
}
