
import { useEffect, useState } from "react";
import {
  Award, Search, ShieldCheck, Users, ClipboardList,
  Megaphone, LogOut, RefreshCw, Plus, CheckCircle2,
  XCircle, AlertCircle, Menu, X, LayoutDashboard, MessageCircle
} from "lucide-react";
import "./App.css";
import logoPmrSmanel from "./assets/logo-pmr-smanel.png";


const API = import.meta.env.DEV
  ? "/api/proxy"
  : import.meta.env.VITE_API_URL;

console.log("API Mode:", import.meta.env.MODE);
console.log("API URL:", API);



async function getEvents() {
  const response = await fetch(`${API}?action=listEvents`, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Gagal memuat Event (HTTP ${response.status}).`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || "Gagal memuat daftar Event.");
  }

  return data.data || [];
}

async function publicSearch(name, eventId) {
  const params = new URLSearchParams({
    action: "search",
    name,
    eventId
  });
  const response = await fetch(`${API}?${params.toString()}`, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Pencarian gagal (HTTP ${response.status}).`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || "Pencarian gagal.");
  }

  return data;
}


async function adminRequest(action, data = {}, token = "") {
  // Apps Script Web App: kirim JSON sebagai text/plain untuk menghindari
  // preflight CORS. Tetap perlu diuji pada deployment yang digunakan.
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...data, token }),
  });

  if (!response.ok) throw new Error(`Server merespons HTTP ${response.status}`);
  const result = await response.json();
  if (!result.success) throw new Error(result.message || "Permintaan gagal.");
  return result;
}

