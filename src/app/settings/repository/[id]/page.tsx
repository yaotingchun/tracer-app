'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import styles from './repository.module.css';
import DependencyGraph from '@/components/settings/DependencyGraph';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Repo {
  id: string;
  fullName: string;
  ownerAvatar: string;
  description: string | null;
  customModules?: string[];
  businessDescription?: string;
  pdfFilename?: string;
  documentationText?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
}

// Default standard module tags
const DEFAULT_MODULES = [
  'payment', 'auth', 'user', 'dashboard', 'notification', 
  'search', 'media', 'admin', 'settings', 'orders', 'webhook', 'repository'
];

export default function RepositoryCustomizationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [repo, setRepo] = useState<Repo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [modules, setModules] = useState<string[]>([]);
  const [newModule, setNewModule] = useState('');
  const [businessDesc, setBusinessDesc] = useState('');
  const [pdfFilename, setPdfFilename] = useState('');
  const [documentationText, setDocumentationText] = useState('');
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Chat/RAG States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [agentTyping, setAgentTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch repository data
  useEffect(() => {
    if (!id) return;

    async function fetchRepo() {
      try {
        const res = await fetch(`/api/repositories/${id}`);
        if (!res.ok) throw new Error('Failed to fetch repo');
        const data: Repo = await res.json();
        setRepo(data);
        setModules(data.customModules ?? DEFAULT_MODULES);
        setBusinessDesc(data.businessDescription ?? '');
        setPdfFilename(data.pdfFilename ?? '');
        setDocumentationText(data.documentationText ?? '');
        
        // Add initial agent message welcoming the user
        setChatMessages([
          {
            id: 'init',
            sender: 'agent',
            text: `Hello! I am your Memory Agent for ${data.fullName}. Put details about the business or upload your PDF documentation, and I'll extract custom memories for RAG search!`
          }
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchRepo();
  }, [id]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, agentTyping]);

  // Dynamic memory extraction: parses text and splits into distinct statements
  const memoryNodes = useMemo(() => {
    const combinedText = `${businessDesc}\n${documentationText}`;
    if (!combinedText.trim()) return [];

    // Split by sentences and newlines, trim, and filter out short/empty lines
    return combinedText
      .split(/[.\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 15 && !s.toLowerCase().includes('welcome') && !s.toLowerCase().includes('hello'))
      .slice(0, 5); // display up to 5 key memory nodes
  }, [businessDesc, documentationText]);

  // RAG Search Handler
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || agentTyping) return;

    const userText = chatInput.trim();
    setChatInput('');

    // Add user message
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: userText
    };
    setChatMessages(prev => [...prev, userMsg]);
    setAgentTyping(true);

    // Simulate Agent processing delay (RAG lookup)
    setTimeout(() => {
      // 1. Gather all chunks
      const combinedText = `${businessDesc}\n${documentationText}`;
      const chunks = combinedText
        .split(/[.\n]+/)
        .map(s => s.trim())
        .filter(s => s.length > 10);

      // 2. Tokenize user query
      const stopWords = new Set(['what', 'is', 'are', 'who', 'the', 'does', 'how', 'do', 'in', 'on', 'at', 'for', 'to', 'a', 'an', 'this', 'that', 'of', 'and', 'our', 'we', 'company', 'about', 'can', 'you']);
      const queryWords = userText
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 1 && !stopWords.has(w));

      let bestChunk = '';
      let bestScore = 0;

      // 3. TF-IDF / Term overlap RAG score
      for (const chunk of chunks) {
        const chunkWords = new Set(
          chunk.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
        );

        let score = 0;
        for (const qw of queryWords) {
          if (chunkWords.has(qw)) {
            score += 1;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestChunk = chunk;
        }
      }

      let replyText = '';
      if (bestScore > 0) {
        replyText = `Based on the repository knowledge base:\n\n"${bestChunk}."`;
      } else {
        replyText = `I couldn't find a direct answer to your query in my memory nodes. Try asking about specific components or details mentioned in the business description or documentation.`;
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'agent',
          text: replyText
        }
      ]);
      setAgentTyping(false);
    }, 800);
  };

  // Add custom module tag
  const handleAddModule = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newModule.trim()) return;
    const cleanTag = newModule.trim().toLowerCase();
    if (!modules.includes(cleanTag)) {
      setModules(prev => [...prev, cleanTag]);
    }
    setNewModule('');
  };

  // Remove module tag
  const handleRemoveModule = (tagToRemove: string) => {
    setModules(prev => prev.filter(m => m !== tagToRemove));
  };

  // File selection for PDF upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // PDF Upload Action
  const handleUploadPdf = async () => {
    if (!selectedFile || !id) return;
    setUploadingPdf(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`/api/repositories/${id}/upload-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to extract PDF');
      const data = await res.json();
      
      setPdfFilename(data.filename);
      setDocumentationText(data.textLength ? `(Extracted ${data.textLength} chars from ${data.filename})` : 'No text content found in PDF.');
      setSelectedFile(null);

      // Refresh data
      const refreshRes = await fetch(`/api/repositories/${id}`);
      const updatedRepo: Repo = await refreshRes.json();
      setDocumentationText(updatedRepo.documentationText ?? '');
    } catch (err) {
      console.error(err);
      alert('Error parsing PDF. Please make sure the PDF has readable text.');
    } finally {
      setUploadingPdf(false);
    }
  };

  // Remove PDF documentation
  const handleRemovePdf = async () => {
    if (!confirm('Remove PDF documentation? This will delete the extracted knowledge base text.')) return;
    
    try {
      const res = await fetch(`/api/repositories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfFilename: '',
          documentationText: '',
        })
      });
      if (!res.ok) throw new Error('Failed to remove documentation');
      setPdfFilename('');
      setDocumentationText('');
    } catch (err) {
      console.error(err);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    if (!id) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/repositories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customModules: modules,
          businessDescription: businessDesc,
        }),
      });

      if (!res.ok) throw new Error('Failed to save settings');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
          <div className={styles.spinner} style={{ width: '40px', height: '40px' }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Loading repository customizations…</p>
        </div>
      </MainLayout>
    );
  }

  if (!repo) {
    return (
      <MainLayout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-error)' }}>Repository Not Found</h2>
          <p>The repository details could not be loaded. Please ensure it is connected in settings.</p>
          <Link href="/settings" className={styles.backLink} style={{ margin: '1rem auto' }}>← Back to Settings</Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className={styles.page}>
        <Link href="/settings" className={styles.backLink}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to Settings
        </Link>

        {/* Header */}
        <header className={styles.header}>
          <img src={repo.ownerAvatar} alt={repo.fullName} className={styles.repoAvatar} />
          <div className={styles.repoMeta}>
            <h1 className={styles.title}>{repo.fullName} Customizations</h1>
            <p className={styles.subtitle}>Build custom modules and knowledge bases to personalize your repositories.</p>
          </div>
        </header>

        {/* Customization Forms */}
        <div className={styles.grid}>
          
          {/* Left Column: Form customizers */}
          <div className={styles.column}>
            
            {/* Modules customization */}
            <section className={`${styles.card} ${styles.cardModules}`} aria-labelledby="modules-title">
              <div className={styles.cardHeader}>
                <div className={`${styles.iconWrapper} ${styles.iconWrapperModules}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </div>
                <div>
                  <h2 id="modules-title" className={styles.cardTitle}>
                    Custom Modules
                  </h2>
                  <p className={styles.cardDesc}>Define the architectural modules for this repository. Adjusting this directly affects the commit filter categories.</p>
                </div>
              </div>

              <div className={styles.modulesGrid}>
                {modules.map((tag) => (
                  <span key={tag} className={`${styles.moduleTag} ${styles.moduleTagActive}`}>
                    {tag}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveModule(tag)} 
                      className={styles.deleteBtn}
                      title={`Delete module "${tag}"`}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </span>
                ))}
                {modules.length === 0 && (
                  <span className={styles.moduleTag} style={{ fontStyle: 'italic', opacity: 0.7 }}>No custom modules defined. Add one below.</span>
                )}
              </div>

              <form onSubmit={handleAddModule} className={styles.addModuleRow}>
                <input 
                  type="text" 
                  value={newModule} 
                  onChange={(e) => setNewModule(e.target.value)} 
                  placeholder="new-module-name (e.g. billing, staging)..."
                  className={styles.input} 
                />
                <button type="submit" className={`${styles.btn} ${styles.btnSecondary}`}>
                  + Add Module
                </button>
              </form>
            </section>

            {/* Knowledge Base description and file uploads */}
            <section className={`${styles.card} ${styles.cardKb}`} aria-labelledby="kb-title">
              <div className={styles.cardHeader}>
                <div className={`${styles.iconWrapper} ${styles.iconWrapperKb}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                </div>
                <div>
                  <h2 id="kb-title" className={styles.cardTitle}>
                    Knowledge Base Settings
                  </h2>
                  <p className={styles.cardDesc}>Upload details about your company context. This is saved to power customized features and AI interactions.</p>
                </div>
              </div>

              {/* Text Business Description */}
              <div className={styles.businessDescWrapper}>
                <label htmlFor="business-desc" style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-secondary)' }}>
                  Business Description
                </label>
                <textarea
                  id="business-desc"
                  value={businessDesc}
                  onChange={(e) => setBusinessDesc(e.target.value)}
                  placeholder="Paste details about your business logic, custom workflows, or architecture definitions..."
                  className={`${styles.input} ${styles.textarea}`}
                />
              </div>

              {/* PDF Document Upload */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-secondary)' }}>
                  Repository PDF Documentation
                </label>

                {pdfFilename ? (
                  <div className={styles.fileStatus}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <strong>{pdfFilename}</strong> (Text parsed successfully)
                    </div>
                    <button type="button" onClick={handleRemovePdf} className={styles.fileRemove}>✕</button>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="pdf-upload" className={styles.fileUploadArea}>
                      <svg className={styles.uploadIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <span className={styles.uploadText}>
                        {selectedFile ? `Selected: ${selectedFile.name}` : 'Click to select PDF document'}
                      </span>
                      <span className={styles.uploadSub}>PDF format with readable text</span>
                      <input 
                        id="pdf-upload" 
                        type="file" 
                        accept=".pdf" 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                      />
                    </label>

                    {selectedFile && (
                      <button
                        type="button"
                        onClick={handleUploadPdf}
                        disabled={uploadingPdf}
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        style={{ width: '100%', marginTop: 'var(--space-2)' }}
                      >
                        {uploadingPdf ? 'Parsing and Uploading...' : 'Upload selected PDF'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Submit panel buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>

                {saveSuccess && (
                  <div className={styles.successOverlay}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Saved successfully!
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Memory Agent RAG Chatbot */}
          <div className={styles.column}>
            <section className={`${styles.card} ${styles.cardMemory}`} style={{ height: '100%' }} aria-labelledby="memory-title">
              <div className={styles.cardHeader}>
                <div className={`${styles.iconWrapper} ${styles.iconWrapperMemory}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M9 13a3 3 0 1 0-3-3"/><path d="M15 13a3 3 0 1 1 3-3"/></svg>
                </div>
                <div>
                  <h2 id="memory-title" className={styles.cardTitle}>
                    Memory Agent
                  </h2>
                  <p className={styles.cardDesc}>Interacts with knowledge and memories extracted from documentation files via RAG search.</p>
                </div>
              </div>

              <div className={styles.memoryAgent}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-secondary)' }}>
                  Extracted Memory Nodes (RAG Database)
                </label>
                <div className={styles.extractedList}>
                  {memoryNodes.map((node, i) => (
                    <div key={i} className={styles.memoryNode}>
                      <span className={styles.memoryBullet}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                      <span>{node}</span>
                    </div>
                  ))}
                  {memoryNodes.length === 0 && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                      No knowledge memories extracted yet. Paste a business description or upload a PDF on the left.
                    </div>
                  )}
                </div>

                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                  Query Agent Knowledge
                </label>
                
                {/* RAG Chat panel */}
                <div className={styles.chatContainer}>
                  {chatMessages.length === 0 ? (
                    <div className={styles.emptyChat}>
                      <svg className={styles.emptyChatIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      <p>Start a conversation with the Memory Agent to query this repository's knowledge base.</p>
                    </div>
                  ) : (
                    <div className={styles.chatMessages}>
                      {chatMessages.map((msg) => (
                        <div 
                          key={msg.id} 
                          className={`${styles.chatBubble} ${msg.sender === 'agent' ? styles.bubbleAgent : styles.bubbleUser}`}
                          style={{ whiteSpace: 'pre-wrap' }}
                        >
                          {msg.text}
                        </div>
                      ))}
                      
                      {agentTyping && (
                        <div className={`${styles.chatBubble} ${styles.bubbleAgent}`}>
                          <div className={styles.typingIndicator}>
                            <span className={styles.typingDot} />
                            <span className={styles.typingDot} />
                            <span className={styles.typingDot} />
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className={styles.chatInputRow}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask the Memory Agent (e.g. 'What handles payments?')..."
                      disabled={memoryNodes.length === 0 || agentTyping}
                      className={styles.chatInput}
                    />
                    <button 
                      type="submit" 
                      disabled={!chatInput.trim() || memoryNodes.length === 0 || agentTyping}
                      className={styles.chatSendBtn}
                      title="Send message"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                  </form>
                </div>
              </div>
            </section>
          </div>

        </div>

        {/* Dependency Graph — built from GitHub API, no clone */}
        <DependencyGraph repoId={id} />

      </div>
    </MainLayout>
  );
}
