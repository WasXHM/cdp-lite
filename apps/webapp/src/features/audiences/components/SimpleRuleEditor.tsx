import { Alert, Select } from 'antd';
import { operators, operatorLabels, type Operator, type SimpleRule } from '@cdp/contracts';
import { useMetadata, useRuleCatalog } from '../hooks/useRuleCatalog';
import { RuleValueInput } from './RuleValueInput';
import { ErrorNotice } from '../../../components/Feedback';

export function SimpleRuleEditor({ rule, onChange }: { rule: SimpleRule; onChange: (rule: SimpleRule) => void }) {
  const catalog = useRuleCatalog(rule.metadataType);
  const detail = useMetadata(rule.metadataId);
  const options = (catalog.data || []).map(field => ({ value: field.id, label: field.name, disabled: false }));
  if (rule.metadataId && !options.some(option => option.value === rule.metadataId)) options.push({ value: rule.metadataId, label: `${detail.data?.name || rule.metadataId}（不可选）`, disabled: true });
  const field = detail.data;
  return <div className="simple-rule">
    <div className="condition-row">
      <Select aria-label="选择字段" className="field-select" showSearch optionFilterProp="label" loading={catalog.isPending} value={rule.metadataId || undefined} placeholder={`选择${rule.metadataType === 'TAG' ? '标签' : '属性'}`} options={options} onChange={metadataId => onChange({ ...rule, metadataId, operator: 'EQ', value: null })} />
      {field && <><Select aria-label="操作符" className="operator-select" value={rule.operator} options={operators[field.dataType].map(value => ({ value, label: operatorLabels[value] }))} onChange={(operator: Operator) => onChange({ ...rule, operator, value: ['IN', 'NOT_IN', 'BETWEEN'].includes(operator) ? [] : null })} /><RuleValueInput field={field} operator={rule.operator} value={rule.value} onChange={value => onChange({ ...rule, value })} /></>}
    </div>
    <ErrorNotice error={catalog.error || detail.error} />
    {field?.status === 'DISABLED' && <Alert type="warning" showIcon message="该字段已停用，原规则已保留；请重新选择后保存。" />}
  </div>;
}
