import { useMemo, useState } from 'react';
import { Alert, App, Button, Checkbox, Drawer, Input, Radio, Space, Tag } from 'antd';
import { ArrowClockwise, Sparkle, X } from '@phosphor-icons/react';
import type { AiAudienceGenerateResult, AiAudienceMapping, AiAudienceResourceRef, AudienceRules } from '@cdp/contracts';
import { ApiError, request } from '../../../lib/api';
import { applyGeneratedRules, type GeneratedRuleApplyMode } from '../model/rules';
import { useGenerateAudienceRules } from '../hooks/useGenerateAudienceRules';

const statusLabels: Record<AiAudienceMapping['status'], string> = {
  MAPPED: '已映射', DERIVED: '推导生成', NEEDS_CONFIRMATION: '需确认', UNMAPPED: '无法映射',
};
const parameterLabels = { USER_EXPLICIT: '用户明确', METADATA_DEFINED: '元数据定义', AI_DERIVED: 'AI 推导' } as const;

function MappingReview({ mapping, selected, onSelect }: {
  mapping: AiAudienceMapping;
  selected?: string;
  onSelect: (resourceId: string) => void;
}) {
  return <article className={`ai-mapping ai-mapping-${mapping.status.toLowerCase()}`}>
    <div className="ai-mapping-heading"><span className="ai-source-text">“{mapping.sourceText}”</span><Tag>{statusLabels[mapping.status]}</Tag></div>
    <p>{mapping.explanation}</p>
    {mapping.status === 'DERIVED' && <div className="ai-derivation">
      <div className="ai-definition"><span>AI 建议定义</span><strong>{mapping.derivation.suggestedDefinition}</strong></div>
      <div className="ai-signal-list">{mapping.derivation.signals.map(signal => <div key={`${signal.resourceType}-${signal.resourceId}`}><Tag>{signal.name}</Tag><span>{signal.role} · {signal.reason}</span></div>)}</div>
      <div className="ai-parameter-list">{mapping.parameters.map(parameter => <div key={parameter.path}><span>{parameter.label}</span><strong>{parameter.displayValue}</strong><em>{parameterLabels[parameter.source]}</em><small>{parameter.explanation}</small></div>)}</div>
    </div>}
    {mapping.status === 'MAPPED' && mapping.parameters.length > 0 && <div className="ai-parameter-list">{mapping.parameters.map(parameter => <div key={parameter.path}><span>{parameter.label}</span><strong>{parameter.displayValue}</strong><em>{parameterLabels[parameter.source]}</em><small>{parameter.explanation}</small></div>)}</div>}
    {mapping.status === 'NEEDS_CONFIRMATION' && <Radio.Group className="ai-candidate-list" value={selected} onChange={event => onSelect(event.target.value)}>
      {mapping.candidates.map(candidate => <Radio key={candidate.resourceId} value={candidate.resourceId}><strong>{candidate.name}</strong>{candidate.description && <span>{candidate.description}</span>}</Radio>)}
    </Radio.Group>}
  </article>;
}

