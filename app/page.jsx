'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [message, setMessage] = useState('');
  const [sessions, setSessions] = useState([]);
  const [notes, setNotes] = useState('');
  const [effort, setEffort] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !supabase) { setSessions([]); return; }
    let active = true;
    supabase.from('sessions').select('id,session_date,effort,notes,completed').order('session_date', { ascending: false }).limit(30)
      .then(({ data, error }) => { if (active) { if (error) setMessage(error.message); else setSessions(data ?? []); } });
    return () => { active = false; };
  }, [user]);

  async function authenticate(e) {
    e.preventDefault(); setMessage('');
    const { error, data } = mode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else if (mode === 'signup' && !data.session) setMessage('Check your email to confirm your account, then sign in.');
  }

  async function saveWorkout(e) {
    e.preventDefault(); setSaving(true); setMessage('');
    const date = new Date();
    const localDate = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
    const { data, error } = await supabase.from('sessions').insert({
      user_id: user.id, session_date: localDate, effort: Number(effort), notes: notes.trim(), completed: true
    }).select('id,session_date,effort,notes,completed').single();
    if (error) setMessage(error.message);
    else { setSessions(current => [data, ...current]); setNotes(''); setEffort(5); setMessage('Workout saved!'); }
    setSaving(false);
  }

  if (!supabase) return <main className="shell"><h1>Middle Splits</h1><p>Set your Supabase environment variables to connect the app.</p></main>;
  if (loading) return <main className="shell"><p>Loading…</p></main>;

  return <main className="shell">
    <header className="top"><div><span className="eyebrow">FLEXIBILITY JOURNAL</span><h1>Middle Splits <span>✳</span></h1><p>Small sessions. Steady progress.</p></div>{user && <button className="quiet" onClick={() => supabase.auth.signOut()}>Sign out</button>}</header>
    {!user ? <section className="panel"><h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2><p>Sign in to keep your training history private.</p>
      <form onSubmit={authenticate}><label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Password<input type="password" minLength={6} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button type="submit">{mode === 'signin' ? 'Sign in' : 'Sign up'}</button></form>
      <button className="link" onClick={()=>{setMode(mode==='signin'?'signup':'signin');setMessage('');}}>{mode==='signin'?'New here? Create an account':'Already registered? Sign in'}</button>
    </section> : <>
      <section className="panel"><div className="sectionhead"><div><span className="eyebrow">TODAY</span><h2>Log a session</h2></div><span className="spark">↗</span></div>
      <form onSubmit={saveWorkout}><label>How did training feel? <strong>{effort}/10</strong><input type="range" min="1" max="10" value={effort} onChange={e=>setEffort(e.target.value)}/></label>
      <label>Training notes<textarea rows="4" placeholder="What did you practice? Any differences between left and right?" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      <button disabled={saving} type="submit">{saving?'Saving…':'Save workout'}</button></form></section>
      <section className="panel"><div className="sectionhead"><div><span className="eyebrow">HISTORY</span><h2>Recent sessions</h2></div><span className="count">{sessions.length}</span></div>
      {sessions.length===0?<p>No workouts yet. Log your first session above.</p>:<div className="history">{sessions.map(s=><article key={s.id} className="entry"><div><strong>{s.session_date}</strong><span>Effort {s.effort ?? '—'}/10</span></div><p>{s.notes || 'Workout completed'}</p></article>)}</div>}</section>
    </>}
    {message && <p role="status" className="status">{message}</p>}
    <footer>Built for the long game 🌿</footer>
  </main>;
}
