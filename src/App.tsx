import React, { useEffect, useMemo, useState, createContext, useContext } from 'react'
import { QRCode } from 'react-qrcode-logo';

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'user' | 'admin' | null;
  is_member: boolean;
};

function normalizeError(err: any): string {
  try {
    if (!err) return "Erreur inconnue";
    if (typeof err === "string") return err;
    if (err.message) return String(err.message);
    if (err.error_description) return String(err.error_description);
    if (err.error) return String(err.error);
    return JSON.stringify(err);
  } catch { return "Erreur inconnue"; }
}

type SupaLike = {
  auth: {
    getSession: () => Promise<{ data: { session: any } }>;
    onAuthStateChange: (cb: (ev: any, s: any) => void) => { subscription: { unsubscribe: () => void } };
    signInWithOtp: (_: { email: string; options?: { emailRedirectTo?: string } }) => Promise<{ error: any }>
    signOut: () => Promise<void>;
  };
  from: (table: string) => {
    select: (cols: string) => any;
    update: (val: Partial<Profile>) => any;
    order?: (col: string, opts?: { ascending: boolean }) => any;
    eq?: (col: string, val: string) => any;
    single?: () => any;
    limit?: (n: number) => any;
  };
};

function makeMockClient(): SupaLike {
  let profiles: Profile[] = [
    { id: 'admin-1', email: 'admin@bde.valrose', full_name: 'Admin BDE', role: 'admin', is_member: true },
    { id: 'user-1',  email: 'user1@etu.uc',     full_name: 'Alice Martin', role: 'user',  is_member: false },
    { id: 'user-2',  email: 'user2@etu.uc',     full_name: 'Léo Durand',   role: 'user',  is_member: true },
  ];
  let current: Profile | null = profiles[0];
  const listeners: Array<(ev: any, s: any) => void> = [];
  function sessionOf(p: Profile | null) { return p ? { user: { id: p.id, email: p.email } } : null; }

  return {
    auth: {
      async getSession() { return { data: { session: sessionOf(current) } }; },
      onAuthStateChange(cb) { listeners.push(cb); return { subscription: { unsubscribe: () => {} } }; },
      async signInWithOtp({ email }) {
        const p = profiles.find(x => x.email === email) || { id: 'temp', email, full_name: email, role: 'user', is_member: false } as Profile;
        current = p; listeners.forEach(fn => fn('SIGNED_IN', sessionOf(current))); return { error: null } as any;
      },
      async signOut() { current = null; listeners.forEach(fn => fn('SIGNED_OUT', null)); },
    },
    from(table: string) {
      if (table !== 'profiles') throw new Error('mock: unknown table');
      let _eqCol = null as any; let _eqVal: any = null; let _limit = 9999;
      return {
        select(_cols: string) {
          return {
            eq(col: string, val: string) { _eqCol = col; _eqVal = val; return this; },
            single() {
              const rows = _eqCol ? profiles.filter((r:any) => String(r[_eqCol]) === String(_eqVal)) : profiles;
              const row = rows[0] || null;
              if (!row) return { data: null, error: { message: 'not found' } };
              return { data: row, error: null };
            },
            order() { return this; },
            limit(n: number) { _limit = n; return this; },
            then(resolve: any) {
              const out = profiles.slice().sort((a,b)=> (a.full_name||'').localeCompare(b.full_name||''));
              resolve({ data: out.slice(0, _limit), error: null });
            }
          };
        },
        update(val: Partial<Profile>) {
          return {
            eq(col: string, id: string) {
              const idx = profiles.findIndex((p:any) => p[col] === id);
              if (idx >= 0) profiles[idx] = { ...profiles[idx], ...val } as Profile;
              return { error: null };
            }
          };
        },
      } as any;
    },
  };
}

function makeRealClient(): SupaLike | null {
  const g: any = (typeof window !== 'undefined' ? window : (globalThis as any)) || {};
  const env: any = g.__ENV__ || {};
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const maybeGlobal = g.supabase;
  if (!url || !key || !maybeGlobal?.createClient) return null;
  try { return maybeGlobal.createClient(url, key); } catch { return null; }
}

