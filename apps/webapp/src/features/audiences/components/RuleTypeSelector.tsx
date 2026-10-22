import { Button, Dropdown, Select } from 'antd';
import { Plus } from '@phosphor-icons/react';
import type { AudienceRule } from '@cdp/contracts';

const types = [{ value: 'TAG', label: '标签' }, { value: 'ATTRIBUTE', label: '属性' }, { value: 'EVENT', label: '行为模型' }];
export function RuleTypeSelector({ value, onChange }: { value?: AudienceRule['metadataType']; onChange: (type: AudienceRule['metadataType']) => void }) {
  if (value) return <Select aria-label="规则类型" className="rule-type-select" value={value} options={types} onChange={onChange} />;
  return <Dropdown trigger={['click']} menu={{ items: types.map(type => ({ key: type.value, label: type.label })), onClick: ({ key }) => onChange(key as AudienceRule['metadataType']) }}><Button icon={<Plus size={15} />}>添加规则</Button></Dropdown>;
}
