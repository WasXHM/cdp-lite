import { Button, Popconfirm, Select } from 'antd';
import { Trash } from '@phosphor-icons/react';
import { operators, operatorLabels, type Dimension, type EventRule, type Operator } from '@cdp/contracts';
import { RuleValueInput } from './RuleValueInput';

export function DimensionFilterList({ dimensions, filters, onChange }: { dimensions: Dimension[]; filters: EventRule['dimensionFilters']; onChange: (filters: EventRule['dimensionFilters']) => void }) {
  const update = (index: number, patch: Partial<EventRule['dimensionFilters'][number]>) => onChange(filters.map((filter, position) => position === index ? { ...filter, ...patch } : filter));
  return <div className="dimension-filters">
    {filters.map((filter, index) => {
      const field = dimensions.find(dimension => dimension.id === filter.dimensionId);
      const options = dimensions.map(dimension => ({ value: dimension.id, label: `${dimension.name}${dimension.status !== 'ENABLED' ? '（停用）' : ''}`, disabled: dimension.status !== 'ENABLED' }));
      if (filter.dimensionId && !field) options.push({ value: filter.dimensionId, label: `${filter.dimensionId}（缺失）`, disabled: true });
      return <div key={index} className="condition-row dimension-row">
        <span className="and-label">{index ? 'AND' : '筛选'}</span>
        <Select aria-label="选择维度" className="field-select" placeholder="选择当前行为的维度" value={filter.dimensionId || undefined} options={options} onChange={dimensionId => update(index, { dimensionId, operator: 'EQ', value: null })} />
        {field && <><Select aria-label="维度操作符" className="operator-select" value={filter.operator} options={operators[field.dataType].map(value => ({ value, label: operatorLabels[value] }))} onChange={(operator: Operator) => update(index, { operator, value: ['IN', 'NOT_IN', 'BETWEEN'].includes(operator) ? [] : null })} /><RuleValueInput field={field} operator={filter.operator} value={filter.value} onChange={value => update(index, { value })} /></>}
        <Popconfirm title="删除此维度条件？" okText="删除" cancelText="取消" onConfirm={() => onChange(filters.filter((_, position) => position !== index))}><Button type="text" aria-label="删除维度条件" icon={<Trash size={16} />} /></Popconfirm>
      </div>;
    })}
    <Button type="dashed" onClick={() => onChange([...filters, { dimensionId: '', operator: 'EQ', value: null }])} disabled={filters.length >= 30}>添加维度条件</Button>
    {!filters.length && <span className="inline-note">可选，默认不过滤</span>}
  </div>;
}