export function AiRuleComposerDrawer({ open, currentRules, onClose, onApply }: {
  open: boolean;
  currentRules: AudienceRules;
  onClose: () => void;
  onApply: (rules: AudienceRules) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<AiAudienceGenerateResult | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, string>>({});
  const [applyMode, setApplyMode] = useState<GeneratedRuleApplyMode>();
  const [acceptPartial, setAcceptPartial] = useState(false);
  const [localError, setLocalError] = useState<unknown>(null);
  const [applying, setApplying] = useState(false);
  const generator = useGenerateAudienceRules();
  const { message } = App.useApp();
  const hasCurrentRules = currentRules.some(group => group.length > 0);
  const generatedRuleCount = result?.rules?.reduce((total, group) => total + group.length, 0) || 0;
  const confirmationMappings = useMemo(() => result?.mappings.filter(mapping => mapping.status === 'NEEDS_CONFIRMATION') || [], [result]);
  const canResolve = confirmationMappings.length > 0 && confirmationMappings.every(mapping => selectedCandidates[mapping.key]);
  const displayError = localError || (generator.error instanceof Error && generator.error.name !== 'AbortError' ? generator.error : null);
  const selectedLookup = useMemo(() => {
    const resources = new Map<string, AiAudienceResourceRef>();
    for (const mapping of confirmationMappings) for (const candidate of mapping.candidates) resources.set(candidate.resourceId, candidate);
    return resources;
  }, [confirmationMappings]);

  const generate = async (withClarifications = false) => {
    const normalized = prompt.trim();
    if (!normalized) { setLocalError(new Error('请先描述目标人群特点')); return; }
    setLocalError(null);
    try {
      const clarifications = withClarifications ? confirmationMappings.map(mapping => {
        const resource = selectedLookup.get(selectedCandidates[mapping.key]);
        if (!resource) throw new Error('请完成所有待确认项');
        return { key: mapping.key, sourceText: mapping.sourceText, resourceType: resource.resourceType, resourceId: resource.resourceId };
      }) : [];
      const generated = await generator.generate({ prompt: normalized, clarifications });
      setResult(generated); setSelectedCandidates({}); setApplyMode(undefined); setAcceptPartial(false);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setLocalError(error);
    }
  };

  const apply = async () => {
    if (!result?.rules) return;
    if (result.requiresConfirmation) { setLocalError(new Error('请先完成待确认项并重新生成')); return; }
    if (result.hasUnmappedSegments && !acceptPartial) { setLocalError(new Error('请确认仅应用可生成规则')); return; }
    if (hasCurrentRules && !applyMode) { setLocalError(new Error('请选择替换或追加方式')); return; }
    setApplying(true); setLocalError(null);
    try {
      const next = applyGeneratedRules(currentRules, result.rules, hasCurrentRules ? applyMode! : 'REPLACE');
      await request('/audiences/validate-rules', 'POST', { rules: next });
      onApply(next); void message.success('AI 规则已应用，请检查后保存人群'); onClose();
    } catch (error) { setLocalError(error); }
    finally { setApplying(false); }
  };

  const close = () => { generator.cancel(); onClose(); };
  return <Drawer className="ai-rule-drawer" title={<span className="ai-drawer-title"><Sparkle size={18} />AI 圈人</span>} width={560} open={open} onClose={close}>
    <div className="ai-composer">
      <section className="ai-prompt-section">
        <label htmlFor="ai-audience-prompt">描述目标人群特点</label>
        <Input.TextArea id="ai-audience-prompt" value={prompt} maxLength={1000} showCount autoSize={{ minRows: 4, maxRows: 8 }} onChange={event => { setPrompt(event.target.value); setResult(null); setSelectedCandidates({}); setLocalError(null); generator.reset(); }} placeholder="例如：请帮我圈出最近几天的活跃用户" />
        <div className="ai-prompt-hint">无需指定字段。AI 会结合现有标签、属性和行为模型生成建议规则；请勿输入姓名、手机号等个人信息。</div>
        <Space><Button type="primary" icon={<Sparkle size={16} />} loading={generator.isPending} onClick={() => { void generate(false); }}>生成规则</Button>{generator.isPending && <Button icon={<X size={15} />} onClick={generator.cancel}>取消</Button>}</Space>
      </section>
      {displayError && <Alert type="error" showIcon message={displayError instanceof ApiError ? displayError.body.message : displayError instanceof Error ? displayError.message : '生成失败'} />}
      {result && <>
        <section className="ai-result-summary"><div><span>生成摘要</span><strong>{result.summary}</strong></div><div className="ai-result-count"><span>{result.rules?.length || 0} 组</span><span>{generatedRuleCount} 条规则</span></div></section>
        {result.warnings.length > 0 && <Alert type="warning" showIcon message="生成提示" description={result.warnings.map(warning => <div key={warning}>{warning}</div>)} />}
        <section className="ai-review-section"><h3>语义与推导依据</h3>{result.mappings.map(mapping => <MappingReview key={mapping.key} mapping={mapping} selected={selectedCandidates[mapping.key]} onSelect={resourceId => setSelectedCandidates(current => ({ ...current, [mapping.key]: resourceId }))} />)}</section>
        {confirmationMappings.length > 0 && <Button icon={<ArrowClockwise size={16} />} disabled={!canResolve} loading={generator.isPending} onClick={() => { void generate(true); }}>按确认项重新生成</Button>}
        {result.rules && <section className="ai-apply-section">
          <div className="ai-rule-preview"><div><strong>规则草稿</strong><span>已通过结构与元数据校验</span></div><details><summary>查看规则 JSON</summary><pre>{JSON.stringify(result.rules, null, 2)}</pre></details></div>
          {hasCurrentRules && <Radio.Group className="ai-apply-mode" value={applyMode} onChange={event => setApplyMode(event.target.value)}><Radio value="REPLACE">替换当前规则</Radio><Radio value="APPEND_OR">追加为新的 OR 规则组</Radio></Radio.Group>}
          {result.hasUnmappedSegments && <Checkbox checked={acceptPartial} onChange={event => setAcceptPartial(event.target.checked)}>我已查看无法映射项，仅应用已映射和推导规则</Checkbox>}
          <Button type="primary" block loading={applying} disabled={result.requiresConfirmation || (result.hasUnmappedSegments && !acceptPartial) || (hasCurrentRules && !applyMode)} onClick={() => { void apply(); }}>应用到规则</Button>
        </section>}
      </>}
    </div>
  </Drawer>;
}
