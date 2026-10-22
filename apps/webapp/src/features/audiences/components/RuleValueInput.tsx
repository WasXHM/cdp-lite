import { DatePicker, Input, InputNumber, Select, Space } from 'antd';
import dayjs from 'dayjs';
import type { Field, Operator, RuleValue } from '@cdp/contracts';

export function RuleValueInput({ field, operator, value, onChange }: { field: Field; operator: Operator; value: RuleValue; onChange: (value: RuleValue) => void }) {
  if (operator === 'IS_NULL' || operator === 'IS_NOT_NULL') return <span className="muted">无需输入值</span>;
  const multiple = operator === 'IN' || operator === 'NOT_IN';
  const values = Array.isArray(value) ? value : [];
  if (field.isEnum) {
    const options = (field.enumValues || []).map(option => ({ label: `${option.label}${option.status === 'DISABLED' ? '（已停用）' : ''}`, value: option.value, disabled: option.status === 'DISABLED' }));
    const selected = Array.isArray(value) ? value : value === null ? [] : [value];
    for (const code of selected) if (!options.some(option => option.value === code)) options.push({ label: `${code}（值缺失）`, value: code as string | number, disabled: true });
    if (operator !== 'BETWEEN') return <Select aria-label="规则值" className="value-input" mode={multiple ? 'multiple' : undefined} placeholder="选择枚举值" value={value as string | number | (string | number)[] | undefined} options={options} onChange={onChange} />;
  }
  const scalar = (current: RuleValue, change: (value: RuleValue) => void, label = '规则值') => {
    if (field.isEnum) return <Select aria-label={label} placeholder="选择边界" value={current as string | number} onChange={change} options={field.enumValues?.map(option => ({ label: option.label, value: option.value, disabled: option.status !== 'ENABLED' }))} />;
    if (field.dataType === 'Number') return <InputNumber aria-label={label} value={typeof current === 'number' ? current : null} onChange={change} placeholder="输入数值" />;
    if (field.dataType === 'Boolean') return <Select aria-label={label} value={typeof current === 'boolean' ? String(current) : undefined} onChange={selected => change(selected === 'true')} options={[{ value: 'true', label: '是 / true' }, { value: 'false', label: '否 / false' }]} />;
    if (field.dataType === 'Date' || field.dataType === 'DateTime') return <DatePicker aria-label={label} showTime={field.dataType === 'DateTime'} value={typeof current === 'string' && dayjs(current).isValid() ? dayjs(current) : null} onChange={date => change(date ? field.dataType === 'Date' ? date.format('YYYY-MM-DD') : date.toISOString() : null)} />;
    return <Input aria-label={label} value={typeof current === 'string' ? current : ''} onChange={event => change(event.target.value)} placeholder="输入值" maxLength={1000} />;
  };
  if (operator === 'BETWEEN') return <Space.Compact className="value-input range-input">{scalar(values[0] ?? null, first => onChange([first as string | number, values[1] as string | number]), '下界')}{scalar(values[1] ?? null, second => onChange([values[0] as string | number, second as string | number]), '上界')}</Space.Compact>;
  if (multiple) return <Select aria-label="规则值列表" className="value-input" mode="tags" placeholder="输入后按回车添加" value={values.map(String)} onChange={items => onChange(items.map(item => field.dataType === 'Number' ? item.trim() ? Number(item) : NaN : item))} />;
  return <div className="value-input">{scalar(value, onChange)}</div>;
}
