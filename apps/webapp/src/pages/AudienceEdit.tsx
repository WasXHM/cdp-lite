import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Drawer, Form, Input, Select, Space, Tooltip } from 'antd';
import { Question } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { audienceSchema, rulesSchema, validateRules, type Audience, type AudienceRules, type EventModel, type Metadata, type ValidationIssue } from '@cdp/contracts';
import { ApiError, getDetail, request } from '../lib/api';
import { ActionLink, ErrorNotice, PageHeading, QueryState } from '../components/Feedback';
import { useLeaveGuard } from '../hooks/useLeaveGuard';
import { RuleBuilder } from '../features/audiences/components/RuleBuilder';

export function AudienceEdit() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ['audience', id], queryFn: () => getDetail<Audience>(`/audiences/${id}`), enabled: !!id });
  if (id && (query.isPending || query.error)) return <QueryState pending={query.isPending} error={query.error} retry={() => { void query.refetch(); }} />;
  return <AudienceForm key={id || 'new'} initial={query.data} />;
}
function AudienceForm({ initial }: { initial?: Audience }) {
  const [form] = Form.useForm();
  const [rules, setRules] = useState<AudienceRules>(initial?.rules || [[]]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const allowLeave = useLeaveGuard(dirty);
  const navigate = useNavigate();
  const client = useQueryClient();
  const { message } = App.useApp();
  const [revision, setRevision] = useState(initial?.revision);
  const validate = async () => {
    const shape = rulesSchema.safeParse(rules);
    let validation: ValidationIssue[];
    if (!shape.success) validation = validateRules(rules, { metadata: [], events: [] });
    else {
      const metadataIds = [...new Set(rules.flat().flatMap(rule => rule.metadataType !== 'EVENT' ? [rule.metadataId] : []))];
      const eventIds = [...new Set(rules.flat().flatMap(rule => rule.metadataType === 'EVENT' ? [rule.eventId] : []))];
      const [metadata, events] = await Promise.all([
        Promise.all(metadataIds.map(id => client.fetchQuery({ queryKey: ['metadata', id], queryFn: () => getDetail<Metadata>(`/metadata/${id}`), staleTime: 0 }))),
        Promise.all(eventIds.map(id => client.fetchQuery({ queryKey: ['event', id], queryFn: () => getDetail<EventModel>(`/event-models/${id}`), staleTime: 0 }))),
      ]);
      validation = validateRules(rules, { metadata, events });
    }
    setIssues(validation);
    if (validation.length) throw new Error('请检查标记的规则条件');
    await request('/audiences/validate-rules', 'POST', { rules });
  };
  const mutation = useMutation({
    mutationFn: async ({ values, onlyValidate }: { values?: Record<string, unknown>; onlyValidate?: boolean }) => {
      await validate();
      if (onlyValidate) return null;
      const body = audienceSchema.parse({ ...values, rules, schemaVersion: 1 });
      return request<{ data: Audience }>(`/audiences${initial ? `/${initial.id}` : ''}`, initial ? 'PATCH' : 'POST', { ...body, ...(initial ? { revision } : {}) });
    },
    onSuccess: result => {
      if (!result) { void message.success('规则校验通过'); return; }
      setDirty(false); setRevision(result.data.revision); void client.invalidateQueries(); void message.success('人群规则已保存，未执行计算');
      if (!initial) { allowLeave(); navigate(`/audiences/${result.data.id}/edit`, { replace: true }); }
    },
    onError: error => { if (error instanceof ApiError) setIssues(error.body.details); },
  });
  const ruleCount = rules.reduce((total, group) => total + group.length, 0);
  return <>
    <PageHeading title={initial ? `编辑人群 · ${initial.name}` : '新建人群'} action={<ActionLink to="/audiences">返回列表</ActionLink>} />
    <div className="audience-layout">
      <div className="audience-main">
        <section className="surface editor-surface">
          <div className="section-heading"><h2>基础信息</h2></div>
          <Form name="audience" form={form} layout="vertical" initialValues={initial || { status: 'CONFIGURED', description: '' }} onValuesChange={() => setDirty(true)} onFinish={values => mutation.mutate({ values })}>
            <div className="form-grid audience-form-grid">
              <Form.Item name="name" label="人群名称" rules={[{ required: true, whitespace: true }]}><Input placeholder="例如：高价值数码用户" maxLength={100} /></Form.Item>
              <Form.Item name="audienceCode" label="人群编码" rules={[{ required: true, pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '以字母开头，仅含字母、数字和下划线' }]}><Input disabled={!!initial} placeholder="例如：high_value_digital" maxLength={64} /></Form.Item>
              <Form.Item name="status" label="状态"><Select options={[{ value: 'CONFIGURED', label: '已配置' }, { value: 'DRAFT', label: '草稿' }, { value: 'DISABLED', label: '停用' }]} /></Form.Item>
              <Form.Item className="description-field" name="description" label="人群描述"><Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} maxLength={1000} placeholder="选填" /></Form.Item>
            </div>
          </Form>
        </section>
        <div className="section-heading rule-section-heading"><div className="rule-heading-title"><h2>筛选规则</h2><span className="muted"><span className="numeric">{rules.length}</span> 组 / <span className="numeric">{ruleCount}</span> 条</span></div><div className="rule-heading-actions"><Tooltip title="组内 AND，组间 OR。仅保存规则，不执行人群计算。" trigger={['hover', 'focus']}><Button type="text" aria-label="规则说明" icon={<Question size={17} />} /></Tooltip><Button onClick={() => setPreview(true)}>查看规则 JSON</Button></div></div>
        <ErrorNotice error={mutation.error} />
        <RuleBuilder rules={rules} issues={issues} onChange={updated => { setRules(updated); setDirty(true); setIssues([]); }} />
        <div className="save-bar"><span role="status">{dirty ? '有未保存的修改' : initial ? '规则已保存' : '尚未保存'}</span><Space><Button loading={mutation.isPending} onClick={() => mutation.mutate({ onlyValidate: true })}>校验规则</Button><Button type="primary" loading={mutation.isPending} onClick={() => form.submit()}>保存人群</Button></Space></div>
      </div>
    </div>
    <Drawer title="规则 JSON" width={640} open={preview} onClose={() => setPreview(false)}><p className="muted">只读 · Schema v1 · 内层 AND / 外层 OR</p><pre className="json-preview">{JSON.stringify(rules, null, 2)}</pre></Drawer>
  </>;
}
