import { useEffect, useRef, useState } from 'react';
import { Button, Drawer } from 'antd';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Tag, UserCircle, Lightning, UsersThree, List } from '@phosphor-icons/react';
import logoUrl from '../../assets/logo.svg';

const links = [
  { path: '/audiences', label: '人群管理', icon: UsersThree },
  { path: '/metadata/tags', label: '标签管理', icon: Tag },
  { path: '/metadata/attributes', label: '属性管理', icon: UserCircle },
  { path: '/metadata/events', label: '行为模型', icon: Lightning },
];

function Navigation({ onNavigate, section }: { onNavigate?: () => void; section?: 'audiences' | 'metadata' }) {
  const visibleLinks = section ? links.filter(link => section === 'audiences' ? link.path === '/audiences' : link.path.startsWith('/metadata')) : links;
  return <>
    <div className="nav-label">{section === 'audiences' ? '人群管理' : section === 'metadata' ? '元数据管理' : '业务导航'}</div>
    <nav aria-label="主导航">{visibleLinks.map(link => <NavLink key={link.path} to={link.path} onClick={onNavigate} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><link.icon size={17} aria-hidden="true" />{section === 'audiences' ? '全部人群' : link.label}</NavLink>)}</nav>
  </>;
}

export function AppLayout() {
  const location = useLocation();
  const section = location.pathname.startsWith('/metadata') ? 'metadata' : 'audiences';
  const [navOpen, setNavOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const shell = shellRef.current;
    if (navOpen) shell?.setAttribute('inert', '');
    else shell?.removeAttribute('inert');
    return () => shell?.removeAttribute('inert');
  }, [navOpen]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setNavOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  return <>
    <div className="app-shell" ref={shellRef}>
      <a className="skip-link" href="#main-content">跳至主要内容</a>
      <header className="topbar">
        <div className="topbar-brand"><Button className="nav-trigger" ref={triggerRef} aria-label="打开导航" aria-expanded={navOpen} aria-controls={navOpen ? 'mobile-navigation' : undefined} icon={<List size={20} />} onClick={() => setNavOpen(true)} /><NavLink to="/audiences" className="brand"><img src={logoUrl} alt="" aria-hidden="true" /><span>CDP Lite</span></NavLink></div>
        <nav className="module-nav" aria-label="模块导航"><NavLink to="/audiences" className={section === 'audiences' ? 'active' : ''}>人群管理</NavLink><NavLink to="/metadata/tags" className={section === 'metadata' ? 'active' : ''}>元数据管理</NavLink></nav>
        <div className="topbar-account"><span className="workspace-name">默认工作空间</span><span className="account-name">本地管理员</span><span className="avatar" aria-hidden="true">管</span></div>
      </header>
      <aside className="sidebar"><Navigation section={section} /></aside>
      <div className="workspace">
        <main id="main-content" tabIndex={-1}><Outlet /></main>
      </div>
    </div>
    <Drawer placement="left" width="min(296px, calc(100vw - 24px))" open={navOpen} onClose={() => setNavOpen(false)} destroyOnClose rootClassName="navigation-drawer" afterOpenChange={open => { if (!open) triggerRef.current?.focus(); }}>
      <div id="mobile-navigation" className="mobile-navigation"><Navigation onNavigate={() => setNavOpen(false)} /></div>
    </Drawer>
  </>;
}
