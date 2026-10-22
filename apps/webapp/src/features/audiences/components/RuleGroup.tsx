import { Button, Popconfirm } from 'antd';
import type { AudienceRule, ValidationIssue } from '@cdp/contracts';
import { RuleItem } from './RuleItem';
import { RuleTypeSelector } from './RuleTypeSelector';

export function RuleGroup({ group, index, issues, onAdd, onUpdate, onRemove, onDelete }: { group: AudienceRule[]; index: number; issues: ValidationIssue[]; onAdd: (type: AudienceRule['metadataType']) => void; onUpdate: (ruleIndex: number, rule: AudienceRule) => void; onRemove: (ruleIndex: number) => void; onDelete: () => void }) {
  return <section className="rule-group">
    <div className="group-heading"><div><strong>规则组 <span className="numeric">{index + 1}</span></strong><span className="group-hint">AND</span></div><Popconfirm title="删除整个规则组？" okText="删除" cancelText="取消" onConfirm={onDelete}><Button type="text" size="small">删除规则组</Button></Popconfirm></div>
    <div className="group-body">{group.map((rule, ruleIndex) => <div key={ruleIndex}>{ruleIndex > 0 && <div className="and-connector"><span>AND</span></div>}<RuleItem rule={rule} onChange={updated => onUpdate(ruleIndex, updated)} onRemove={() => onRemove(ruleIndex)} path={`rules[${index}][${ruleIndex}]`} issues={issues} /></div>)}
      {!group.length && <div className="group-empty">请添加规则</div>}
      <div className="add-rule">{group.length < 50 && <RuleTypeSelector onChange={onAdd} />}</div>
      {issues.filter(issue => issue.path === `rules[${index}]`).map((issue, position) => <div className="field-errors" key={position}>{issue.message}</div>)}
    </div>
  </section>;
}
