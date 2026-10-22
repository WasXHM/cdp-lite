import { DatePicker, InputNumber, Segmented, Space } from 'antd';
import dayjs from 'dayjs';
import type { EventRule } from '@cdp/contracts';

export function EventTimeRangeField({ value, onChange }: { value: EventRule['timeRange']; onChange: (value: EventRule['timeRange']) => void }) {
  return <Space wrap>
    <Segmented aria-label="时间范围类型" value={value.type} options={[{ value: 'RELATIVE', label: '最近 N 天' }, { value: 'ABSOLUTE', label: '指定时间' }]} onChange={type => onChange(type === 'RELATIVE' ? { type, unit: 'DAY', value: 0 } : { type: 'ABSOLUTE', start: '', end: '' })} />
    {value.type === 'RELATIVE' ? <Space><InputNumber aria-label="最近天数" min={1} max={36500} precision={0} placeholder="天数" value={value.value || null} onChange={days => onChange({ ...value, value: days || 0 })} /><span>天</span></Space> :
      <DatePicker.RangePicker aria-label="绝对时间范围" showTime value={[value.start ? dayjs(value.start) : null, value.end ? dayjs(value.end) : null]} onChange={dates => onChange({ ...value, start: dates?.[0]?.toISOString() || '', end: dates?.[1]?.toISOString() || '' })} />}
  </Space>;
}
