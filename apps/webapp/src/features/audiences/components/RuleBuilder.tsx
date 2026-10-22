import { Button } from 'antd';
import { Plus } from '@phosphor-icons/react';
import type { AudienceRules, ValidationIssue } from '@cdp/contracts';
import { addGroup, addRule, removeGroup, removeRule, updateRule } from '../model/rules';
import { RuleGroup } from './RuleGroup';

export function RuleBuilder({ rules, onChange, issues }: { rules: AudienceRules; onChange: (rules: AudienceRules) => void; issues: ValidationIssue[] }) {
  return <div className="rule-builder">
    {rules.map((group, groupIndex) => <div key={groupIndex}>{groupIndex > 0 && <div className="or-connector"><span>OR</span></div>}<RuleGroup group={group} index={groupIndex} issues={issues} onAdd={type => onChange(addRule(rules, groupIndex, type))} onUpdate={(ruleIndex, rule) => onChange(updateRule(rules, groupIndex, ruleIndex, rule))} onRemove={ruleIndex => onChange(removeRule(rules, groupIndex, ruleIndex))} onDelete={() => onChange(removeGroup(rules, groupIndex))} /></div>)}
    {issues.filter(issue => issue.path === 'rules').map((issue, index) => <div key={index} className="field-errors">{issue.message}</div>)}
    <Button className="add-group" type="dashed" icon={<Plus size={17} />} disabled={rules.length >= 20} onClick={() => onChange(addGroup(rules))}>添加 OR 规则组</Button>
  </div>;
}
