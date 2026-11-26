import { useState } from 'react';
import { Alert, Button, Form, Input } from 'antd';
import { LockKey, User } from '@phosphor-icons/react';
import type { AuthLoginInput, AuthUser } from '@cdp/contracts';
import logoUrl from '../../../assets/logo.svg';
import { ApiError } from '../../lib/api';
import { login } from '../../lib/auth';

export function LoginPage({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (values: AuthLoginInput) => {
    setSubmitting(true);
    setError('');
    try {
      onAuthenticated(await login(values));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : '登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="login-page">
    <section className="login-panel" aria-labelledby="login-title">
      <div className="login-brand"><img src={logoUrl} alt="" aria-hidden="true" /><span>CDP Lite</span></div>
      <div className="login-heading">
        <p>用户身份校验</p>
        <h1 id="login-title">登录工作空间</h1>
        <span>使用管理员分配的用户名和密码继续。</span>
      </div>
      {error && <Alert type="error" showIcon message={error} />}
      <Form<AuthLoginInput> layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
          <Input prefix={<User size={16} aria-hidden="true" />} autoComplete="username" autoFocus maxLength={64} />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
          <Input.Password prefix={<LockKey size={16} aria-hidden="true" />} autoComplete="current-password" maxLength={256} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>登录</Button>
      </Form>
      <p className="login-help">如需创建或重置账号，请在服务端运行管理员账号命令。</p>
    </section>
  </main>;
}
