import React, { useEffect, useState } from 'react';
import './App.css';
import API_BASE_URL from './api';

// Starter projects for the demo; changes are kept in memory until refresh.
const samples = [
  { id: '1', name: 'test project 1', description: 'testing the frontend', user: 'Austin', hours: 0, goal: 200 },
].map(project => ({ ...project, vote: 0, comments: [], file: '' }));

// Render a reusable SVG icon using the path associated with its name.
function Icon({ name }) {
  const paths = {
    home: 'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',
    user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-2a8 8 0 0 1 16 0v2',
    plus: 'M7 12h10M12 7v10M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2',
    exit: 'M10 3H3v18h7M8 12h13m-6-6 6 6-6 6',
    clock: 'M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    comment: 'M3 3h18v14H9l-6 4V3M7 7h10M7 11h10',
    edit: 'm14 4 6 6M4 16 17 3l4 4L8 20H4v-4M12 21h9',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    search: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

// Shared project details for the home list and contribution screen.
function ProjectSummary({ project }) {
  return <div className="project-summary"><div><h2>{project.name}</h2><p>{project.description}</p>{project.file && <small>Attachment: {project.file}</small>}</div><div className="project-meta"><span>{project.user}</span><span>{project.hours}hr contributed</span></div></div>;
}

// A supplied project pre-fills the form for editing; otherwise it creates one.
function ProjectForm({ project, onSave, onCancel }) {
  function submit(event) {
    event.preventDefault();
    // Read named fields and reject names or descriptions containing only spaces.
    const data = new FormData(event.currentTarget);
    const name = data.get('name').trim();
    const description = data.get('description').trim();
    if (!name || !description) return;
    // Keep only the filename, retaining the previous name if no file is selected.
    onSave({ name, description, goal: Number(data.get('goal')), file: data.get('file').name || project?.file || '' });
  }
  return <form className="project-form" onSubmit={submit}>
    <div className="project-form-panel">
      <label className="sr-only" htmlFor="project-name">Project name</label>
      <input id="project-name" name="name" className="project-name" placeholder="Enter Project name" defaultValue={project?.name || ''} required maxLength={100} pattern=".*\S.*" />
      <label htmlFor="description">Add description</label>
      <textarea id="description" name="description" defaultValue={project?.description || ''} required maxLength={1000} />
      <label htmlFor="goal">Goal (hours)</label>
      <input id="goal" name="goal" type="number" min="1" max="100000" required defaultValue={project?.goal || ''} />
      <label className="file-label">Upload image/file<input name="file" type="file" /></label>
      <small>Demo: only the filename is kept; files are not uploaded.</small>
    </div>
    <button className="gray-button" type="submit">{project ? 'Save changes' : 'Create'}</button>
    <button className="text-button" type="button" onClick={onCancel}>Cancel</button>
  </form>;
}

export default function App() {
  // Navigation and project data are local demo state, with no persistent storage.
  const [page, setPage] = useState('welcome');
  const [projects, setProjects] = useState(samples);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [hours, setHours] = useState('5');
  const [notice, setNotice] = useState('');
  const [commentsFor, setCommentsFor] = useState(null);
  const [backend, setBackend] = useState('Checking backend connection…');
  const [backendMessage, setBackendMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function sayHello() {
    setLoading(true);
    setBackendMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/hello`);

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const data = await response.json();
      setBackendMessage(data.message);
    } catch (error) {
      console.error(error);
      setBackendMessage('Could not connect to backend.');
    } finally {
      setLoading(false);
    }
  }
  // Check the backend on mount; cleanup cancels any pending request.
    useEffect(() => {
    const controller = new AbortController();
    
    fetch(`${API_BASE_URL}/api/hello`, {signal: controller.signal})
      .then(response => {
        if (!response.ok) throw new Error('Connection failed');
        return response.json();
      })
      .then(data => {
        // Change the connection status text to reflect that it successfully loaded
        setBackend('Connected to backend'); 
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          setBackend('Backend offline — demo still available');
        }
      });

    return () => controller.abort();
  }, []);

  // Clear feedback and close comments when navigating to another screen.
  function go(next) { setPage(next); setNotice(''); setCommentsFor(null); }
  // Merge changes into one project without mutating existing state objects.
  function update(id, change) { setProjects(current => current.map(p => p.id === id ? { ...p, ...change(p) } : p)); }
  const selectedProject = projects.find(p => p.id === selected);
  const titles = { home: 'Jump Start', mine: 'My Projects', create: editing ? 'Edit Project' : 'Create Project', contribute: 'Contribute' };

  // Welcome and account screens render outside the main workspace layout.
    if (page === 'welcome') {
    return (
      <main className="welcome-page" style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Jump Start</h1>

        <div className="welcome-actions" style={{ marginBottom: '20px' }}>
          <button className="blue-button" onClick={() => go('login')}>
            Log In
          </button>
          <button className="blue-button small" onClick={() => go('signup')}>
            Create Account
          </button>
        </div>

        <p className="backend-message">Connection status: {backend}</p>

        {/* FORCED VISIBILITY BUTTON */}
        <div style={{ marginTop: '30px', border: '1px dashed #ccc', padding: '15px' }}>
          <button 
            className="blue-button" 
            onClick={sayHello} 
            disabled={loading}
            style={{ background: 'blue', color: 'white', padding: '10px 20px', cursor: 'pointer' }}
          >
            {loading ? 'Connecting...' : 'Say Hello to Backend'}
          </button>
        </div>

        <p role="status" style={{ marginTop: '10px', fontWeight: 'bold' }}>
          Backend Response: {backendMessage || 'No message yet'}
        </p>
      </main>
    );
  }


  if (page === 'login' || page === 'signup') return <main className="account-page">
    <h1 className="sr-only">{page === 'login' ? 'Log In' : 'Create Account'}</h1>
    <form className="account-form" onSubmit={event => {
      event.preventDefault();
      // Temporary frontend flow: discard credentials until authentication is connected.
      event.currentTarget.reset();
      go('home');
    }}>
      <label className="sr-only" htmlFor="username">Username</label>
      <input id="username" name="username" placeholder={page === 'login' ? 'Enter username' : 'Create username'} autoComplete="username" required />
      <label className="sr-only" htmlFor="password">Password</label>
      <input id="password" name="password" type="password" placeholder={page === 'login' ? 'Enter password' : 'Create password'} autoComplete={page === 'login' ? 'current-password' : 'new-password'} required />
      <button className="blue-button">{page === 'login' ? 'Log In' : 'Create Account'}</button>
    </form><p className="notice" role="status">{notice}</p>
    <p className="demo-note">Frontend demo — accounts are not saved. Use made-up values.</p>
    <button className="text-button" onClick={() => go('welcome')}>Back to welcome</button>
  </main>;

  return <div className="app-shell">
    <header className="page-header"><h1>{titles[page]}</h1></header>
    <main className="content">
      <p className="demo-note">Demo workspace · sample projects · changes reset on refresh</p>
      <p className="notice" role="status">{notice}</p>
      {/* Search project names, descriptions, and owners without case sensitivity. */}
      {page === 'home' && <>
        <label className="search-bar">Search Projects<input type="search" value={search} onChange={e => setSearch(e.target.value)} /><Icon name="search" /></label>
        <section className="project-list" aria-label="Projects">
          {projects.filter(p => `${p.name} ${p.description} ${p.user}`.toLowerCase().includes(search.toLowerCase())).map(project => <article className="project-card" key={project.id}>
            <button className="contribute-link" onClick={() => { setSelected(project.id); setHours('5'); go('contribute'); }}><Icon name="clock" />Contribute</button>
            <div className="project-card-main"><ProjectSummary project={project} />
              {/* Clicking an active vote clears it; the opposite vote replaces it. */}
              <div className="project-actions">
                <button aria-label={`Upvote ${project.name}`} aria-pressed={project.vote === 1} onClick={() => update(project.id, p => ({ vote: p.vote === 1 ? 0 : 1 }))}>↑</button>
                <span aria-label="Vote score">{project.vote}</span>
                <button aria-label={`Downvote ${project.name}`} aria-pressed={project.vote === -1} onClick={() => update(project.id, p => ({ vote: p.vote === -1 ? 0 : -1 }))}>↓</button>
                <button className="comment-button" aria-label={`Comments for ${project.name}`} aria-expanded={commentsFor === project.id} onClick={() => setCommentsFor(commentsFor === project.id ? null : project.id)}><Icon name="comment" /><span>{project.comments.length}</span></button>
              </div>
              {commentsFor === project.id && <div className="comments"><h3>Comments</h3>{!project.comments.length && <p>No comments yet.</p>}{project.comments.map((comment, i) => <p key={i}>{comment}</p>)}<form onSubmit={e => { e.preventDefault(); const text = new FormData(e.currentTarget).get('comment').trim(); if (!text) return; update(project.id, p => ({ comments: [...p.comments, text] })); e.currentTarget.reset(); }}><input name="comment" aria-label="New comment" required maxLength={500} /><button className="gray-button">Post</button></form></div>}
            </div>
          </article>)}
          {!projects.some(p => `${p.name} ${p.description} ${p.user}`.toLowerCase().includes(search.toLowerCase())) && <p className="empty-state">No matching projects. Try another search.</p>}
        </section>
      </>}
      {/* Projects created in this demo belong to You and can be edited or deleted. */}
      {page === 'mine' && <section className="my-projects" aria-label="My projects">
        {projects.filter(p => p.user === 'You').map(project => <article className="owned-project" key={project.id}>
          <div className="manage-actions"><button aria-label={`Delete ${project.name}`} onClick={() => { if (window.confirm(`Delete ${project.name} from this demo?`)) { setProjects(projects.filter(p => p.id !== project.id)); setNotice('Project deleted.'); } }}><Icon name="trash" /></button><button aria-label={`Edit ${project.name}`} onClick={() => { setEditing(project); go('create'); }}><Icon name="edit" /></button></div>
          <div className="owned-summary"><h2>{project.name}</h2><p>{project.description}</p></div>
          <div className="progress"><div><span>0hr</span><span>Goal: {project.goal}hr</span></div><progress aria-label={`${project.name} progress`} value={Math.min(project.hours, project.goal)} max={project.goal} /><p>{project.hours}hr contributed</p></div>
        </article>)}
        {!projects.some(p => p.user === 'You') && <div className="empty-state"><p>You have no projects yet.</p><button className="gray-button" onClick={() => { setEditing(null); go('create'); }}>Create a project</button></div>}
      </section>}
      {/* The key resets form fields when switching between new and existing projects. */}
      {page === 'create' && <ProjectForm key={editing?.id || 'new'} project={editing} onCancel={() => go('mine')} onSave={values => {
        if (editing) update(editing.id, () => values);
        else setProjects([...projects, { ...values, id: crypto.randomUUID(), user: 'You', hours: 0, vote: 0, comments: [] }]);
        go('mine'); setNotice(editing ? 'Project updated in this demo.' : 'Project created in this demo.'); setEditing(null);
      }} />}
      {/* Validate preset or custom hours before adding them to the project total. */}
      {page === 'contribute' && selectedProject && <section className="contribution"><ProjectSummary project={selectedProject} />
        <form onSubmit={e => { e.preventDefault(); const amount = Number(hours === 'custom' ? new FormData(e.currentTarget).get('custom') : hours); if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) return; update(selected, p => ({ hours: p.hours + amount })); go('home'); setNotice(`${amount} hours added to ${selectedProject.name} in this demo.`); }}>
          <fieldset><legend className="sr-only">Hours to contribute</legend>{['5', '10', '20', 'custom'].map(value => <label key={value}><input type="radio" name="hours" checked={hours === value} onChange={() => setHours(value)} />{value === 'custom' ? 'Custom' : `${value}hr`}</label>)}</fieldset>
          {hours === 'custom' && <label className="custom-hours">Custom hours<input name="custom" type="number" min="0.5" max="10000" step="0.5" required /></label>}
          <button className="gray-button">Contribute hours</button>
        </form>
      </section>}
    </main>
    {/* Persistent workspace navigation; aria-current identifies the active screen. */}
    <nav className="bottom-nav" aria-label="Main navigation">
      <button aria-current={page === 'home' ? 'page' : undefined} onClick={() => go('home')}><Icon name="home" /><span>Home</span></button>
      <button aria-current={page === 'mine' ? 'page' : undefined} onClick={() => go('mine')}><Icon name="user" /><span>My Projects</span></button>
      <button className="create-nav" aria-current={page === 'create' ? 'page' : undefined} onClick={() => { setEditing(null); go('create'); }}><Icon name="plus" /><span>Create</span></button>
      <button className="exit-nav" onClick={() => go('welcome')}><Icon name="exit" /><span>Log Out</span></button>
    </nav>
  </div>;
}
