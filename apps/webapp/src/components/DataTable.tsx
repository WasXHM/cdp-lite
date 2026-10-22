import { useEffect, useId, useRef, useState } from 'react';
import { Table, type TableProps } from 'antd';

export function DataTable<Row extends object>({ label, ...props }: TableProps<Row> & { label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const content = containerRef.current?.querySelector<HTMLElement>('.ant-table-content');
    if (!content) return;
    const update = () => {
      const scrollable = content.scrollWidth > content.clientWidth;
      setOverflow(scrollable);
      content.tabIndex = scrollable ? 0 : -1;
      content.setAttribute('role', 'region');
      content.setAttribute('aria-label', label);
      if (scrollable) content.setAttribute('aria-describedby', hintId);
      else content.removeAttribute('aria-describedby');
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => observer.disconnect();
  }, [label, hintId, props.dataSource, props.loading]);
  return <div ref={containerRef} className="table-region">
    {overflow && <p id={hintId} className="table-scroll-hint">左右滚动查看全部字段<span className="sr-only">；聚焦表格后可使用方向键</span></p>}
    <Table<Row> {...props} />
  </div>;
}
