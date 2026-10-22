import { Form, Input, Select, Switch } from 'antd';
import { dataTypeSchema, displayTypes, type DataType } from '@cdp/contracts';

const displayLabels: Record<string, string> = { TEXT: '文本输入', NUMBER: '数字输入', SELECT: '下拉单选', MULTI_SELECT: '下拉多选', BOOLEAN: '布尔选择', DATE: '日期选择', DATETIME: '日期时间' };
export function MetadataFields({ editing = false }: { editing?: boolean }) {
  const form = Form.useFormInstance();
  const dataType = (Form.useWatch('dataType', form) || 'String') as DataType;
  const isEnum = Form.useWatch('isEnum', form) || false;
  return <div className="form-grid">
    <Form.Item label="名称" name="name" rules={[{ required: true, whitespace: true, max: 100 }]}><Input placeholder="例如：会员等级" maxLength={100} /></Form.Item>
    <Form.Item label="字段名称" name="fieldName" tooltip="创建后不可修改" rules={[{ required: true, pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: '以字母开头，仅含字母、数字和下划线' }]}><Input disabled={editing} placeholder="例如：member_level" maxLength={64} /></Form.Item>
    <Form.Item label="数据类型" name="dataType" rules={[{ required: true }]}><Select disabled={editing} options={dataTypeSchema.options.map(value => ({ value, label: value }))} onChange={(value: DataType) => form.setFieldsValue({ displayType: displayTypes[value][0], isEnum: false })} /></Form.Item>
    <Form.Item label="是否枚举" name="isEnum" valuePropName="checked" tooltip="保存后维护枚举值；创建后不可修改"><Switch disabled={editing || !['String', 'Number'].includes(dataType)} onChange={checked => form.setFieldValue('displayType', checked ? 'SELECT' : displayTypes[dataType][0])} /></Form.Item>
    <Form.Item label="展示类型" name="displayType" rules={[{ required: true }]}><Select options={displayTypes[dataType].filter(value => isEnum === ['SELECT', 'MULTI_SELECT'].includes(value)).map(value => ({ value, label: displayLabels[value] }))} /></Form.Item>
    <Form.Item label="状态" name="status"><Select options={[{ value: 'ENABLED', label: '启用' }, { value: 'DISABLED', label: '停用' }]} /></Form.Item>
    <Form.Item className="full-width" label="描述" name="description"><Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} maxLength={1000} placeholder="选填" /></Form.Item>
  </div>;
}
