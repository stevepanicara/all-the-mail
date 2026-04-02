import React from 'react';
import { Mail, ChevronLeft, ChevronRight } from 'lucide-react';

const CATEGORIES = [
  { key: 'primary', label: 'Primary' },
  { key: 'social', label: 'Social' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'sent', label: 'Sent' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'trash', label: 'Trash' },
];

const Sidebar = ({
  sidebarCollapsed, setSidebarCollapsed,
  activeCategory, setActiveCategory,
  categoryCounts,
  openCompose, clearSelection,
  setSelectedEmail, setSelectedThread, setSelectedThreadActiveMessageId,
  setEditMode, setFullPageReaderOpen,
}) => {
  const handleCategoryClick = (key) => {
    setActiveCategory(key);
    setSelectedEmail(null);
    setSelectedThread(null);
    setSelectedThreadActiveMessageId(null);
    setEditMode(false);
    clearSelection();
    setFullPageReaderOpen(false);
  };

  return (
    <div className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`} style={{ width: '100%' }}>
      <div style={{ padding: '10px 16px 0', display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-end' }}>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: '4px', display: 'flex', alignItems: 'center' }}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
      <div style={{ padding: '10px 16px 16px' }}>
        <button className="btn-compose" style={{ width: '100%', padding: sidebarCollapsed ? '0' : '0 14px' }} onClick={() => openCompose('compose')} title="New message">
          {sidebarCollapsed ? <Mail size={16} /> : 'New message'}
        </button>
      </div>
      <div style={{ padding: '0 0 24px' }}>
        {CATEGORIES.map(({ key, label }) => (
          <button key={key}
            onClick={() => handleCategoryClick(key)}
            className={`category-btn${activeCategory === key ? ' active' : ''}`}
            title={sidebarCollapsed ? label : undefined}
            style={{ width: '100%', padding: sidebarCollapsed ? '10px 0' : '9px 20px', textAlign: sidebarCollapsed ? 'center' : 'left', display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between', background: 'transparent', border: 'none', cursor: 'pointer', color: activeCategory === key ? 'var(--text-0)' : 'var(--text-2)', position: 'relative', fontSize: '13px', fontWeight: activeCategory === key ? 500 : 400, fontFamily: 'inherit' }}>
            {sidebarCollapsed ? <span>{label.charAt(0)}</span> : <><span className="category-label">{label}</span><span className="category-count">{categoryCounts[key] || ''}</span></>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
