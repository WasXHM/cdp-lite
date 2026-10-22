import { Select } from 'antd';
import { operatorLabels, type EventRule, type Field, type Metric } from '@cdp/contracts';
import { RuleValueInput } from './RuleValueInput';

const numericField: Field = { id: '', name: '', fieldName: '', dataType: 'Number', displayType: 'NUMBER', isEnum: false, status: 'ENABLED', description: '' };
export function AggregationEditor({ rule, metrics, onChange }: { rule: EventRule; metrics: Metric[]; onChange: (rule: EventRule) => void }) {
  const metricOptions = metrics.map(metric => ({ value: metric.id, label: `${metric.name}${metric.status !== 'ENABLED' ? '（停用）' : ''}`, disabled: metric.status !== 'ENABLED' }));
  if (rule.aggregation.metricId && !metrics.some(metric => metric.id === rule.aggregation.metricId)) metricOptions.push({ value: rule.aggregation.metricId, label: `${rule.aggregation.metricId}（缺失）`, disabled: true });
  return <div className="condition-row">
    <Select aria-label="聚合方式" className="field-select" value={rule.aggregation.type} options={[{ value: 'COUNT', label: 'COUNT · 事件发生次数' }, { value: 'SUM', label: 'SUM · 指标求和' }, { value: 'AVG', label: 'AVG · 平均值' }, { value: 'MAX', label: 'MAX · 最大值' }, { value: 'MIN', label: 'MIN · 最小值' }]} onChange={type => onChange({ ...rule, aggregation: { type, metricId: null } })} />
    {rule.aggregation.type !== 'COUNT' && <Select aria-label="选择指标" className="field-select" placeholder="选择当前行为的指标" value={rule.aggregation.metricId || undefined} options={metricOptions} onChange={metricId => onChange({ ...rule, aggregation: { ...rule.aggregation, metricId } })} />}
    <Select aria-label="聚合操作符" className="operator-select" value={rule.operator} options={(['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN'] as const).map(value => ({ value, label: operatorLabels[value] }))} onChange={operator => onChange({ ...rule, operator, value: operator === 'BETWEEN' ? [0, 1] : 1 })} />
    <RuleValueInput field={numericField} operator={rule.operator} value={rule.value} onChange={value => onChange({ ...rule, value: value as EventRule['value'] })} />
  </div>;
}
