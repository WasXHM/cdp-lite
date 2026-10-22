import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { Modal } from 'antd';

export function useLeaveGuard(dirty: boolean) {
  const bypass = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !bypass.current && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const dialog = Modal.confirm({
      title: '离开当前页面？', content: '未保存的修改将丢失。', okText: '放弃修改', cancelText: '继续编辑',
      onOk: () => blocker.proceed(), onCancel: () => blocker.reset(),
    });
    return () => dialog.destroy();
  }, [blocker]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty && !bypass.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  return () => { bypass.current = true; };
}