function Message({ message, type = "info" }) {
  if (!message) return null;
  return (
    <div className={`message ${type}`} role="status">
      {type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
      <span>{message}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const success = status === "LOLOS";
  return (
    <span className={`status-badge ${success ? "passed" : "failed"}`}>
      {success ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
      {success ? "LOLOS" : "TIDAK LOLOS"}
    </span>
  );
}

function Header({ admin, onAdmin, onHome }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="Kembali ke beranda">
        <span className="brand-mark" style={{ width: 48, height: 48, flex: "0 0 48px", overflow: "hidden", background: "#fff", padding: 3, borderRadius: 12 }}>
          <img src={logoPmrSmanel} alt="Logo PMR SMANEL" style={{ display: "block", width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", position: "static", transform: "none" }} />
        </span>
        <span>
          <strong>PMR SMANEL</strong>
          <small>PORTAL PENGUMUMAN</small>
        </span>
      </button>
      <nav>
        <button className="nav-link" onClick={onHome}>Beranda</button>
        <button className="nav-admin" onClick={onAdmin}>
          <ShieldCheck size={17} />
          {admin ? "Dashboard Admin" : "Admin"}
        </button>
      </nav>
    </header>
  );
}

function ResultCard({ result }) {
  const passed = result.status === "LOLOS";
  return (
    <article className={`result-card ${passed ? "result-passed" : "result-failed"}`}>
      <div className="result-icon">
        {passed ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
      </div>
      <div className="result-body">
        <h3>{result.namaLomba}</h3>
        <p>{passed
          ? "Selamat! Anda dinyatakan lolos seleksi."
          : "Terima kasih telah berpartisipasi. Tetap semangat dan coba lagi di kesempatan berikutnya."
        }</p>
      </div>
      <StatusBadge status={result.status} />
    </article>
  );
}

function WhatsAppInvite({ link }) {
  if (!link) return null;

  let safeLink;
  try {
    const url = new URL(link);
    const allowedHosts = ["chat.whatsapp.com", "wa.me", "api.whatsapp.com"];
    if (url.protocol !== "https:" || !allowedHosts.includes(url.hostname)) {
      return null;
    }
    safeLink = url.href;
  } catch {
    return null;
  }

  return (
    <section className="whatsapp-invite" aria-label="Grup WhatsApp event">
      <div className="whatsapp-invite-icon">
        <MessageCircle size={26} />
      </div>
      <div className="whatsapp-invite-content">
        <strong>Selamat, kamu berhasil lolos!</strong>
        <p>Silakan bergabung ke Grup WhatsApp event untuk mendapatkan informasi selanjutnya.</p>
      </div>
      <a
        className="whatsapp-join-button"
        href={safeLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MessageCircle size={18} />
        Gabung Grup WhatsApp
      </a>
    </section>
  );
}

function PublicPage() {
  const [name, setName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      try {
        const data = await getEvents();
        if (cancelled) return;

        const activeEvents = data.filter(event => String(event.status).toUpperCase() === "AKTIF");
        setEvents(activeEvents);
        setEventId(current => {
          if (current && activeEvents.some(event => event.id === current)) return current;
          return activeEvents[0]?.id || "";
        });
        if (!activeEvents.length) {
          setError("Belum ada Event yang aktif.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Gagal memuat Event: ${err.message || "Periksa koneksi API."}`);
        }
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    }

    loadEvents();
    return () => { cancelled = true; };
  }, []);

  async function search(e) {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError("Masukkan nama lengkap minimal 3 karakter.");
      setResult(null);
      return;
    }
    if (!eventId) {
      setError("Silakan pilih Event terlebih dahulu.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await publicSearch(name.trim(), eventId);
      setResult(data);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan saat mencari data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>

<section className="hero">
  <div className="hero-content">
    <img
      src={logoPmrSmanel}
      alt="Logo PMR SMANEL"
      className="hero-pmr-logo"
    />

    <span className="eyebrow">
      <span className="live-dot" />
      PENGUMUMAN RESMI · 2026
    </span>

    <h1>
      Perjuanganmu,
      <br />
      <em>hasilnya di sini.</em>
    </h1>

    <p>
      Periksa hasil seleksi Lomba PMR SMANEL. Pilih Event dan masukkan nama
      lengkap untuk melihat hasil yang telah diumumkan.
    </p>

    <div
      className="event-selector"
      style={{
        marginBottom: "14px",
        width: "100%",
        maxWidth: "650px",
        textAlign: "left"
      }}
    >
      <label
        htmlFor="event-select"
        style={{
          display: "block",
          marginBottom: "7px",
          fontWeight: 600
        }}
      >
        Pilih Event Perlombaan
      </label>

      <select
        id="event-select"
        value={eventId}
        onChange={e => {
          setEventId(e.target.value);
          setResult(null);
          setError("");
        }}
        disabled={loadingEvents || events.length === 0}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: "10px",
          border: "1px solid #d7dce3",
          background: "#fff",
          font: "inherit"
        }}
      >
        {loadingEvents && <option value="">Memuat Event...</option>}
        {!loadingEvents && events.length === 0 && (
          <option value="">Tidak ada Event aktif</option>
        )}

        {events.map(event => (
          <option key={event.id} value={event.id}>
            {event.nama}
          </option>
        ))}
      </select>
    </div>

    <form className="search-form" onSubmit={search}>
      <Search size={21} />

      <input
        aria-label="Nama lengkap peserta"
        placeholder="Masukkan nama lengkap..."
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <button
        disabled={loading || loadingEvents || !eventId}
        type="submit"
      >
        {loading ? (
          <RefreshCw className="spin" size={18} />
        ) : (
          "Cari Hasil"
        )}
      </button>
    </form>

    <small className="search-note">
      Gunakan nama lengkap sesuai data pendaftaran.
    </small>
  </div>
</section>
      <main className="public-main">
        <div className="section-heading">
          <div>
            <span className="section-kicker">HASIL SELEKSI</span>
            <h2>Pengumuman peserta</h2>
          </div>
          <span className="secure-note"><ShieldCheck size={16} /> Hasil resmi panitia</span>
        </div>

        {error && <Message message={error} type="error" />}

        {result && !result.found && (
          <div className="empty-state">
            <Search size={34} />
            <h3>Nama belum ditemukan</h3>
            <p>Periksa ejaan nama lengkap, lalu coba kembali.</p>
          </div>
        )}

        {result?.found && (
          <div className="results-area">
            {result.ambiguous ? (
              <>
                <Message
                  message="Ada beberapa peserta dengan nama yang sama. Cocokkan kelas atau sekolah sebelum melihat hasil."
                  type="info"
                />
                <div className="candidate-grid">
                  {result.peserta.map((p, i) => (
                    <article className="candidate-card" key={`${p.kelas}-${p.sekolah}-${i}`}>
                      <h3>{name.trim()}</h3>
                      <p>{p.kelas || "Kelas tidak tersedia"}{p.sekolah ? ` · ${p.sekolah}` : ""}</p>
                      <div className="result-list">
                        {p.hasil.length
                          ? p.hasil.map((r, j) => <ResultCard key={`${r.namaLomba}-${j}`} result={r} />)
                          : <p className="muted">Belum ada hasil yang dipublikasikan untuk peserta ini.</p>}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="participant-heading">
                  <div className="avatar">{name.trim().charAt(0).toUpperCase()}</div>
                  <div>
                    <span className="section-kicker">HASIL PENCARIAN</span>
                    <h3>{name.trim()}</h3>
                    <p>{result.peserta[0]?.kelas || "Peserta seleksi"}{result.peserta[0]?.sekolah ? ` · ${result.peserta[0].sekolah}` : ""}</p>
                  </div>
                </div>
                {result.peserta[0]?.hasil?.length ? (
                  <>
                    <p className="result-count">{result.peserta[0].hasil.length} hasil lomba telah diumumkan</p>
                    <div className="result-list">
                      {result.peserta[0].hasil.map((r, i) =>
                        <ResultCard key={`${r.namaLomba}-${i}`} result={r} />
                      )}
                    </div>
                    {result.linkGrupWA &&
                      result.peserta[0].hasil.some(item => item.status === "LOLOS") && (
                        <WhatsAppInvite link={result.linkGrupWA} />
                      )}
                    <div className="congrats">
                      <Award size={25} />
                      <div>
                        <strong>Terus berproses dan berprestasi!</strong>
                        <p>Setiap pengalaman adalah bagian dari perjalananmu.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state compact">
                    <Megaphone size={30} />
                    <h3>Pengumuman belum tersedia</h3>
                    <p>Hasil untuk nama ini belum dipublikasikan oleh panitia.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!result && !error && (
          <div className="how-it-works">
            <div className="how-card"><span>01</span><h3>Masukkan nama</h3><p>Gunakan nama lengkap sesuai pendaftaran.</p></div>
            <div className="how-card"><span>02</span><h3>Periksa hasil</h3><p>Lihat semua lomba yang sudah diumumkan.</p></div>
            <div className="how-card"><span>03</span><h3>Terus berprestasi</h3><p>Jadikan hasil sebagai langkah berikutnya.</p></div>
          </div>
        )}
      </main>
    </>
  );
}

function LoginPage({ onLogin, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await adminRequest("login", { email, password });
      onLogin(result);
    } catch (err) {
      setError(`${err.message}. Jika terjadi kendala jaringan/CORS, kita perlu menguji koneksi API admin.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-icon"><ShieldCheck size={30} /></div>
        <span className="section-kicker">AREA TERBATAS</span>
        <h1>Login Admin</h1>
        <p>Masuk untuk mengelola data peserta dan pengumuman.</p>
        <label>Email admin</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        {error && <Message message={error} type="error" />}
        <button className="primary-button full" disabled={loading}>
          {loading ? "Memeriksa..." : "Masuk ke dashboard"}
        </button>
        <button type="button" className="text-button" onClick={onBack}>Kembali ke beranda</button>
      </form>
    </main>
  );
}

function AdminPage({ session, onLogout }) {
  const [section, setSection] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [contests, setContests] = useState([]);
  const [results, setResults] = useState([]);
  const [adminEvents, setAdminEvents] = useState([]);
  const [selectedAdminEvent, setSelectedAdminEvent] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const [participantForm, setParticipantForm] = useState({
    id: "", nama: "", kelas: "", sekolah: ""
  });
  const [resultForm, setResultForm] = useState({
    pesertaId: "", lombaId: "", status: "BELUM_DITETAPKAN", catatan: ""
  });

  async function loadAll() {
    setBusy(true);
    setNotice(null);
    try {
      const [d, p, c, r, eventData] = await Promise.all([
        adminRequest("dashboard", {}, session.token),
        adminRequest("listParticipants", {}, session.token),
        adminRequest("listContests", {}, session.token),
        adminRequest("listResults", {}, session.token),
        getEvents()
      ]);
      const activeEvents = (eventData || []).filter(event => event.status === "AKTIF");
      setDashboard(d);
      setParticipants(p.data || []);
      setContests(c.data || []);
      setResults(r.data || []);
      setAdminEvents(activeEvents);
      setSelectedAdminEvent(current =>
        activeEvents.some(event => event.id === current)
          ? current
          : (activeEvents[0]?.id || "")
      );
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const filteredContests = contests.filter(c =>
    !selectedAdminEvent || String(c.idEvent || "") === String(selectedAdminEvent)
  );
  const filteredResults = results.filter(r => {
    if (!selectedAdminEvent) return true;
    const contest = contests.find(c => String(c.id) === String(r.lombaId));
    return contest && String(contest.idEvent || "") === String(selectedAdminEvent);
  });

  async function saveParticipant(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await adminRequest("saveParticipant", {
        data: participantForm
      }, session.token);
      setNotice({ type: "success", text: data.message });
      setParticipantForm({ id: "", nama: "", kelas: "", sekolah: "" });
      await loadAll();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id) {
    if (!window.confirm("Nonaktifkan peserta ini?")) return;
    try {
      const data = await adminRequest("deactivateParticipant", { id }, session.token);
      setNotice({ type: "success", text: data.message });
      await loadAll();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    }
  }

  async function saveResult(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await adminRequest("saveResult", { data: resultForm }, session.token);
      setNotice({ type: "success", text: data.message });
      setResultForm({ pesertaId: "", lombaId: "", status: "BELUM_DITETAPKAN", catatan: "" });
      await loadAll();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function publish(contest, status) {
    const message = status === "PUBLISHED"
      ? `Publikasikan hasil ${contest.nama}? Peserta dapat melihat hasil yang sudah ditetapkan.`
      : `Ubah status publikasi ${contest.nama} menjadi ${status}?`;
    if (!window.confirm(message)) return;

    try {
      const data = await adminRequest("publishContest", {
        id: contest.id, status
      }, session.token);
      setNotice({ type: "success", text: data.message });
      await loadAll();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    }
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "peserta", label: "Data Peserta", icon: Users },
    { id: "hasil", label: "Hasil Seleksi", icon: ClipboardList },
    { id: "publikasi", label: "Publikasi", icon: Megaphone }
  ];

  return (
    <div className="admin-layout">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <img src={logoPmrSmanel} alt="Logo PMR SMANEL" className="sidebar-logo" />
          <span><b>PMR SMANEL</b><small>ADMIN PANEL</small></span>
        </div>
        <div className="sidebar-label">MENU UTAMA</div>
        {navItems.map(item => {
          const Icon = item.icon;
          return <button key={item.id} className={`side-link ${section === item.id ? "active" : ""}`}
            onClick={() => { setSection(item.id); setMobileMenu(false); }}>
            <Icon size={19} /> {item.label}
          </button>;
        })}
        <div className="sidebar-bottom">
          <div className="admin-identity"><div className="avatar small">{session.user?.name?.charAt(0) || "A"}</div><div><b>{session.user?.name || "Admin"}</b><small>{session.user?.role}</small></div></div>
          <button className="side-link logout" onClick={onLogout}><LogOut size={18} /> Keluar</button>
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <button className="mobile-menu-button" onClick={() => setMobileMenu(v => !v)}><Menu /></button>
          <div><span className="section-kicker">PORTAL PENGUMUMAN</span><h2>{navItems.find(n => n.id === section)?.label}</h2></div>
          <button className="refresh-button" onClick={loadAll} disabled={busy}><RefreshCw size={17} className={busy ? "spin" : ""} /> Perbarui</button>
        </header>

        <main className="admin-main">
          {notice && <Message message={notice.text} type={notice.type} />}
          {busy && <p className="muted">Memuat data...</p>}

          {section === "dashboard" && (
            <>
              <div className="welcome-banner"><div><span>ADMINISTRATOR</span><h1>Selamat Datang.</h1><p>Kelola data dan publikasi hasil seleksi PMR SMANEL 2026.</p></div><Award size={55} /></div>
              <div className="stat-grid">
                <div className="stat-card"><Users /><span>Peserta aktif</span><strong>{dashboard?.totalPeserta ?? "—"}</strong></div>
                <div className="stat-card"><ClipboardList /><span>Total hasil</span><strong>{dashboard?.totalHasil ?? "—"}</strong></div>
                <div className="stat-card"><Award /><span>Total lomba</span><strong>{dashboard?.totalLomba ?? "—"}</strong></div>
                <div className="stat-card"><Megaphone /><span>Lomba diumumkan</span><strong>{dashboard?.lombaDipublikasikan ?? "—"}</strong></div>
              </div>
              <div className="panel"><h3>Status publikasi lomba</h3>{contests.map(c => <div className="contest-row" key={c.id}><div><b>{c.nama}</b><small>{c.id}</small></div><span className={`pill ${c.status.toLowerCase()}`}>{c.status}</span></div>)}</div>
            </>
          )}

          {section === "peserta" && (
            <div className="two-column">
              <form className="panel form-panel" onSubmit={saveParticipant}>
                <h3><Plus size={19} /> Tambah peserta</h3>
                <label>Nama lengkap *</label><input required value={participantForm.nama} onChange={e => setParticipantForm({...participantForm, nama: e.target.value})} placeholder="Nama sesuai pendaftaran" />
                <label>Kelas</label><input value={participantForm.kelas} onChange={e => setParticipantForm({...participantForm, kelas: e.target.value})} placeholder="Contoh: XI A" />
                <label>Sekolah</label><input value={participantForm.sekolah} onChange={e => setParticipantForm({...participantForm, sekolah: e.target.value})} placeholder="Nama sekolah" />
                <button className="primary-button" disabled={busy}>Simpan peserta</button>
              </form>
              <div className="panel"><h3>Daftar peserta ({participants.length})</h3>
                <div className="table-wrap"><table><thead><tr><th>Nama</th><th>Kelas</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
                  {participants.map(p => <tr key={p.id}><td><b>{p.nama}</b><small>{p.id}</small></td><td>{p.kelas || "—"}</td><td>{p.status}</td><td>{p.status === "AKTIF" && <button className="small-danger" onClick={() => deactivate(p.id)}>Nonaktifkan</button>}</td></tr>)}
                </tbody></table></div>
              </div>
            </div>
          )}

          {section === "hasil" && (
            <div className="two-column">
              <form className="panel form-panel" onSubmit={saveResult}>
                <h3><Plus size={19} /> Tetapkan hasil seleksi</h3>
                <label>Event *</label>
                <select
                  required
                  value={selectedAdminEvent}
                  onChange={e => {
                    setSelectedAdminEvent(e.target.value);
                    setResultForm(current => ({ ...current, lombaId: "" }));
                  }}
                >
                  <option value="">Pilih Event</option>
                  {adminEvents.map(event => (
                    <option key={event.id} value={event.id}>{event.nama}</option>
                  ))}
                </select>
                <label>Peserta *</label>
                <select required value={resultForm.pesertaId} onChange={e => setResultForm({...resultForm, pesertaId: e.target.value})}>
                  <option value="">Pilih peserta</option>
                  {participants.filter(p => p.status === "AKTIF").map(p => <option key={p.id} value={p.id}>{p.nama} — {p.kelas || p.id}</option>)}
                </select>
                <label>Lomba *</label>
                <select required value={resultForm.lombaId} onChange={e => setResultForm({...resultForm, lombaId: e.target.value})}>
                  <option value="">Pilih lomba</option>
                  {filteredContests.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                </select>
                <label>Status kelulusan *</label>
                <select value={resultForm.status} onChange={e => setResultForm({...resultForm, status: e.target.value})}>
                  <option value="BELUM_DITETAPKAN">Belum ditetapkan</option>
                  <option value="LOLOS">Lolos</option>
                  <option value="TIDAK_LOLOS">Tidak lolos</option>
                </select>
                <label>Catatan internal (opsional)</label><textarea rows="3" value={resultForm.catatan} onChange={e => setResultForm({...resultForm, catatan: e.target.value})} />
                <button className="primary-button" disabled={busy}>Simpan hasil</button>
              </form>
              <div className="panel"><h3>Rekap hasil ({filteredResults.length})</h3>
                <div className="table-wrap"><table><thead><tr><th>Peserta</th><th>Lomba</th><th>Status</th></tr></thead><tbody>
                  {filteredResults.map(r => <tr key={r.id}><td>{participants.find(p => p.id === r.pesertaId)?.nama || r.pesertaId}</td><td>{contests.find(c => c.id === r.lombaId)?.nama || r.lombaId}</td><td><span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span></td></tr>)}
                </tbody></table></div>
              </div>
            </div>
          )}

          {section === "publikasi" && (
            <div className="panel publication-panel">
              <div className="publication-heading">
                <div className="publication-heading-icon"><Megaphone size={20} /></div>
                <div>
                  <h3>Pengaturan publikasi</h3>
                  <p className="muted">Publikasikan setiap mata lomba secara terpisah setelah seluruh hasil ditetapkan.</p>
                </div>
              </div>
              <div className="publication-filter">
                <label htmlFor="publication-event-filter">Filter Event</label>
                <select
                  id="publication-event-filter"
                  value={selectedAdminEvent}
                  onChange={e => setSelectedAdminEvent(e.target.value)}
                >
                  <option value="">Semua Event</option>
                  {adminEvents.map(event => <option key={event.id} value={event.id}>{event.nama}</option>)}
                </select>
              </div>
              {filteredContests.map(c => {
                const count = results.filter(r => r.lombaId === c.id).length;
                const incomplete = results.filter(r => r.lombaId === c.id && r.status === "BELUM_DITETAPKAN").length;
                return <div className="publish-card" key={c.id}>
                  <div className="publish-info"><h3>{c.nama}</h3><p>{count} hasil tercatat · {incomplete} belum ditetapkan</p><span className={`pill ${c.status.toLowerCase()}`}>{c.status}</span></div>
                  <div className="publish-actions">
                    <button disabled={busy || c.status === "PUBLISHED"} className="primary-button" onClick={() => publish(c, "PUBLISHED")}>Publikasikan</button>
                    <button disabled={busy || c.status !== "PUBLISHED"} className="secondary-button" onClick={() => publish(c, "DRAFT")}>Tarik publikasi</button>
                  </div>
                </div>;
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [session, setSession] = useState(null);

  function logout() {
    if (session?.token) {
      adminRequest("logout", {}, session.token).catch(() => {});
    }
    setSession(null);
    setPage("home");
  }

  return (
    <div className="app-shell">
      {page !== "admin" && <Header admin={!!session} onHome={() => setPage("home")} onAdmin={() => setPage(session ? "admin" : "login")} />}
      {page === "home" && <PublicPage />}
      {page === "login" && <LoginPage onLogin={data => { setSession(data); setPage("admin"); }} onBack={() => setPage("home")} />}
      {page === "admin" && session && <AdminPage session={session} onLogout={logout} />}
      <footer className="footer"><div><b>PMR SMANEL</b><span>Portal Pengumuman Kelulusan Peserta Lomba · 2026</span></div><small>Informasi resmi panitia seleksi.</small></footer>
    </div>
  );
}
