import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

async function request(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const token = localStorage.getItem("library_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No fue posible completar la solicitud.");
  return data;
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault(); setError("");
    try {
      const data = await request("/auth/login", { method: "POST", body: JSON.stringify(form) });
      localStorage.setItem("library_token", data.access_token);
      onLogin({ username: form.username.trim().toLowerCase(), role: data.role });
    } catch (err) { setError(err.message); }
  };
  return <main className="login-shell">
    <section className="login-card">
      <p className="eyebrow">Manager Library</p><h1>Bienvenido de vuelta.</h1>
      <p className="muted">Ingresa para administrar tu biblioteca.</p>
      <form onSubmit={submit}>
        <label>Usuario<input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label>Contraseña<input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="error">{error}</p>}<button className="button">Ingresar</button>
      </form>
    </section>
  </main>;
}

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("books");
  const [data, setData] = useState({ books: [], members: [], loans: [], overdue: [], report: [] });
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const load = async (section = view) => {
    setError("");
    try {
      if (section === "books") {
        const result = await request(`/books?q=${encodeURIComponent(query)}&page=1&size=50`);
        setData((d) => ({ ...d, books: result.items || [] }));
      }
      if (section === "members") {
        const result = await request("/members?page=1&size=50");
        setData((d) => ({ ...d, members: result.items || [] }));
      }
      if (section === "loans") {
        const result = await request("/loans?page=1&size=50");
        setData((d) => ({ ...d, loans: result.items || [] }));
      }
      if (section === "overdue") {
        const result = await request("/loans/overdue");
        setData((d) => ({ ...d, overdue: result.items || [] }));
      }
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { if (user) load(); }, [user, view]);
  if (!user) return <Login onLogin={setUser} />;
  const nav = [
    ["books", "Catálogo"], ["members", "Socios"], ["loans", "Préstamos"], ["overdue", "Vencidos"],
  ];
  return <div className="layout">
    <aside><a className="brand" href="#">Manager<span>Library</span></a><nav>{nav.map(([id, label]) =>
      <button className={view === id ? "active" : ""} onClick={() => setView(id)} key={id}>{label}</button>)}</nav>
      {user.role === "admin" && <button className={view === "report" ? "active" : ""} onClick={() => setView("report")}>Reporte</button>}
      <button className="logout" onClick={() => { localStorage.removeItem("library_token"); setUser(null); }}>Cerrar sesión</button>
    </aside>
    <main className="content"><header><div><p className="eyebrow">Panel de operación</p><h1>{nav.find(([id]) => id === view)?.[1] || "Reporte"}</h1></div>
      <span className="user-pill">{user.username}</span></header>
      {error && <p className="error banner">{error}</p>}
      {view === "books" && <Books books={data.books} query={query} setQuery={setQuery} reload={() => load("books")} />}
      {view === "members" && <Members members={data.members} />}
      {view === "loans" && <Loans loans={data.loans} />}
      {view === "overdue" && <Overdue items={data.overdue} />}
      {view === "report" && <Report />}
    </main>
  </div>;
}

function Books({ books, query, setQuery, reload }) {
  return <><div className="toolbar"><input placeholder="Buscar por título o autor..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && reload()} /><button className="button" onClick={reload}>Buscar</button></div>
    <div className="table-card"><table><thead><tr><th>Título</th><th>Autor</th><th>ISBN</th><th>Disponibles</th></tr></thead><tbody>{books.map((book) =>
      <tr key={book.id}><td><strong>{book.title}</strong><small>{book.category?.name || "Sin categoría"}</small></td><td>{book.author}</td><td>{book.isbn}</td><td><span className="availability">{book.available_copies} / {book.total_copies}</span></td></tr>)}</tbody></table>{!books.length && <Empty text="No hay libros para mostrar." />}</div></>;
}
function Members({ members }) {
  return <div className="table-card"><table><thead><tr><th>Nombre</th><th>Documento</th><th>Préstamos activos</th></tr></thead><tbody>{members.map((member) =>
    <tr key={member.id}><td><strong>{member.full_name}</strong></td><td>{member.document_number}</td><td>{member.active_loans ?? 0}</td></tr>)}</tbody></table>{!members.length && <Empty text="No hay socios para mostrar." />}</div>;
}
function Loans({ loans }) {
  return <div className="table-card"><table><thead><tr><th>Socio</th><th>Fecha</th><th>Estado</th><th>Libros</th></tr></thead><tbody>{loans.map((loan) =>
    <tr key={loan.id}><td>{loan.member_name || loan.member_id}</td><td>{new Date(loan.loaned_at).toLocaleDateString("es-CO")}</td><td><Status value={loan.status} /></td><td>{loan.items?.length ?? loan.item_count ?? "-"}</td></tr>)}</tbody></table>{!loans.length && <Empty text="No hay préstamos para mostrar." />}</div>;
}
function Overdue({ items }) {
  return <div className="table-card"><table><thead><tr><th>Libro</th><th>Socio</th><th>Vencimiento</th><th>Días tarde</th></tr></thead><tbody>{items.map((item) =>
    <tr key={item.item_id}><td><strong>{item.book_title}</strong></td><td>{item.member_name}</td><td>{new Date(item.due_at).toLocaleDateString("es-CO")}</td><td><span className="late">{item.days_late}</span></td></tr>)}</tbody></table>{!items.length && <Empty text="No hay libros vencidos." />}</div>;
}
function Report() {
  const [report, setReport] = useState(null); const [range, setRange] = useState({ from: "", to: "" }); const [error, setError] = useState("");
  const run = async (e) => { e.preventDefault(); setError(""); try { setReport(await request(`/reports/most-borrowed?from=${range.from}&to=${range.to}`)); } catch (err) { setError(err.message); } };
  return <><form className="toolbar" onSubmit={run}><input required type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /><input required type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /><button className="button">Generar</button></form>{error && <p className="error">{error}</p>}<div className="table-card"><table><thead><tr><th>Libro</th><th>Categoría</th><th>Préstamos</th></tr></thead><tbody>{(report?.rows || []).map((row) => <tr key={`${row.book_id}-${row.category_name}`}><td><strong>{row.book_title}</strong></td><td>{row.category_name}</td><td>{row.times_borrowed}</td></tr>)}</tbody></table>{report && !report.rows.length && <Empty text="No hubo préstamos en este periodo." />}</div></>;
}
function Status({ value }) { return <span className={`status ${value}`}>{value || "open"}</span>; }
function Empty({ text }) { return <p className="empty">{text}</p>; }

createRoot(document.getElementById("root")).render(<App />);
