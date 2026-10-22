import { Button, Popconfirm } from 'antd';
import { Trash } from '@phosphor-icons/react';
import type { AudienceRule, ValidationIssue } from '@cdp/contracts';
import { SimpleRuleEditor } from './SimpleRuleEditor';
import { EventRuleEditor } from './EventRuleEditor';
import { RuleTypeSelector } from './RuleTypeSelector';
import { createRule } from '../model/rules';
import { Issues } from '../../../components/Feedback';

export function RuleItem({ rule, onChange, onRemove, path, issues }: { rule: AudienceRule; onChange: (rule: AudienceRule) => void; onRemove: () => void; path: string; issues: ValidationIssue[] }) {
  return <div className={`rule-item ${rule.metadataType === 'EVENT' ? 'event-item' : 'simple-item'}`}>
    <div className="rule-item-header"><RuleTypeSelector value={rule.metadataType} onChange={type => onChange(createRule(type))} /><Popconfirm title="删除这条规则？" okText="删除" cancelText="取消" onConfirm={onRemove}><Button type="text" aria-label="删除规则" icon={<Trash size={16} />} /></Popconfirm></div>
    {rule.metadataType === 'EVENT' ? <EventRuleEditor rule={rule} onChange={onChange} /> : <SimpleRuleEditor rule={rule} onChange={onChange} />}
    <Issues issues={issues} path={path} />
  </div>;
}
