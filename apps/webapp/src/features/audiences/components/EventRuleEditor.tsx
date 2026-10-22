import { Alert, Select, Skeleton } from 'antd';
import { timeRangeSchema, type EventRule } from '@cdp/contracts';
import { useEvent, useRuleCatalog } from '../hooks/useRuleCatalog';
import { changeEventModel } from '../model/rules';
import { EventTimeRangeField } from './EventTimeRangeField';
import { DimensionFilterList } from './DimensionFilterList';
import { AggregationEditor } from './AggregationEditor';
import { ErrorNotice } from '../../../components/Feedback';

export function EventRuleEditor({ rule, onChange }: { rule: EventRule; onChange: (rule: EventRule) => void }) {
  const catalog = useRuleCatalog('EVENT');
  const detail = useEvent(rule.eventId);
  const event = detail.data;
  const options = (catalog.data || []).map(item => ({ value: item.id, label: item.name, disabled: false }));
  if (rule.eventId && !options.some(option => option.value === rule.eventId)) options.push({ value: rule.eventId, label: `${event?.name || rule.eventId}（不可选）`, disabled: true });
  const timeValid = timeRangeSchema.safeParse(rule.timeRange).success;
  return <div className="event-rule-editor">
    <div className="event-step"><div className="step-label">行为模型</div><Select aria-label="选择行为模型" showSearch optionFilterProp="label" className="field-select" placeholder="选择行为模型" value={rule.eventId || undefined} options={options} loading={catalog.isPending} onChange={eventId => onChange(changeEventModel(rule, eventId))} /></div>
    <ErrorNotice error={catalog.error || detail.error} />
    {rule.eventId && detail.isPending && <Skeleton active paragraph={{ rows: 2 }} />}
    {event && <><div className="event-step"><div className="step-label">时间范围</div><EventTimeRangeField value={rule.timeRange} onChange={timeRange => onChange({ ...rule, timeRange })} /></div>
      {event.status === 'DISABLED' && <Alert type="warning" message="该行为模型已停用，原规则保留；请重新选择后保存。" showIcon />}
      {timeValid && event.status === 'ENABLED' ? <>
        <div className="event-step"><div className="step-label">维度筛选</div><DimensionFilterList dimensions={event.dimensions || []} filters={rule.dimensionFilters} onChange={dimensionFilters => onChange({ ...rule, dimensionFilters })} /></div>
        <div className="event-step"><div className="step-label">聚合判断</div><AggregationEditor rule={rule} metrics={event.metrics || []} onChange={onChange} /></div>
      </> : <div className="step-placeholder">请先设置行为模型和时间范围</div>}
    </>}
  </div>;
}