const supabase: SupaLike = (() => {
  try { const real = makeRealClient(); if (real) return real as unknown as SupaLike; } catch {}
  console.warn('[App] Supabase non dispo → mode MOCK');
  return makeMockClient();
})();

// Simple UI primitives (no external UI libs)
function Button(props: any) {
  return <button {...props} style={{
    background: '#7f1d1d', color: 'white', border: '1px solid #5a1313',
    borderRadius: 10, padding: '8px 12px', cursor: 'pointer'
  }}>{props.children}</button>
}
function Input(props: any) {
  return <input {...props} style={{ background:'#2a0a0a', color:'#fff0f0', border:'1px solid #5a1313', borderRadius: 8, padding:'8px 10px' }} />
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<'card' | 'admin'>('card');
  const isAdmin = !!profile && profile.role === 'admin';

  const isMock = (() => {
    try {
      const g: any = (typeof window !== 'undefined' ? window : (globalThis as any)) || {};
      const env: any = g.__ENV__ || {};
      const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
      const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
      const hasGlobal = !!g.supabase?.createClient;
      return !(url && key && hasGlobal);
    } catch { return true; }
  })();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginInfo, setLoginInfo] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const payload = [
  'BDE Valrose – Carte 2025/2026',
  `Nom : ${profile.full_name || ''}`,
  `Email : ${profile.email || ''}`,
  `Statut : ${profile.is_member ? 'Adhérent validé' : 'Non adhérent'}`
].join('\r\n');


  const [search, setSearch] = useState('');
  const [adminList, setAdminList] = useState<Profile[]>([]);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data?.session || null));
    const { subscription } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }

    (async () => {
      try {
        // 1) On construit la requête de base
        const builder: any = supabase
          .from('profiles')
          .select('id, email, full_name, role, is_member');

        // 2) Filtre par id si eq() existe
        const maybeEq = builder.eq ? builder.eq('id', session.user.id) : builder;

        // 3) Essaie d'utiliser single() si dispo
        if (maybeEq.single) {
          const { data, error } = await maybeEq.single();
          if (error) throw error;
          if (!data) throw new Error('profil introuvable');

          setProfile(data as Profile);
          return;
        }

        // 4) Sinon fallback: on récupère la liste et on prend la première correspondante
        const res = await maybeEq; // certains mocks résolvent le builder lui-même (then-able)
        const list: any[] = res?.data || res || [];
        const me = list.find((r: any) => String(r.id) === String(session.user.id));

        if (me) {
          setProfile(me as Profile);
          return;
        }

        // 5) Si pas de profil : on tente un insert (nécessite la policy "insert self")
        if (supabase.from('profiles').insert) {
          const { error: insErr } = await supabase.from('profiles').insert({
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.email,
            role: 'user',
            is_member: false,
          });
          if (insErr) throw insErr;

          // puis on relit (retente 3/4)
          const rel = await (builder.eq ? builder.eq('id', session.user.id) : builder);
          const relList: any[] = rel?.data || rel || [];
          const me2 = relList.find((r: any) => String(r.id) === String(session.user.id));
          if (!me2) throw new Error('profil non créé');
          setProfile(me2 as Profile);
        } else {
          throw new Error('insert profile indisponible');
       }

      } catch (e) {
        setProfile(null);
        // Affichage propre de l’erreur
        setLoginError((e as any)?.message || 'Erreur chargement profil');
        console.error('[profiles.load] ', e);
     }
    })();
  }, [session]);


  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const builder = supabase.from('profiles').select('id, email, full_name, role, is_member');
        const { data, error } = await (builder.order ? builder.order('full_name', { ascending: true }).limit?.(50) : builder);
        if (error) throw error;
        if (data) setAdminList(data as Profile[]);
      } catch (e) { console.error('[profiles.list] erreur:', normalizeError(e)); }
    })();
  }, [isAdmin]);

  async function sendMagicLink() {
    setLoginError(''); setLoginInfo('');
    try {
      if (isMock) {
        const { error } = await supabase.auth.signInWithOtp({ email: loginEmail, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setLoginInfo('Mode test: connexion simulée (aucun email envoyé)');
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({ email: loginEmail, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setLoginInfo('Email envoyé !');
    } catch (e) { setLoginError(normalizeError(e)); }
  }
  async function logout() { try { await supabase.auth.signOut(); setProfile(null); } catch (e) { setLoginError(normalizeError(e)); } }
  async function adminSetMember(userId: string, value: boolean) {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('profiles').update({ is_member: value }).eq?.('id', userId);
      if (error) throw error;
      if (profile && profile.id === userId) setProfile({ ...profile, is_member: value });
      setAdminList(prev => prev.map(u => u.id === userId ? { ...u, is_member: value } : u));
    } catch (e) { alert('Erreur: ' + normalizeError(e)); }
  }

  const filtered = useMemo(() => adminList.filter(p => {
    const t = (p.full_name || p.email || '').toLowerCase();
    return t.includes(search.toLowerCase());
  }), [adminList, search]);

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(180deg,#430808,#120101)', color:'#fff' }}>
      <header style={{ position:'sticky', top:0, background:'rgba(67,8,8,0.6)', borderBottom:'1px solid #5a1313', backdropFilter:'blur(6px)' }}>
        <div style={{ maxWidth:900, margin:'0 auto', padding:'10px 16px', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontWeight:700 }}>BDE Valrose</div>
          <div style={{ fontSize:12, color:'#ffcccc' }}>App adhérents — Carte uniquement</div>
          <div style={{ marginLeft:'auto' }}>
            <Button onClick={() => setShowAccount(true)}>Compte</Button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth:900, margin:'0 auto', padding:'16px' }}>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <Button onClick={()=>setTab('card')}>Carte</Button>
          {isAdmin && <Button onClick={()=>setTab('admin')}>Admin</Button>}
        </div>

        {tab === 'card' && (
          <section
            style={{
              border: '1px solid #5a1313',
              borderRadius: 16,
              padding: 16,
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
            }}
          >
            <h2 style={{ fontSize: 22, marginBottom: 12 }}>Carte d’adhérent</h2>

            {/* Si pas de session ou profil */}
            {(!session?.user || !profile) ? (
              <div>
                <div>Connecte-toi pour voir ta carte.</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input
                    placeholder="email"
                    value={loginEmail}
                    onChange={(e: any) => setLoginEmail(e.target.value)}
                    style={{ background: '#222', color: '#fff' }}
                  />
                  <Button onClick={sendMagicLink}>Se connecter</Button>
                </div>
                {loginError && (
                  <div style={{ color: '#ffaaaa', fontSize: 12, marginTop: 6 }}>
                    {loginError}
                  </div>
                )}
                {loginInfo && (
                  <div style={{ color: '#aaffcc', fontSize: 12, marginTop: 6 }}>
                    {loginInfo}
                  </div>
                )}
              </div>
            ) : profile.is_member ? (
              // ✅ Carte adhérent validé
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                {(() => {
                  // On encode dans le QR les infos du membre
                    const payload = [
                      'BDE Valrose – Carte 2025/2026',
                      `Nom : ${profile.full_name || ''}`,
                      `Email : ${profile.email || ''}`,
                      `Statut : ${profile.is_member ? 'Adhérent validé ✅' : 'Non adhérent ❌'}`
                    ].join('\r\n'); // \r\n fonctionne mieux sur certains scanners

                    return (
                      <div style={{ textAlign: 'center', marginTop: 10 }}>
                        <QRCode
                          value={payload}
                          size={192}
                          logoImage="/logo-bde.png" // mets le logo dans public/logo-bde.png
                          logoWidth={50}
                          qrStyle="dots" // pour un effet plus moderne
                          eyeRadius={6}
                          fgColor="#5a1313"
                          bgColor="#ffffff"
                          removeQrCodeBehindLogo
                          logoOpacity={0.9}
                        />
                        <p style={{ marginTop: 10, color: '#5a1313', fontWeight: 600 }}>
                          Carte d’adhérent 2025/2026
                        </p>
                        <Button onClick={() => setShowQR(true)}>Ouvrir le QR en grand</Button>
                      </div>
                    );
                })()}

                {/* Infos sur la carte */}
                <div style={{ lineHeight: 1.6 }}>
                  <div><b>Nom</b><br />{profile.full_name || '—'}</div>
                  <div><b>Statut</b><br />Adhérent 2025/2026</div>
                  <div><b>Email</b><br />{profile.email}</div>
                  <div><b>ID</b><br />{profile.id}</div>
                  <div>
                    <b>N° adhérent</b><br />
                    {'VAL-2025-' + profile.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <Button onClick={() => window.open(
                      `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                        JSON.stringify({
                          t: 'bde-valrose',
                          uid: profile.id,
                          member: profile.is_member,
                          member_no: 'VAL-2025-' + profile.id.slice(0, 8).toUpperCase(),
                        })
                      )}`,
                      '_blank'
                    )}>
                      Ouvrir le QR en grand
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // ⚠️ Pas encore validé
              <div style={{ color: '#ffaaaa' }}>
                Ton compte n’est pas encore validé comme adhérent.
              </div>
            )}
          </section>
        )}



        {tab==='admin' && isAdmin && (
          <section style={{ border:'1px solid #5a1313', borderRadius:16, padding:16 }}>
            <h2>Panneau Admin — Adhésions</h2>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Input placeholder="Rechercher (nom ou email)..." value={search} onChange={(e:any)=>setSearch(e.target.value)} />
            </div>
            <div style={{ marginTop:12 }}>
              {filtered.map(u => (
                <div key={u.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #3a0a0a' }}>
                  <div>
                    <div style={{ fontWeight:600 }}>{u.full_name || '—'}</div>
                    <div style={{ fontSize:12, color:'#ffcccc' }}>{u.email} • ID: {u.id}</div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:12, background: u.is_member ? '#0a6a2a' : '#7a1010', padding:'2px 8px', borderRadius:6 }}>
                      {u.is_member ? 'Adhérent' : 'Non adhérent'}
                    </span>
                    {u.is_member
                      ? <Button onClick={()=>adminSetMember(u.id, false)}>Retirer</Button>
                      : <Button onClick={()=>adminSetMember(u.id, true)}>Valider</Button>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {/* === Panneau de compte === */}
        {showAccount && (
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
          >
            <div
              style={{
                background: '#1a1a1a',
                border: '1px solid #5a1313',
                borderRadius: 16,
                padding: 24,
                width: 360,
                maxWidth: '90%',
                color: '#fff',
                boxShadow: '0 0 20px rgba(0,0,0,0.5)',
              }}
            >
              <h2 style={{ textAlign: 'center', marginBottom: 16 }}>Mon compte</h2>
              {session?.user ? (
                <>
                  <p><b>Email :</b> {session.user.email}</p>
                  <p><b>Statut :</b> {profile?.is_member ? 'Adhérent' : 'Non adhérent'}</p>
                  <Button style={{ marginTop: 12, width: '100%' }} onClick={async () => {
                    await supabase.auth.signOut();
                    setProfile(null);
                    setShowAccount(false);
                  }}>
                    Se déconnecter
                  </Button>
                </>
              ) : (
                <>
                  <p>Connecte-toi pour accéder à ton compte.</p>
                  <Input
                    placeholder="email"
                    value={loginEmail}
                    onChange={(e: any) => setLoginEmail(e.target.value)}
                    style={{ background: '#222', color: '#fff', width: '100%' }}
                  />
                  <Button style={{ marginTop: 12, width: '100%' }} onClick={sendMagicLink}>
                    Se connecter
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                style={{ marginTop: 16, width: '100%' }}
                onClick={() => setShowAccount(false)}
              >
                Fermer
              </Button>
            </div>
          </div>
        )}
        {/* 🟣 Fenêtre plein écran quand on clique sur "Ouvrir le QR en grand" */}
        {showQR && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setShowQR(false)} // Ferme en cliquant n'importe où
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()} // Empêche de fermer en cliquant sur le QR
              style={{
                background: '#1b0f0f',
                border: '1px solid #7a2a2a',
                borderRadius: 16,
                padding: 20,
                textAlign: 'center',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              }}
            >
              <QRCode
                value={payload} // même variable que pour le petit QR
                size={420}
                logoImage="/logo-bde.png"
                logoWidth={95}
                fgColor="#5a1313"
                bgColor="#ffffff"
                qrStyle="dots"
                eyeRadius={8}
                removeQrCodeBehindLogo
              />
              <div style={{ marginTop: 12, color: '#fff' }}>
                Appuie n’importe où pour fermer
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  
  )
}
