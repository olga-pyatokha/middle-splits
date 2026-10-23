'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const EXERCISES = [
  { name: 'Quadruped rock-backs', sets: 2, reps: 8, hold_seconds: null, minutes: 2, focus: 'mobility', cue: 'Move gently through a comfortable range.' },
  { name: 'Adductor rock-backs', sets: 2, reps: 8, hold_seconds: null, minutes: 3, focus: 'middle', cue: 'Extend one leg to the side; rock back without forcing range.' },
  { name: 'Frog stretch', sets: 2, reps: null, hold_seconds: 30, minutes: 3, focus: 'middle', cue: 'Support your weight and stay in a comfortable stretch.' },
  { name: 'Supported middle split hold', sets: 2, reps: null, hold_seconds: 20, minutes: 4, focus: 'middle', cue: 'Use blocks or hands for support; maintain control.' },
  { name: 'Elevated pancake good mornings', sets: 2, reps: 8, hold_seconds: null, minutes: 4, focus: 'pancake', cue: 'Hinge from the hips; sit on a block if helpful.' },
  { name: 'Seated pancake hold', sets: 2, reps: null, hold_seconds: 30, minutes: 3, focus: 'pancake', cue: 'Keep a comfortable forward hinge rather than rounding to reach farther.' },
  { name: 'Seated straddle compression lifts', sets: 2, reps: 5, hold_seconds: null, minutes: 3, focus: 'strength', cue: 'Use support, stop before cramping; note left/right differences.' },
  { name: 'Wide-stance lateral weight shifts', sets: 2, reps: 6, hold_seconds: null, minutes: 4, focus: 'strength', cue: 'Move slowly and keep the range comfortable.' }
];
const EXERCISE_MEDIA = {
  'Quadruped rock-backs': { url: 'https://www.youtube.com/watch?v=ub7AzL_5IKo', label: 'Watch free YouTube demonstration', youtubeId: 'ub7AzL_5IKo' },
  'Adductor rock-backs': { url: 'https://www.youtube.com/results?search_query=adductor+rock+back+exercise+physical+therapy', label: 'Find free YouTube demonstrations' },
  'Seated straddle compression lifts': { url: 'https://www.youtube.com/watch?v=7MNNGqec0Dc', label: 'Watch on YouTube', youtubeId: '7MNNGqec0Dc' },
  'Supported middle split hold': { url: 'https://www.youtube.com/results?search_query=supported+middle+split+hold+blocks', label: 'Find video examples' },
  'Frog stretch': { url: 'https://www.youtube.com/results?search_query=frog+stretch+proper+form', label: 'Find video examples' },
  'Elevated pancake good mornings': { url: 'https://www.youtube.com/results?search_query=elevated+pancake+good+mornings+exercise', label: 'Find video examples' },
  'Seated pancake hold': { url: 'https://www.youtube.com/results?search_query=seated+pancake+stretch+form', label: 'Find video examples' },
  'Wide-stance lateral weight shifts': { url: 'https://www.youtube.com/results?search_query=wide+stance+lateral+weight+shifts+mobility', label: 'Find video examples' }
};
function exerciseSearchUrl(name, platform) {
  const query = encodeURIComponent(name + ' exercise demonstration');
  return platform === 'instagram'
    ? 'https://www.instagram.com/explore/search/keyword/?q=' + query
    : 'https://www.youtube.com/results?search_query=' + query;
}
const STARTER_PLAN = EXERCISES.slice(0, 3);
const WEEK_FOCUS = ['recovery', 'middle', 'pancake', 'recovery', 'middle', 'pancake', 'mixed'];
const WEEK_LABELS = ['Sun · Recovery', 'Mon · Middle splits', 'Tue · Pancake', 'Wed · Recovery', 'Thu · Middle splits', 'Fri · Pancake', 'Sat · Mixed'];
function buildWorkout(minutes, sessions, logs) {
  const today = new Date();
  const todayKey = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-');
  const day = today.getDay();
  const recentSessions = sessions.filter(s => s.completed && s.session_date < todayKey && (new Date(todayKey+'T12:00:00')-new Date(s.session_date+'T12:00:00'))/86400000 <= 2);
  const recentNames = new Set(logs.filter(l => recentSessions.some(s => s.id === l.session_id)).map(l => l.exercise_name));
  const focus = WEEK_FOCUS[day];
  const order = focus === 'recovery' ? ['mobility','pancake'] :
    focus === 'middle' ? ['mobility','middle','strength','pancake'] :
    focus === 'pancake' ? ['mobility','pancake','strength','middle'] :
    ['mobility','middle','pancake','strength'];
  const candidates = EXERCISES.filter(e => focus !== 'recovery' || e.focus === 'mobility' || e.name === 'Seated pancake hold')
    .sort((a,b) => order.indexOf(a.focus)-order.indexOf(b.focus) || Number(recentNames.has(a.name))-Number(recentNames.has(b.name)));
  // Avoid repeating recent demanding exercises when alternatives in the same category exist.
  const selected = [], used = new Set();
  let remaining = Number(minutes);
  for (const e of candidates) {
    if (used.has(e.name) || e.minutes > remaining) continue;
    selected.push(e); used.add(e.name); remaining -= e.minutes;
  }
  return { label: WEEK_LABELS[day], exercises: selected, estimated: Number(minutes)-remaining };
}
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
  const [activeSession, setActiveSession] = useState(null);
  const [exerciseSaving, setExerciseSaving] = useState(false);
  const [plan, setPlan] = useState(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [workoutMinutes, setWorkoutMinutes] = useState('15');
  const [guidedExercise, setGuidedExercise] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [measurements, setMeasurements] = useState([]);
  const [measurementValue, setMeasurementValue] = useState('');
  const [measurementMethod, setMeasurementMethod] = useState('Floor-to-pelvis gap');
  const [measurementWarmedUp, setMeasurementWarmedUp] = useState(true);
  const [measurementNotes, setMeasurementNotes] = useState('');
  const [measurementSaving, setMeasurementSaving] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !supabase) { setSessions([]); setActiveSession(null); return; }
    let active = true;
    supabase.from('sessions').select('id,session_date,effort,notes,completed').order('session_date', { ascending: false }).limit(30)
      .then(({ data, error }) => { if (active) { if (error) setMessage(error.message); else { setSessions(data ?? []); setActiveSession((data ?? []).find(s=>s.completed===false) ?? null); } } });
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

  useEffect(() => {
    if (!user || !supabase) { setPlan(null); return; }
    let active = true;
    supabase.from('training_plans').select('id,title,version,plan,status').eq('status','active')
      .order('created_at',{ascending:false}).limit(1)
      .then(({data,error}) => { if (active) { if (error) setMessage(error.message); else setPlan(data?.[0] ?? null); } });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) { setMeasurements([]); return; }
    let active = true;
    supabase.from('measurements').select('id,measured_at,metric,value_cm,method,warmed_up,notes')
      .eq('metric','middle_split_gap_cm').order('measured_at',{ascending:true}).limit(100)
      .then(({data,error}) => { if (active) { if (error) setMessage(error.message); else setMeasurements(data ?? []); } });
    return () => { active = false; };
  }, [user]);

  async function saveMeasurement(e) {
    e.preventDefault(); setMeasurementSaving(true); setMessage('');
    const value = Number(measurementValue);
    if (!Number.isFinite(value) || value < 0 || measurementValue.trim()==='') {
      setMessage('Enter a valid non-negative measurement in centimeters.');
      setMeasurementSaving(false); return;
    }
    const {data,error} = await supabase.from('measurements').insert({
      user_id:user.id, measured_at:new Date().toISOString(), metric:'middle_split_gap_cm',
      value_cm:value, method:measurementMethod, warmed_up:measurementWarmedUp, notes:measurementNotes.trim()
    }).select('id,measured_at,metric,value_cm,method,warmed_up,notes').single();
    if (error) setMessage(error.message);
    else { setMeasurements(current=>[...current,data].sort((a,b)=>new Date(a.measured_at)-new Date(b.measured_at))); setMeasurementValue(''); setMeasurementNotes(''); setMessage('Measurement saved!'); }
    setMeasurementSaving(false);
  }

  async function createStarterPlan() {
    setPlanSaving(true); setMessage('');
    const {data,error} = await supabase.from('training_plans').insert({
      user_id:user.id,title:'Middle Splits · Starter Routine',version:1,status:'active',
      plan:{ exercises:STARTER_PLAN, note:'Starter template, not a personalized medical or training prescription. Adjust to comfort.' }
    }).select('id,title,version,plan,status').single();
    if (error) setMessage(error.message);
    else {setPlan(data);setMessage('Starter routine saved!');}
    setPlanSaving(false);
  }

  function prepareExercise(item) {
    if (!activeSession) { setMessage('Start a session to log this exercise.'); document.getElementById('session-control')?.scrollIntoView({behavior:'smooth'}); return; }
    setExerciseName(item.name); setSide('both'); setSets(String(item.sets));
    setReps(item.reps == null ? '' : String(item.reps));
    setHoldSeconds(item.hold_seconds == null ? '' : String(item.hold_seconds));
    setExerciseNotes(item.cue || '');
    document.getElementById('exercise-form')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function openGuide(item) {
    setGuidedExercise(item);
    setSecondsLeft(item.minutes * 60);
    setTimerRunning(false);
  }
  useEffect(() => {
    if (!timerRunning || secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [timerRunning, secondsLeft]);
  useEffect(() => {
    if (secondsLeft === 0) setTimerRunning(false);
  }, [secondsLeft]);

  async function saveExercise(e) {
    e.preventDefault();
    if (!activeSession) { setMessage('Start a workout session first.'); return; }
    setExerciseSaving(true); setMessage('');
    const payload = { user_id: user.id, session_id: activeSession.id, exercise_name: exerciseName.trim(),
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

  async function startWorkout() {
    if (activeSession || saving) return;
    setSaving(true); setMessage('');
    const date = new Date();
    const localDate = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
    const { data, error } = await supabase.from('sessions').insert({
      user_id:user.id, session_date:localDate, plan_id:plan?.id ?? null,
      completed:false
    }).select('id,session_date,effort,notes,completed').single();
    if (error) setMessage(error.message);
    else { setSessions(current=>[data,...current]); setActiveSession(data); setMessage('Session started. Log your exercises below.'); }
    setSaving(false);
  }

  async function endWorkout(e) {
    e.preventDefault();
    if (!activeSession || saving) return;
    setSaving(true); setMessage('');
    const {data,error} = await supabase.from('sessions')
      .update({effort:Number(effort),notes:notes.trim(),completed:true})
      .eq('id',activeSession.id).eq('completed',false)
      .select('id,session_date,effort,notes,completed').single();
    if (error) setMessage(error.message);
    else { setSessions(current=>current.map(s=>s.id===data.id?data:s)); setActiveSession(null); setNotes(''); setEffort(5); setMessage('Session completed!'); }
    setSaving(false);
  }

  const [exporting, setExporting] = useState(false);
  async function exportTrainingHistory() {
    if (!user || !supabase || exporting) return;
    setExporting(true); setMessage('');
    try {
      const tables = ['sessions', 'exercise_logs', 'measurements', 'training_plans', 'coach_reviews'];
      const history = {};
      for (const table of tables) {
        const rows = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from(table).select('*')
            .eq('user_id', user.id).range(offset, offset + 499);
          if (error) throw new Error(table + ': ' + error.message);
          rows.push(...(data || []));
          if (!data || data.length < 500) break;
        }
        history[table] = rows;
      }
      const payload = { format: 'middle-splits-training-export', version: 1,
        exported_at: new Date().toISOString(), history };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'middle-splits-training-' + new Date().toISOString().slice(0,10) + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Training history exported. You can upload the JSON file to ChatGPT for a session review.');
    } catch (error) {
      setMessage('Export failed: ' + error.message);
    } finally {
      setExporting(false);
    }
  }

  const suggestedWorkout = buildWorkout(workoutMinutes, sessions, exerciseLogs);

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
      <section className="panel" id="session-control"><div className="sectionhead"><div><span className="eyebrow">TODAY</span><h2>{activeSession?'Session in progress':'Ready to train?'}</h2></div><span className="spark">↗</span></div>
      {!activeSession ? <><p>Start a session, then log as many exercises as you like. Your workout stays active if you refresh or close the page.</p>
        <button disabled={saving} onClick={startWorkout}>{saving?'Starting…':'Start session'}</button></> :
        <><p className="active-indicator">● Active workout · {activeSession.session_date}</p>
        <p>Log your exercises below. When you finish, add a session summary and end your workout.</p>
        <form onSubmit={endWorkout}><label>Overall effort <strong>{effort}/10</strong><input type="range" min="1" max="10" value={effort} onChange={e=>setEffort(e.target.value)}/></label>
        <label>Session notes<textarea rows="3" placeholder="How did it feel overall?" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <button disabled={saving} type="submit">{saving?'Finishing…':'End session'}</button></form></>}
      </section>
      <section className="panel"><div className="sectionhead"><div><span className="eyebrow">YOUR ROUTINE</span><h2>This week's training</h2></div><span className="spark">✦</span></div>
        <p>Middle splits and pancake, with lighter recovery days. Today's exercises take recent completed sessions into account.</p>
        <div className="week-overview">{WEEK_LABELS.map((label,i)=><span key={label} className={i===new Date().getDay()?'week-day current':'week-day'}>{label}</span>)}</div>
        <label>Time available
          <select value={workoutMinutes} onChange={e=>setWorkoutMinutes(e.target.value)}>
            <option value="5">5 minutes · Quick</option><option value="15">15 minutes · Regular</option><option value="30">30 minutes · Extended</option>
          </select>
        </label>
        <h3>{suggestedWorkout.label} · About {suggestedWorkout.estimated} min</h3>
        <div className="routine">{suggestedWorkout.exercises.map(item=>
          <article className="routine-item" key={item.name}><div><strong>{item.name}</strong>
            <span>{item.sets} sets {item.reps != null ? '× '+item.reps+' reps' : '× '+item.hold_seconds+'s'} · ~{item.minutes} min</span><p>{item.cue}</p></div>
            <div className="routine-actions"><button className="routine-button" onClick={()=>openGuide(item)}>Guide / timer</button><button className="routine-button" onClick={()=>prepareExercise(item)}>Log this</button></div></article>)}</div>
        {guidedExercise && <div className="guide-panel">
          <div className="sectionhead"><h3>{guidedExercise.name}</h3><button className="quiet" onClick={()=>{setGuidedExercise(null);setTimerRunning(false);}}>Close</button></div>
          <p>{guidedExercise.cue}</p>
          <p>{guidedExercise.sets} sets {guidedExercise.reps != null ? '× '+guidedExercise.reps+' controlled reps' : '× '+guidedExercise.hold_seconds+' seconds'} · Suggested block: {guidedExercise.minutes} min (including setup and rest)</p>
          {EXERCISE_MEDIA[guidedExercise.name] && <div className="exercise-media">
            {EXERCISE_MEDIA[guidedExercise.name].youtubeId && <a href={EXERCISE_MEDIA[guidedExercise.name].url} target="_blank" rel="noopener noreferrer"><img loading="lazy" alt={'Video preview for '+guidedExercise.name} src={'https://img.youtube.com/vi/'+EXERCISE_MEDIA[guidedExercise.name].youtubeId+'/hqdefault.jpg'} /></a>}
            <a href={EXERCISE_MEDIA[guidedExercise.name].url} target="_blank" rel="noopener noreferrer">{EXERCISE_MEDIA[guidedExercise.name].label} ↗</a>
          </div>}
          <div className="exercise-links">
            <a href={exerciseSearchUrl(guidedExercise.name, 'youtube')} target="_blank" rel="noopener noreferrer">Search YouTube ↗</a>
            <a href={exerciseSearchUrl(guidedExercise.name, 'instagram')} target="_blank" rel="noopener noreferrer">Search Instagram ↗</a>
          </div>
          <div className="timer-display" role="timer">{String(Math.floor(secondsLeft/60)).padStart(2,'0')}:{String(secondsLeft%60).padStart(2,'0')}</div>
          <div className="timer-actions"><button onClick={()=>setTimerRunning(v=>!v)} disabled={secondsLeft===0}>{timerRunning?'Pause':'Start / resume'}</button><button className="routine-button" onClick={()=>{setTimerRunning(false);setSecondsLeft(guidedExercise.minutes*60);}}>Reset</button>{guidedExercise.hold_seconds && <button className="routine-button" onClick={()=>{setTimerRunning(false);setSecondsLeft(guidedExercise.hold_seconds);}}>Hold timer</button>}</div>
          <p className="routine-note">The timer guides your pace; you can pause for setup or rest. For reps, move slowly rather than rushing to fill the time. Stop for pain or cramping.</p>
          <button className="routine-button" onClick={()=>prepareExercise(guidedExercise)}>Log this exercise</button>
        </div>}
        <p className="routine-note">Suggestions adjust to the day and recent exercise history. You can still log any exercise below. Your session notes and effort feedback stay unchanged.</p>
      </section>
      <section className="panel" id="exercise-form"><div className="sectionhead"><div><span className="eyebrow">DETAILS</span><h2>Log an exercise</h2></div><span className="spark">✳</span></div>
      <p>{activeSession ? 'Exercises automatically save to your active session.' : 'Start a session above to log exercises.'}</p>
      <form onSubmit={saveExercise}>

        <label>Exercise<select value={exerciseName} onChange={e=>setExerciseName(e.target.value)}>
          {[...EXERCISES.map(e=>e.name),'Other'].map(name=><option key={name} value={name}>{name}</option>)}
        </select></label>
        {exerciseName==='Other' && <p>Use the notes field to specify the exercise.</p>}
        <label>Side<select value={side} onChange={e=>setSide(e.target.value)}><option value="both">Both / center</option><option value="left">Left</option><option value="right">Right</option></select></label>
        <div className="fields"><label>Sets<input type="number" min="1" max="100" required value={sets} onChange={e=>setSets(e.target.value)}/></label>
        <label>Reps<input type="number" min="0" max="1000" value={reps} onChange={e=>setReps(e.target.value)}/></label>
        <label>Hold (seconds)<input type="number" min="0" step="0.5" value={holdSeconds} onChange={e=>setHoldSeconds(e.target.value)}/></label></div>
        <label>Difficulty <strong>{difficulty}/10</strong><input type="range" min="1" max="10" value={difficulty} onChange={e=>setDifficulty(e.target.value)}/></label>
        <label>Exercise notes<textarea rows="3" placeholder="Cramping, range of motion, left/right difference…" value={exerciseNotes} onChange={e=>setExerciseNotes(e.target.value)}/></label>
        <button disabled={exerciseSaving || !activeSession} type="submit">{exerciseSaving?'Saving…':'Save exercise'}</button>
      </form></section>
      <section className="panel"><div className="sectionhead"><div><span className="eyebrow">PROGRESS</span><h2>Middle-splits measurements</h2></div><span className="spark">↘</span></div>
        <p>Measure the vertical gap from the floor to your pelvis in centimeters, using the same position and setup each time. A smaller gap means you are closer to the floor.</p>
        <form onSubmit={saveMeasurement}>
          <label>Gap to floor (cm)<input type="number" min="0" step="0.1" required placeholder="e.g. 25.5" value={measurementValue} onChange={e=>setMeasurementValue(e.target.value)}/></label>
          <label>Method<select value={measurementMethod} onChange={e=>setMeasurementMethod(e.target.value)}>
            <option>Floor-to-pelvis gap</option><option>Block-supported floor-to-pelvis gap</option>
          </select></label>
          <label className="checkline"><input type="checkbox" checked={measurementWarmedUp} onChange={e=>setMeasurementWarmedUp(e.target.checked)}/> Measured after warming up</label>
          <label>Notes<textarea rows="2" placeholder="Position, blocks, discomfort, setup…" value={measurementNotes} onChange={e=>setMeasurementNotes(e.target.value)}/></label>
          <button disabled={measurementSaving} type="submit">{measurementSaving?'Saving…':'Save measurement'}</button>
        </form>
        {measurements.length > 0 && <div className="measure-history">
          <h3>Progress history</h3>
          {measurements.length > 1 && <div className="chart-scroll"><svg viewBox="0 0 320 150" role="img" aria-label="Middle splits floor gap over time" className="progress-chart">
            {(() => {
              const vals=measurements.map(m=>Number(m.value_cm));
              const low=Math.min(...vals), high=Math.max(...vals), span=Math.max(1,high-low);
              const pts=vals.map((v,i)=>[20+i*280/Math.max(1,vals.length-1),15+(high-v)/span*110]);
              return <><line x1="20" y1="125" x2="300" y2="125" stroke="#cad8cb"/><polyline points={pts.map(p=>p.join(',')).join(' ')} fill="none" stroke="#426e50" strokeWidth="3" strokeLinejoin="round"/>{pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#426e50"/>)}</>;
            })()}
          </svg></div>}
          <div className="history">{[...measurements].reverse().slice(0,8).map(m=><article key={m.id} className="entry"><div><strong>{Number(m.value_cm)} cm</strong><span>{new Date(m.measured_at).toLocaleDateString()}</span></div><p>{m.method} · {m.warmed_up?'Warmed up':'Not warmed up'}{m.notes?' · '+m.notes:''}</p></article>)}</div>
        </div>}
      </section>
      <section className="panel"><div className="sectionhead"><div><span className="eyebrow">HISTORY</span><h2>Recent sessions</h2></div><span className="count">{sessions.length}</span></div>
      {sessions.length===0?<p>No workouts yet. Log your first session above.</p>:<div className="history">{sessions.map(s=><article key={s.id} className="entry"><div><strong>{s.session_date}</strong><span>{s.completed ? `Effort ${s.effort ?? '—'}/10` : 'In progress'}</span></div><p>{s.notes || (s.completed ? 'Workout completed' : 'Workout in progress')}</p>{exerciseLogs.filter(log=>log.session_id===s.id).map(log=><div className="exercise-entry" key={log.id}><strong>{log.exercise_name}</strong><span>{log.side} · {log.sets} sets{log.reps!=null ? ` × ${log.reps} reps` : ''}{log.hold_seconds!=null ? ` · ${log.hold_seconds}s` : ''} · difficulty {log.difficulty}/10</span>{log.notes && <p>{log.notes}</p>}</div>)}</article>)}</div>}
      <div className="export-history">
        <h3>Share your training history</h3>
        <p>Download your sessions, exercise feedback, measurements and plans as a JSON file to upload to ChatGPT. Your data stays private until you choose to share the file.</p>
        <button type="button" disabled={exporting} onClick={exportTrainingHistory}>
          {exporting ? 'Preparing export…' : '↓ Export training history'}
        </button>
      </div>
      </section>
    </>}
    {message && <p role="status" className="status">{message}</p>}
    <footer>Built for the long game 🌿</footer>
  </main>;
}
