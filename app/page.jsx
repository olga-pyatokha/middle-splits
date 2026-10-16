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
  const [exerciseName, setExerciseName] = useState('Seated straddle compression lifts');
  const [side, setSide] = useState('both');
  const [sets, setSets] = useState('2');
  const [reps, setReps] = useState('5');
  const [holdSeconds, setHoldSeconds] = useState('');
  const [difficulty, setDifficulty] = useState(5);
  const [exerciseNotes, setExerciseNotes] = useState('');
  const [exerciseLogs, setExerciseLogs] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [exerciseSaving, setExerciseSaving] = useState(false);

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

  useEffect(() => {
    if (!user || !supabase) { setExerciseLogs([]); return; }
    let active = true;
    supabase.from('exercise_logs').select('id,session_id,exercise_name,side,sets,reps,hold_seconds,difficulty,notes,created_at')
      .order('created_at', { ascending: false }).limit(100)
      .then(({data,error}) => { if (active) { if (error) setMessage(error.message); else setExerciseLogs(data ?? []); } });
    return () => { active = false; };
  }, [user]);

  async function saveExercise(e) {
    e.preventDefault();
    if (!selectedSession) { setMessage('Choose a workout session first.'); return; }
    setExerciseSaving(true); setMessage('');
    const payload = { user_id: user.id, session_id: selectedSession, exercise_name: exerciseName.trim(),
      side, sets: Number(sets), reps: reps === '' ? null : Number(reps),
      hold_seconds: holdSeconds === '' ? null : Number(holdSeconds),
      difficulty: Number(difficulty), notes: exerciseNotes.trim() };
    const {data,error} = await supabase.from('exercise_logs').insert(payload)
      .select('id,session_id,exercise_name,side,sets,reps,hold_seconds,difficulty,notes,created_at').single();
    if (error) setMessage(error.message);
    else { setExerciseLogs(current => [data,...current]); setExerciseNotes(''); setMessage('Exercise saved!'); }
    setExerciseSaving(false);
  }

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
    else { setSessions(current => [data, ...current]); setSelectedSession(data.id); setNotes(''); setEffort(5); setMessage('Workout saved!'); }
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
      <section className="panel"><div className="sectionhead"><div><span className="eyebrow">DETAILS</span><h2>Log an exercise</h2></div><span className="spark">✳</span></div>
      <p>Save a workout above, then add exercises to it. You can also choose a previous session.</p>
      <form onSubmit={saveExercise}>
        <label>Workout session<select required value={selectedSession} onChange={e=>setSelectedSession(e.target.value)}>
          <option value="">Choose a session</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.session_date} · {s.notes?.slice(0,35) || 'Workout'}</option>)}
        </select></label>
        <label>Exercise<select value={exerciseName} onChange={e=>setExerciseName(e.target.value)}>
          {['Seated straddle compression lifts','Elevated pancake good mornings','Quadruped rock-backs','Middle split hold','Frog stretch','Other'].map(name=><option key={name} value={name}>{name}</option>)}
        </select></label>
        {exerciseName==='Other' && <p>Use the notes field to specify the exercise.</p>}
        <label>Side<select value={side} onChange={e=>setSide(e.target.value)}><option value="both">Both / center</option><option value="left">Left</option><option value="right">Right</option></select></label>
        <div className="fields"><label>Sets<input type="number" min="1" max="100" required value={sets} onChange={e=>setSets(e.target.value)}/></label>
        <label>Reps<input type="number" min="0" max="1000" value={reps} onChange={e=>setReps(e.target.value)}/></label>
        <label>Hold (seconds)<input type="number" min="0" step="0.5" value={holdSeconds} onChange={e=>setHoldSeconds(e.target.value)}/></label></div>
        <label>Difficulty <strong>{difficulty}/10</strong><input type="range" min="1" max="10" value={difficulty} onChange={e=>setDifficulty(e.target.value)}/></label>
        <label>Exercise notes<textarea rows="3" placeholder="Cramping, range of motion, left/right difference…" value={exerciseNotes} onChange={e=>setExerciseNotes(e.target.value)}/></label>
        <button disabled={exerciseSaving || !sessions.length} type="submit">{exerciseSaving?'Saving…':'Save exercise'}</button>
      </form></section>
      <section className="panel"><div className="sectionhead"><div><span className="eyebrow">HISTORY</span><h2>Recent sessions</h2></div><span className="count">{sessions.length}</span></div>
      {sessions.length===0?<p>No workouts yet. Log your first session above.</p>:<div className="history">{sessions.map(s=><article key={s.id} className="entry"><div><strong>{s.session_date}</strong><span>Effort {s.effort ?? '—'}/10</span></div><p>{s.notes || 'Workout completed'}</p>{exerciseLogs.filter(log=>log.session_id===s.id).map(log=><div className="exercise-entry" key={log.id}><strong>{log.exercise_name}</strong><span>{log.side} · {log.sets} sets{log.reps!=null ? ` × ${log.reps} reps` : ''}{log.hold_seconds!=null ? ` · ${log.hold_seconds}s` : ''} · difficulty {log.difficulty}/10</span>{log.notes && <p>{log.notes}</p>}</div>)}</article>)}</div>}</section>
    </>}
    {message && <p role="status" className="status">{message}</p>}
    <footer>Built for the long game 🌿</footer>
  </main>;
}
