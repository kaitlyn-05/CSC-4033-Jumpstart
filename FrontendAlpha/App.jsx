
import React, { useEffect, useState } from 'react';
import './App.css';

// Create a safe fingerprint of a JWT without displaying the JWT itself.
async function getTokenFingerprint(token) {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 12);
}

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

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

// Shared project details for the home list and contribution screen.
function ProjectSummary({ project }) {
  return (
    <div className="project-summary">
      <div>
        <h2>{project.name}</h2>
        <p>{project.description}</p>
        {project.file && <small>Attachment: {project.file}</small>}
      </div>
      <div className="project-meta">
        <span>{project.user}</span>
        <span>{project.hours}hr completed</span>
      </div>
    </div>
  );
}

// A supplied project pre-fills the form for editing; otherwise it creates one.
function ProjectForm({ project, onSave, onCancel, saving }) {
  function submit(event) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const name = data.get('name').trim();
    const description = data.get('description').trim();

    if (!name || !description) return;

    onSave({
      name,
      description,
      goal: Number(data.get('goal')),
    });
  }

  return (
    <form className="project-form" onSubmit={submit}>
      <div className="project-form-panel">
        <label className="sr-only" htmlFor="project-name">Project name</label>
        <input
          id="project-name"
          name="name"
          className="project-name"
          placeholder="Enter Project name"
          defaultValue={project?.name || ''}
          required
          maxLength={120}
          pattern=".*\S.*"
        />

        <label htmlFor="description">Add description</label>
        <textarea
          id="description"
          name="description"
          defaultValue={project?.description || ''}
          required
          maxLength={2000}
        />

        <label htmlFor="goal">Goal (hours)</label>
        <input
          id="goal"
          name="goal"
          type="number"
          min="0.01"
          max="99999.99"
          step="0.01"
          required
          defaultValue={project?.goal || ''}
        />
      </div>

      <button className="gray-button" type="submit" disabled={saving}>
        {saving ? 'Saving…' : project ? 'Save changes' : 'Create'}
      </button>
      <button className="text-button" type="button" disabled={saving} onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

// Preserve the project's existing relative /api routing and deployment configuration.
const API_BASE = '/api';

export default function App() {
  const [page, setPage] = useState('welcome');
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [backendMessage, setBackendMessage] = useState('');
  const [helloLoading, setHelloLoading] = useState(false);
  const [commentsFor, setCommentsFor] = useState(null);
  const [backend, setBackend] = useState('Not checked');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Keep the JWT in browser storage so a page refresh does not automatically log out.
  const [token, setToken] = useState(
    () => localStorage.getItem('jumpstartToken') || ''
  );

  // Information about the currently logged-in user.
  const [currentUser, setCurrentUser] = useState(null);

  const [listPage, setListPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [reload, setReload] = useState(0);

  // Get the ID from the authenticated user instead of using a hardcoded ID.
  const currentUserId = currentUser ? String(currentUser.user_id) : '';

  // Verify a saved token when the app loads or when a new token is received.
  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      return;
    }

    let cancelled = false;

    async function verifyLogin() {
      try {
        // Diagnostic: fingerprint the token being sent to the backend.
        console.log(
          'FRONTEND verification token fingerprint:',
          await getTokenFingerprint(token)
        );

        const response = await fetch(API_BASE + '/users/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Your login has expired.');
        }

        if (!cancelled) {
          setCurrentUser(data.user);
          setPage('home');
        }
      } catch (error) {
        if (!cancelled) {
          localStorage.removeItem('jumpstartToken');
          setToken('');
          setCurrentUser(null);
          setPage('welcome');
          setNotice(error.message || 'Please log in again.');
        }
      }
    }

    verifyLogin();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Data mapping stays in this file; no helper file is required.
  function mapProject(p) {
    return {
      id: p.project_id,
      ownerId: p.owner_id,
      categoryId: p.category_id,
      name: p.project_name,
      description: p.description,
      user: p.username || 'Creator',
      goal: Number(p.goal_hours),
      status: p.status,
      hours: Number(p.total_hours_completed || 0),
      pledgedHours: Number(p.total_hours_committed || 0),
      contributors: [],
      file: '',
      vote: 0,
      comments: [],
    };
  }

  function go(next) {
    if (saving) return;
    setPage(next);
    setNotice('');
    setCommentsFor(null);
  }

  const ownerFilter = page === 'mine'
    ? String(Number(currentUserId) || 0)
    : '';

  // Load public projects, or only the current user's projects on My Projects.
  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setNotice('');

      try {
        if (ownerFilter === '0') {
          setProjects([]);
          setTotalPages(0);
          return;
        }

        const collected = [];
        let requestPage = ownerFilter ? 1 : listPage;
        let pages = 0;

        do {
          const query = new URLSearchParams({
            page: String(requestPage),
            limit: '20',
            search,
          });

          if (ownerFilter) query.set('owner_id', ownerFilter);

          const response = await fetch(
            API_BASE + '/projects?' + query,
            {
              signal: controller.signal,
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
          );

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Could not load projects.');
          }

          if (controller.signal.aborted) return;

          collected.push(...data.projects.map(mapProject));
          pages = Number(data.totalPages) || 0;
          requestPage += 1;
        } while (ownerFilter && requestPage <= pages);

        setProjects(collected);
        setTotalPages(pages);
        setBackend('Connected to project API');
      } catch (error) {
        if (!controller.signal.aborted) {
          setProjects([]);
          setTotalPages(0);
          setNotice(error.message);
          setBackend('Project API unavailable');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [listPage, search, reload, ownerFilter, token]);

  // Send project data to the backend with the user's JWT.
  async function saveProject(values) {
    if (saving) return;

    const owner = Number(currentUserId);

    if (!token || !currentUser || !Number.isInteger(owner) || owner < 1) {
      setNotice('Please log in before creating or editing a project.');
      return;
    }

    setSaving(true);
    setNotice('');

    try {
      const response = await fetch(
        API_BASE + '/projects' + (editing ? '/' + editing.id : ''),
        {
          method: editing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            project_name: values.name,
            description: values.description,
            goal_hours: values.goal,
            owner_id: owner,
            category_id: editing?.categoryId ?? null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not save project.');
      }

      const saved = mapProject({
        ...data.project,
        username: editing?.user || currentUser.username,
      });

      setSelected(saved);
      setEditing(null);
      setPage('details');
      setNotice('Project saved to the database.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  }

  // Log in an existing user or register a new user.
  async function handleAccountSubmit(event) {
    event.preventDefault();

    if (accountLoading) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const isSignup = page === 'signup';
    const endpoint = isSignup ? '/users/register' : '/users/login';

    const accountData = {
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || ''),
    };

    if (isSignup) {
      accountData.username = String(formData.get('username') || '').trim();
    }

    setAccountLoading(true);
    setNotice('');

    try {
      const response = await fetch(API_BASE + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Account request failed.');
      }

      if (!data.token || !data.user) {
        throw new Error('The server did not return a login token and user.');
      }

      // Diagnostic: fingerprint the token returned by the login endpoint.
      console.log(
        'FRONTEND login token fingerprint:',
        await getTokenFingerprint(data.token)
      );

      localStorage.setItem('jumpstartToken', data.token);
      setToken(data.token);
      setCurrentUser(data.user);
      setSelected(null);
      setEditing(null);
      setListPage(1);
      setPage('home');
      setNotice('Welcome, ' + data.user.username + '!');
      form.reset();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setAccountLoading(false);
    }
  }

  // Clear the locally stored JWT and return to the welcome page.
  function handleLogout() {
    localStorage.removeItem('jumpstartToken');
    setToken('');
    setCurrentUser(null);
    setSelected(null);
    setEditing(null);
    setProjects([]);
    setCommentsFor(null);
    setPage('welcome');
    setNotice('You have been logged out.');
  }

  async function openProject(id) {
    if (detailsLoading) return;

    setDetailsLoading(true);
    setNotice('');

    try {
      const authHeaders = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const [projectResponse, contributorResponse] = await Promise.all([
        fetch(API_BASE + '/projects/' + id, { headers: authHeaders }),
        fetch(API_BASE + '/projects/' + id + '/contributors', { headers: authHeaders }),
      ]);

      const [data, contributions] = await Promise.all([
        projectResponse.json(),
        contributorResponse.json(),
      ]);

      if (!projectResponse.ok || !data.success) {
        throw new Error(data.error || 'Could not load project.');
      }

      if (!contributorResponse.ok || !contributions.success) {
        throw new Error(contributions.error || 'Could not load contributors.');
      }

      setSelected({
        ...mapProject(data.project),
        contributors: contributions.contributors,
        hours: Number(contributions.total_hours_completed),
        pledgedHours: Number(contributions.total_hours_committed),
      });

      setPage('details');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setDetailsLoading(false);
    }
  }

  // Refresh details and contributors after a successful creation or edit.
  useEffect(() => {
    if (!selected || page !== 'details') return;

    const controller = new AbortController();

    async function refreshDetails() {
      try {
        const responses = await Promise.all([
          fetch(API_BASE + '/projects/' + selected.id, {
            signal: controller.signal,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
          fetch(API_BASE + '/projects/' + selected.id + '/contributors', {
            signal: controller.signal,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
        ]);

        const [data, contributions] = await Promise.all(
          responses.map(response => response.json())
        );

        if (!responses[0].ok || !responses[1].ok) {
          throw new Error(
            data.error || contributions.error || 'Details unavailable.'
          );
        }

        if (!controller.signal.aborted) {
          setSelected({
            ...mapProject(data.project),
            contributors: contributions.contributors,
            hours: Number(contributions.total_hours_completed),
            pledgedHours: Number(contributions.total_hours_committed),
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setNotice(
            'Project record is available, but refreshing details failed: ' +
            error.message
          );
        }
      }
    }

    refreshDetails();

    return () => controller.abort();
  }, [selected?.id, page, token]);

  // Retained demo interactions; votes/comments are not saved by the project API.
  function update(id, change) {
    setProjects(current =>
      current.map(project =>
        project.id === id ? { ...project, ...change(project) } : project
      )
    );
  }

  async function sayHello() {
    setHelloLoading(true);
    setBackendMessage('');

    try {
      const response = await fetch(API_BASE + '/hello');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed.');
      }

      setBackendMessage(data.message);
      setBackend('Connected to backend');
    } catch (error) {
      setBackendMessage('Could not connect to backend: ' + error.message);
    } finally {
      setHelloLoading(false);
    }
  }

  const titles = {
    home: 'Jump Start',
    mine: 'My Projects',
    create: editing ? 'Edit Project' : 'Create Project',
    details: 'Project Details',
  };

  const visible = page === 'mine'
    ? projects.filter(project => project.ownerId === Number(currentUserId))
    : projects;

  if (page === 'welcome') {
    return (
      <main
        className="welcome-page"
        style={{ padding: '20px', textAlign: 'center' }}
      >
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

        <div
          style={{
            marginTop: '30px',
            border: '1px dashed #ccc',
            padding: '15px',
          }}
        >
          <button
            className="blue-button"
            onClick={sayHello}
            disabled={helloLoading}
            style={{
              background: 'blue',
              color: 'white',
              padding: '10px 20px',
              cursor: 'pointer',
            }}
          >
            {helloLoading ? 'Connecting...' : 'Say Hello to Backend'}
          </button>
        </div>

        <p role="status" style={{ marginTop: '10px', fontWeight: 'bold' }}>
          Backend Response: {backendMessage || 'No message yet'}
        </p>
      </main>
    );
  }

  if (page === 'login' || page === 'signup') {
    return (
      <main className="account-page">
        <h1 className="sr-only">
          {page === 'login' ? 'Log In' : 'Create Account'}
        </h1>

        <form className="account-form" onSubmit={handleAccountSubmit}>
          {page === 'signup' && (
            <>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                placeholder="Create username"
                autoComplete="username"
                required
              />
            </>
          )}

          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Enter email"
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter password"
            autoComplete={
              page === 'login' ? 'current-password' : 'new-password'
            }
            required
          />

          <button
            className="blue-button"
            type="submit"
            disabled={accountLoading}
          >
            {accountLoading
              ? 'Please wait...'
              : page === 'login'
                ? 'Log In'
                : 'Create Account'}
          </button>
        </form>

        <p className="notice" role="status">{notice}</p>

        <button className="text-button" onClick={() => go('welcome')}>
          Back to welcome
        </button>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="page-header">
        <h1>{titles[page]}</h1>
        {currentUser && <p>Logged in as {currentUser.username}</p>}
      </header>

      <main className={`content ${page === 'home' ? 'home-content' : ''}`}>
        <p className="notice" role="status">{notice}</p>

        {detailsLoading && <p role="status">Loading project details…</p>}

        {(page === 'home' || page === 'mine') && (
          <>
            <label className="search-bar">
              Search Projects
              <input
                type="search"
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setListPage(1);
                }}
              />
              <Icon name="search" />
            </label>

            <div className="refresh-projects-row">
              <button
                className="text-button"
                disabled={loading}
                onClick={() => setReload(value => value + 1)}
              >
                Refresh projects
              </button>
            </div>

            {loading ? (
              <p role="status">Loading projects…</p>
            ) : (
              <section
                className={page === 'mine' ? 'my-projects' : 'project-list'}
                aria-label={page === 'mine' ? 'My projects' : 'Projects'}
              >
                {visible.map(project =>
                  page === 'mine' ? (
                    <article className="owned-project" key={project.id}>
                      <div className="manage-actions">
                        <button
                          disabled={detailsLoading}
                          aria-label={`View details for ${project.name}`}
                          onClick={() => openProject(project.id)}
                        >
                          <Icon name="clock" />
                        </button>
                        <button
                          aria-label={`Edit ${project.name}`}
                          onClick={() => {
                            setEditing(project);
                            go('create');
                          }}
                        >
                          <Icon name="edit" />
                        </button>
                      </div>

                      <div className="owned-summary">
                        <h2>{project.name}</h2>
                        <p>{project.description}</p>
                      </div>

                      <div className="progress">
                        <div>
                          <span>0hr</span>
                          <span>Goal: {project.goal}hr</span>
                        </div>
                        <progress
                          aria-label={`${project.name} progress`}
                          value={Math.min(project.hours, project.goal)}
                          max={project.goal}
                        />
                        <p>
                          {project.hours}hr completed · {project.pledgedHours}hr pledged
                        </p>
                      </div>
                    </article>
                  ) : (
                    <article className="project-card" key={project.id}>
                      <button
                        className="contribute-link"
                        disabled={detailsLoading}
                        onClick={() => openProject(project.id)}
                      >
                        View details
                      </button>

                      <div className="project-card-main">
                        <ProjectSummary project={project} />

                        <small>
                          Votes and comments below are local demos and reset when projects reload.
                        </small>

                        <div className="project-actions">
                          <button
                            aria-label={`Upvote ${project.name}`}
                            aria-pressed={project.vote === 1}
                            onClick={() =>
                              update(project.id, project => ({
                                vote: project.vote === 1 ? 0 : 1,
                              }))
                            }
                          >
                            ↑
                          </button>
                          <span aria-label="Vote score">{project.vote}</span>
                          <button
                            aria-label={`Downvote ${project.name}`}
                            aria-pressed={project.vote === -1}
                            onClick={() =>
                              update(project.id, project => ({
                                vote: project.vote === -1 ? 0 : -1,
                              }))
                            }
                          >
                            ↓
                          </button>
                          <button
                            className="comment-button"
                            aria-label={`Comments for ${project.name}`}
                            aria-expanded={commentsFor === project.id}
                            onClick={() =>
                              setCommentsFor(
                                commentsFor === project.id ? null : project.id
                              )
                            }
                          >
                            <Icon name="comment" />
                            <span>{project.comments.length}</span>
                          </button>
                        </div>

                        {commentsFor === project.id && (
                          <div className="comments">
                            <h3>Comments</h3>
                            {!project.comments.length && <p>No comments yet.</p>}

                            {project.comments.map((comment, index) => (
                              <p key={index}>{comment}</p>
                            ))}

                            <form
                              onSubmit={event => {
                                event.preventDefault();
                                const commentText = new FormData(
                                  event.currentTarget
                                ).get('comment').trim();

                                if (!commentText) return;

                                update(project.id, project => ({
                                  comments: [...project.comments, commentText],
                                }));

                                event.currentTarget.reset();
                              }}
                            >
                              <input
                                name="comment"
                                aria-label="New comment"
                                required
                                maxLength={500}
                              />
                              <button className="gray-button">Post</button>
                            </form>
                          </div>
                        )}

                        <p>
                          Goal: {project.goal}hr · Pledged: {project.pledgedHours}hr · Status: {project.status}
                        </p>
                      </div>
                    </article>
                  )
                )}

                {!visible.length && (
                  <p className="empty-state">
                    {page === 'mine'
                      ? 'Your projects will appear here once you create one.'
                      : 'No matching projects.'}
                  </p>
                )}
              </section>
            )}

            {page === 'home' && (
              <div className="pagination home-pagination" aria-label="Project pages">
                <button
                  className="gray-button"
                  disabled={loading || listPage <= 1}
                  onClick={() => setListPage(pageNumber => pageNumber - 1)}
                >
                  Previous
                </button>
                <span>Page {listPage} of {Math.max(1, totalPages)}</span>
                <button
                  className="gray-button"
                  disabled={loading || listPage >= totalPages}
                  onClick={() => setListPage(pageNumber => pageNumber + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {page === 'create' && (
          <ProjectForm
            key={editing?.id || 'new'}
            project={editing}
            saving={saving}
            onSave={saveProject}
            onCancel={() => go('mine')}
          />
        )}

        {page === 'details' && selected && (
          <section className="contribution">
            <ProjectSummary project={selected} />
            <p>Goal: {selected.goal} hours</p>
            <p>Pledged: {selected.pledgedHours} hours</p>
            <p>Completed: {selected.hours} hours</p>
            <p>Status: {selected.status}</p>

            <progress
              aria-label="Completed hours toward goal"
              value={Math.min(selected.hours, selected.goal)}
              max={selected.goal}
            />

            <h3>Contributors</h3>

            {selected.contributors.length ? (
              <ul>
                {selected.contributors.map(person => (
                  <li key={person.user_id}>
                    {person.username}: {Number(person.hours_committed)} hours pledged, {Number(person.hours_completed)} hours completed
                  </li>
                ))}
              </ul>
            ) : (
              <p>No contributors yet.</p>
            )}

            <button
              className="text-button"
              disabled={detailsLoading}
              onClick={() => openProject(selected.id)}
            >
              Refresh details
            </button>

            <button
              className="text-button"
              onClick={() => {
                go('home');
                setReload(value => value + 1);
              }}
            >
              Back to projects
            </button>
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <button
          disabled={saving}
          aria-current={page === 'home' ? 'page' : undefined}
          onClick={() => {
            go('home');
            setReload(value => value + 1);
          }}
        >
          <Icon name="home" />
          <span>Home</span>
        </button>

        <button
          disabled={saving}
          aria-current={page === 'mine' ? 'page' : undefined}
          onClick={() => {
            go('mine');
            setListPage(1);
            setReload(value => value + 1);
          }}
        >
          <Icon name="user" />
          <span>My Projects</span>
        </button>

        <button
          disabled={saving}
          className="create-nav"
          aria-current={page === 'create' ? 'page' : undefined}
          onClick={() => {
            setEditing(null);
            go('create');
          }}
        >
          <Icon name="plus" />
          <span>Create</span>
        </button>

        <button
          disabled={saving}
          className="exit-nav"
          onClick={handleLogout}
        >
          <Icon name="exit" />
          <span>Log Out</span>
        </button>
      </nav>
    </div>
  );
}
