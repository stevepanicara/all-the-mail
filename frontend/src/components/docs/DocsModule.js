import React from 'react';
import { Search, Clock, Share2, Star, Trash2, FileText, ExternalLink, Plus } from 'lucide-react';
import { Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { FILE_TYPES } from '../../utils/constants';
import { formatRelativeEdit, getDocIcon, getDocEditUrl, getDocEditorLabel } from '../../utils/helpers';

const DocsModule = ({
  filteredDocs,
  selectedDoc, setSelectedDoc,
  docsCategory, setDocsCategory,
  docsSearchQuery, setDocsSearchQuery,
  docsSortBy, docsSortDir, toggleDocsSort,
  isLoadingDocs,
  hasDocsError,
  connectedAccounts,
  handleAddAccount,
}) => {
  const anyHasDocs = connectedAccounts.some(a => a.granted_scopes?.includes('docs'));

  return (
    <>
      <Panel defaultSize="15%" minSize="12%" maxSize="22%" id="sidebar-docs">
        <div className="sidebar" style={{ width: '100%' }}>
          <div style={{ padding: '16px 16px 16px' }}><div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>All the docs</div></div>
          <div style={{ padding: '0 0 24px' }}>
            {[{key:'recent',label:'Recent',icon:Clock},{key:'shared',label:'Shared with me',icon:Share2},{key:'starred',label:'Starred',icon:Star},{key:'trash',label:'Trash',icon:Trash2}].map(({key,label,icon:Icon}) => (
              <button key={key} onClick={()=>{setDocsCategory(key);setSelectedDoc(null);}}
                className={`category-btn${docsCategory===key?' active':''}`}
                style={{ width:'100%',padding:'9px 20px',textAlign:'left',display:'flex',alignItems:'center',gap:'8px',background:'transparent',border:'none',cursor:'pointer',color:docsCategory===key?'var(--text-0)':'var(--text-2)',position:'relative',fontSize:'13px',fontWeight:docsCategory===key?500:400,fontFamily:'inherit' }}>
                <Icon size={14} strokeWidth={1.5} /><span className="category-label">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </Panel>
      <PanelResizeHandle className="panel-resize-handle" />
      <Panel defaultSize="40%" minSize="28%" id="docs-list">
        <div style={{ height: '100%', overflow: 'auto', background: 'var(--surface-list)' }}>
          <div style={{ borderBottom: '1px solid var(--line-0)', padding: '12px 20px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-1)' }}>{docsCategory.charAt(0).toUpperCase() + docsCategory.slice(1)}</span>
            <div style={{ marginTop: '8px' }}>
              <div className="search-pill"><Search size={14} /><input value={docsSearchQuery} onChange={e => setDocsSearchQuery(e.target.value)} placeholder="Search documents..." /></div>
            </div>
          </div>
          <div className="doc-row" style={{ minHeight: '34px', cursor: 'default', borderBottom: '1px solid var(--line-0)' }}>
            <div />
            <div style={{ fontSize: '11px', color: docsSortBy === 'name' ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleDocsSort('name')}>Title {docsSortBy === 'name' ? (docsSortDir === 'asc' ? '\u2191' : '\u2193') : ''}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 500 }}>Owner</div>
            <div style={{ fontSize: '11px', color: docsSortBy === 'lastEdited' ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 500, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleDocsSort('lastEdited')}>Last edited {docsSortBy === 'lastEdited' ? (docsSortDir === 'asc' ? '\u2191' : '\u2193') : ''}</div>
            <div style={{ fontSize: '11px', color: docsSortBy === 'date' ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 500, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleDocsSort('date')}>Date {docsSortBy === 'date' ? (docsSortDir === 'asc' ? '\u2191' : '\u2193') : ''}</div>
          </div>
          {isLoadingDocs && filteredDocs.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => (<div className="skeleton-row" key={`dsk-${i}`} style={{ minHeight: 48 }}><div className="skeleton-block" style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0 }} /><div className="skeleton-block" style={{ flex: 1 }} /><div className="skeleton-block" style={{ width: 80 }} /><div className="skeleton-block" style={{ width: 64 }} /></div>))
          ) : (!anyHasDocs || hasDocsError) && filteredDocs.length === 0 ? (
            <div className="connect-cta">
              <FileText size={32} strokeWidth={1.5} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{anyHasDocs ? 'Drive permissions need updating' : 'Connect Google Drive'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: 16, maxWidth: 260 }}>{anyHasDocs ? 'Re-grant Drive access to restore your documents. You\'ll be asked to approve permissions again.' : 'Grant Drive permissions to see your documents here'}</div>
              <button className="btn-ghost" onClick={handleAddAccount} style={{ fontSize: '12px' }}><Plus size={14} strokeWidth={1.5} /> {anyHasDocs ? 'Re-authorize Drive' : 'Connect account'}</button>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}><FileText size={28} style={{ margin: '0 auto 10px', opacity: 0.05, display: 'block' }} /><div style={{ color: 'var(--text-2)', fontSize: '13px' }}>No documents in {docsCategory}</div></div>
          ) : filteredDocs.map(doc => {
            const DocIcon = getDocIcon(doc.mimeType);
            return (
              <div key={doc.id} className={`doc-row${selectedDoc?.id===doc.id?' active':''}`} onClick={()=>setSelectedDoc(doc)}>
                <div className="row-icon-slot"><DocIcon size={14} strokeWidth={1.5} style={{ color: 'var(--text-2)' }} /></div>
                <div className="doc-col-title">{doc.title}</div>
                <div className="doc-col-owner">{doc.owner}</div>
                <div className="doc-col-edited">{formatRelativeEdit(doc.lastEdited)}</div>
                <div className="doc-col-date">{new Date(doc.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
              </div>
            );
          })}
        </div>
      </Panel>
      <PanelResizeHandle className="panel-resize-handle" />
      <Panel minSize="26%" id="docs-detail">
        <div style={{ height: '100%', background: 'var(--surface-detail)', overflow: 'auto' }}>
          {selectedDoc ? (() => {
            const DetailIcon = getDocIcon(selectedDoc.mimeType);
            // Pass owning-account email so ?authuser= switches Google to
            // the right account when multi-account users open the doc.
            const ownerAccount = connectedAccounts.find(a => a.id === selectedDoc.accountId);
            const editUrl = getDocEditUrl(selectedDoc, ownerAccount?.gmail_email);
            const editorLabel = getDocEditorLabel(selectedDoc.mimeType);
            const fileType = FILE_TYPES[selectedDoc.mimeType];
            return (
              <div className="email-detail-content">
                <div style={{ padding: '24px 32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: 'var(--r-sm)', background: 'var(--accent-weak)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><DetailIcon size={18} strokeWidth={1.5} style={{ color: 'var(--accent)' }} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}><h1 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-0)', margin: 0 }}>{selectedDoc.title}</h1></div>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', fontSize: '12px', color: 'var(--text-2)' }}>
                    <span>Owner: <span style={{ color: 'var(--text-1)' }}>{selectedDoc.owner}</span></span>
                    <span>{formatRelativeEdit(selectedDoc.lastEdited)}</span>
                    <span>{new Date(selectedDoc.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div style={{ height: '1px', background: 'var(--line-0)', marginBottom: '24px' }} />
                  {editUrl && (<button className="btn-ghost btn-edit-doc" onClick={() => window.open(editUrl, '_blank', 'noopener,noreferrer')} style={{ marginBottom: '20px', fontSize: '13px', gap: '6px' }}><ExternalLink size={14} strokeWidth={1.5} /> Edit in {editorLabel}</button>)}
                  <div style={{ background: 'var(--bg-3)', borderRadius: '8px', padding: '20px', border: '1px solid var(--line-0)', minHeight: '200px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Type</span><span style={{ color: 'var(--text-1)' }}>{fileType?.label || 'Document'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Shared</span><span style={{ color: 'var(--text-1)' }}>{selectedDoc.shared ? 'Yes' : 'No'}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-2)' }}>Starred</span><span style={{ color: 'var(--text-1)' }}>{selectedDoc.starred ? 'Yes' : 'No'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="empty-state"><div style={{ textAlign: 'center' }}><FileText size={72} style={{ display: 'block', margin: '0 auto 16px', opacity: 0.04 }} /><div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-2)', marginBottom: '4px' }}>Select a document</div><div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Choose a doc from the list to preview</div></div></div>
          )}
        </div>
      </Panel>
    </>
  );
};

export default DocsModule;
