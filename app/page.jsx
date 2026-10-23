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
  // Once today's workout is complete, preview the following day's lesson instead of repeating today's focus.
  const finishedToday = sessions.some(s => s.completed && s.session_date === todayKey);
  const previewDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (finishedToday ? 1 : 0));
  const day = previewDate.getDay();
  const previewKey = [previewDate.getFullYear(), String(previewDate.getMonth()+1).padStart(2,'0'), String(previewDate.getDate()).padStart(2,'0')].join('-');
  const recentSessions = sessions.filter(s => s.completed && s.session_date < previewKey && (new Date(previewKey+'T12:00:00')-new Date(s.session_date+'T12:00:00'))/86400000 <= 2);
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
  return { label: WEEK_LABELS[day], exercises: selected, estimated: Number(minutes)-remaining, previewDate: previewKey, isNextDay: finishedToday };
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
  const [setIndex, setSetIndex] = useState(1);
  const [setFeedback, setSetFeedback] = useState('');
  const [loggedSetCounts, setLoggedSetCounts] = useState({});
  const [setTarget, setSetTarget] = useState(2);
  const [plan, setPlan] = useState(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [workoutMinutes, setWorkoutMinutes] = useState('15');
  const [guidedExercise, setGuidedExercise] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDuration, setTimerDuration] = useState(30);
  const [completedReps, setCompletedReps] = useState(0);
  const [completedSets, setCompletedSets] = useState(0);
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
    else { setMeasurements(current=>[...current,data].sort((a,b)=>new Date(a.measured_at)-new Date(b.measured_at))); setMeasurementValue(''); setMeasurementNotes(''); setMessage('Measurement saved!'); if(sessionStage==='measurement'){setSessionStage('exercises');setScreen('home');} }
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
    setScreen('session');setSessionStage('exercises');setExerciseName(item.name); setSide('both'); setSets('1'); setSetTarget(item.sets);
    const savedCount = exerciseLogs.filter(l=>l.session_id===activeSession.id && l.exercise_name===item.name && l.notes?.startsWith('[Set ')).length;
    setSetIndex(savedCount+1); setLoggedSetCounts(v=>({...v,[item.name]:savedCount})); setSetFeedback('');
    setReps(item.reps == null ? '' : String(item.reps));
    setHoldSeconds(item.hold_seconds == null ? '' : String(item.hold_seconds));
    setExerciseNotes(item.cue || '');
    document.getElementById('exercise-form')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function openGuide(item) {
    if (guidedExercise?.name === item.name) { setGuidedExercise(null); setTimerRunning(false); return; }
    setGuidedExercise(item);
    setCompletedReps(0);
    setCompletedSets(0);
    const duration = item.hold_seconds || 30;
    setTimerDuration(duration);
    setSecondsLeft(duration);
    setTimerRunning(false);
  }
  function setGuideDuration(value) {
    const duration = Math.max(1, Math.min(600, Number(value) || 1));
    setTimerDuration(duration); setSecondsLeft(duration); setTimerRunning(false);
  }
  function recordRep() {
    if (!guidedExercise) return;
    const target = guidedExercise.reps || 1;
    if (completedReps + 1 >= target) { setCompletedReps(0); setCompletedSets(v => Math.min(guidedExercise.sets, v + 1)); }
    else setCompletedReps(v => v + 1);
    setTimerRunning(false); setSecondsLeft(timerDuration);
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
      side, sets: 1, reps: reps === '' ? null : Number(reps),
      hold_seconds: holdSeconds === '' ? null : Number(holdSeconds),
      difficulty: Number(difficulty), notes: '[Set '+setIndex+'] '+[setFeedback.trim(),exerciseNotes.trim()].filter(Boolean).join(' · ') };
    const {data,error} = await supabase.from('exercise_logs').insert(payload)
      .select('id,session_id,exercise_name,side,sets,reps,hold_seconds,difficulty,notes,created_at').single();
    if (error) setMessage(error.message);
    else {
      setExerciseLogs(current => [data,...current]);
      setLoggedSetCounts(current=>({...current,[exerciseName]:(current[exerciseName]||0)+1}));
      setSetIndex(v=>v+1); setSetFeedback(''); setExerciseNotes('');
      setMessage('Set '+setIndex+' saved!');
      if(carry.includes(exerciseName))toggleCarry(exerciseName);
    }
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
    else { const next={...timings,[data.id]:{started:new Date().toISOString()}};setTimings(next);persist('timings',next);setSessions(current=>[data,...current]); setActiveSession(data); setScreen('session');setSessionStage('exercises'); setMessage('Session started. Log your exercises below.'); }
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
    else { const next={...timings,[data.id]:{...timings[data.id],ended:new Date().toISOString()}};setTimings(next);persist('timings',next);setSessions(current=>current.map(s=>s.id===data.id?data:s)); setActiveSession(null); setNotes(''); setEffort(5); setSessionStage('measurement');setScreen('session');setMessage('Session completed. Add a measurement if you want, or finish.'); }
    setSaving(false);
  }

  const [exporting, setExporting] = useState(false);
  const [screen, setScreen] = useState('home');
  const [sessionStage, setSessionStage] = useState('exercises');
  const [openDay, setOpenDay] = useState(null);
  const [openHistory, setOpenHistory] = useState(null);
  const [carry, setCarry] = useState([]);
  const [timings, setTimings] = useState({});
  const [goalDays, setGoalDays] = useState(3);
  const [goalMinutes, setGoalMinutes] = useState(60);
  const [clock, setClock] = useState(Date.now());
  useEffect(()=>{
    if(!user)return;
    const key='splits:'+user.id+':';
    try {
      setCarry(JSON.parse(localStorage.getItem(key+'carry')||'[]'));
      setTimings(JSON.parse(localStorage.getItem(key+'timings')||'{}'));
      setGoalDays(Number(localStorage.getItem(key+'days')||3));
      setGoalMinutes(Number(localStorage.getItem(key+'minutes')||60));
    } catch {}
  },[user]);
  useEffect(()=>{if(!activeSession)return;const id=setInterval(()=>setClock(Date.now()),1000);return ()=>clearInterval(id)},[activeSession]);
  function persist(k,v){if(user)localStorage.setItem('splits:'+user.id+':'+k,JSON.stringify(v))}
  function toggleCarry(name){const next=carry.includes(name)?carry.filter(n=>n!==name):[...carry,name];setCarry(next);persist('carry',next)}
  function elapsed(s){const t=timings[s.id];return t?.started ? Math.max(0,Math.round(((t.ended?new Date(t.ended).getTime():clock)-new Date(t.started).getTime())/60000)) : null}

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
  const workoutItems=[...carry.map(n=>EXERCISES.find(e=>e.name===n)).filter(Boolean),...suggestedWorkout.exercises.filter(e=>!carry.includes(e.name))];
  const today=new Date(),monday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-((today.getDay()+6)%7));
  const mondayKey=[monday.getFullYear(),String(monday.getMonth()+1).padStart(2,'0'),String(monday.getDate()).padStart(2,'0')].join('-');
  const weekSessions=sessions.filter(s=>s.completed&&s.session_date>=mondayKey);
  const activeDays=new Set(weekSessions.map(s=>s.session_date)).size;
  const weekMinutes=weekSessions.reduce((sum,s)=>sum+(elapsed(s)||0),0);


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
      <nav className="app-tabs" aria-label="App sections"><button className={screen==='home'?'selected':''} onClick={()=>setScreen('home')}>⌂ Home</button><button className={screen==='session'?'selected':''} onClick={()=>setScreen('session')}>▶ Workout</button><button className={screen==='history'?'selected':''} onClick={()=>setScreen('history')}>↗ Progress</button></nav>
      {screen==='home' && <section className="panel dashboard-panel">
        <span className="eyebrow">YOUR PROGRESS</span><h2>Training overview</h2>
        <div className="dashboard-stats"><div><strong>{activeDays}/{goalDays}</strong><span>Active days this week</span></div><div><strong>{weekMinutes}/{goalMinutes}</strong><span>Tracked minutes</span></div><div><strong>{measurements.length?Number(measurements[measurements.length-1].value_cm)+' cm':'—'}</strong><span>Latest split gap</span></div></div>
        <h3>{suggestedWorkout.isNextDay?'Up next · Tomorrow':'Next session'}</h3><p>{suggestedWorkout.label} · {suggestedWorkout.previewDate} · About {suggestedWorkout.estimated} min</p>
        <div className="next-preview">{workoutItems.length?workoutItems.map(item=><span key={item.name}>{item.name}</span>):<span>No exercises planned</span>}</div>
        <button onClick={()=>{setScreen('session');setSessionStage('exercises')}}>{activeSession?'Continue session →':'View session →'}</button>
      </section>}
      {screen==='home' && <section className="panel"><div className="sectionhead"><div><span className="eyebrow">YOUR WEEK</span><h2>Weekly training</h2></div><span className="spark">✦</span></div>
        <p>Tap a day to see what you've completed. Your goals and weekly progress live here, separate from the workout screen.</p>
        <div className="week-overview">{WEEK_LABELS.map((label,i)=>{
          const day=new Date(monday);day.setDate(day.getDate()+((i+6)%7));
          const date=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');
          const records=sessions.filter(s=>s.session_date===date);
          return <div key={date}><button type="button" className="week-day day-toggle" aria-expanded={openDay===date} onClick={()=>setOpenDay(openDay===date?null:date)}>{label} {records.some(s=>s.completed)?'✓':''} {openDay===date?'↑':'↓'}</button>{openDay===date&&<div className="day-details"><strong>{date}</strong><p>{records.length?records.length+' session(s)':'No workout logged'}</p>{records.map(s=><p key={s.id}>{s.completed?'Completed':'In progress'} · {exerciseLogs.filter(l=>l.session_id===s.id).length} exercises · {elapsed(s)===null?'Time unavailable':elapsed(s)+' min'}</p>)}</div>}</div>;
        })}</div>
        <div className="goal-progress"><h3>Weekly activity goals</h3><p><strong>{activeDays}/{goalDays} active days</strong> · {weekMinutes}/{goalMinutes} tracked minutes</p><div className="goal-meter"><span style={{width:Math.min(100,activeDays/Math.max(1,goalDays)*100)+'%'}}/></div><div className="goal-settings"><label>Days/week<select value={goalDays} onChange={e=>{const n=Number(e.target.value);setGoalDays(n);persist('days',n)}}>{[1,2,3,4,5,6,7].map(n=><option key={n}>{n}</option>)}</select></label><label>Minutes/week<input type="number" min="5" max="1000" value={goalMinutes} onChange={e=>{const n=Number(e.target.value);setGoalMinutes(n);persist('minutes',n)}}/></label></div><p className="routine-note">Completed workout days count toward your goal. Time tracking starts with new sessions on this device; older durations may be unavailable.</p></div>
      </section>}
      {screen==='session' && <section className="panel" id="session-control"><div className="sectionhead"><div><span className="eyebrow">TODAY</span><h2>{activeSession?'Session in progress':'Ready to train?'}</h2></div><span className="spark">↗</span></div>
      {!activeSession ? <><p>Start a session, then log as many exercises as you like. Your workout stays active if you refresh or close the page.</p>
        <button disabled={saving} onClick={startWorkout}>{saving?'Starting…':'Start session'}</button></> :
        <><p className="active-indicator">● Active workout · {activeSession.session_date}</p>
        <p>Active time: {elapsed(activeSession)===null?'Not tracked on this device':elapsed(activeSession)+' min'}. Log exercises below, then finish your session.</p>
        <button className="quiet" onClick={()=>setSessionStage('measurement')}>Measure now (optional) →</button><form onSubmit={endWorkout}><label>Overall effort <strong>{effort}/10</strong><input type="range" min="1" max="10" value={effort} onChange={e=>setEffort(e.target.value)}/></label>
        <label>Session notes<textarea rows="3" placeholder="How did it feel overall?" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <button disabled={saving} type="submit">{saving?'Finishing…':'End session'}</button></form></>}
      </section>}
      {screen==='session' && sessionStage==='exercises' && <section className="panel"><div className="sectionhead"><div><span className="eyebrow">WORKOUT</span><h2>Session exercises</h2></div><span className="spark">✦</span></div>
        <p>Open an exercise for guidance and log each set while your session is active.</p>
        <label>Time available
          <select value={workoutMinutes} onChange={e=>setWorkoutMinutes(e.target.value)}>
            <option value="5">5 minutes · Quick</option><option value="15">15 minutes · Regular</option><option value="30">30 minutes · Extended</option>
          </select>
        </label>
        <h3>{suggestedWorkout.label} · {suggestedWorkout.previewDate} · About {suggestedWorkout.estimated} min</h3><p className="routine-note">Open an exercise to see guidance and timing. Log sets after starting the session.</p>
        <div className="routine">{workoutItems.map(item=>
          <article className="routine-item" key={item.name}><div><strong>{item.name}</strong>
            <span>{item.sets} sets {item.reps != null ? '× '+item.reps+' reps' : '× '+item.hold_seconds+'s'} · ~{item.minutes} min</span><p>{item.cue}</p></div>
            <div className="routine-actions"><button className="routine-button" aria-expanded={guidedExercise?.name===item.name} onClick={()=>openGuide(item)}>{guidedExercise?.name===item.name?'Close exercise ↑':'Open exercise ↓'}</button><button className="quiet" onClick={()=>toggleCarry(item.name)}>{carry.includes(item.name)?'✓ Carried over':'↪ Do next time'}</button></div>
          {guidedExercise?.name===item.name && <div className="guide-panel">
            <p>{item.cue}</p>
            <p><strong>{item.sets} sets {item.reps != null ? '× '+item.reps+' reps' : '× '+item.hold_seconds+'s holds'}</strong> · ~{item.minutes} min including rest</p>
            {EXERCISE_MEDIA[item.name] && <div className="exercise-media">
              {EXERCISE_MEDIA[item.name].youtubeId && <a href={EXERCISE_MEDIA[item.name].url} target="_blank" rel="noopener noreferrer"><img loading="lazy" alt={'Video preview for '+item.name} src={'https://img.youtube.com/vi/'+EXERCISE_MEDIA[item.name].youtubeId+'/hqdefault.jpg'}/></a>}
              <a href={EXERCISE_MEDIA[item.name].url} target="_blank" rel="noopener noreferrer">{EXERCISE_MEDIA[item.name].label} ↗</a>
            </div>}
            <div className="exercise-links">
              <a href={exerciseSearchUrl(item.name,'youtube')} target="_blank" rel="noopener noreferrer">YouTube demos ↗</a>
              <a href={exerciseSearchUrl(item.name,'instagram')} target="_blank" rel="noopener noreferrer">Instagram demos ↗</a>
            </div>
            {item.reps == null && <label>Hold timer (seconds)
              <input type="number" min="1" max="600" value={timerDuration} onChange={e=>setGuideDuration(e.target.value)}/>
            </label>}
            {item.reps == null && <div className="timer-display" role="timer" aria-live="off">{String(Math.floor(secondsLeft/60)).padStart(2,'0')}:{String(secondsLeft%60).padStart(2,'0')}</div>
            {item.reps == null && <div className="timer-actions">
              <button onClick={()=>{if(secondsLeft===0)setSecondsLeft(timerDuration);setTimerRunning(v=>!v)}}>{timerRunning?'Pause':'Start timer'}</button>
              <button className="routine-button" onClick={()=>{setTimerRunning(false);setSecondsLeft(timerDuration)}}>Reset timer</button>
            </div>}
            <div className="rep-progress"><strong>{completedSets} / {item.sets} sets complete</strong><span>{item.reps != null ? completedReps+' / '+item.reps+' reps in current set' : 'Tap after each hold'}</span></div>
            <div className="timer-actions">
              <button onClick={recordRep} disabled={completedSets>=item.sets}>✓ {item.reps != null?'Log rep':'Log hold'}</button>
              <button className="routine-button" onClick={()=>{setCompletedReps(0);setCompletedSets(0);setTimerRunning(false);setSecondsLeft(timerDuration)}}>Reset count</button>
            </div>
            <p className="routine-note">{item.reps != null?'Count reps at your own pace. No per-rep timer.':'Use the timer for your hold.'} Stop if you feel pain or cramping. Save each set below.</p>
            <button onClick={()=>{prepareExercise(item);setReps(item.reps==null?'':String(item.reps));}}>Log a set ↓</button>
          </div>}
          </article>)}</div>
        <p className="routine-note">Suggestions adjust to the day and recent exercise history. You can still log any exercise below. Your session notes and effort feedback stay unchanged.</p>
      </section>}
      {screen==='session' && sessionStage==='exercises' && activeSession && <section className="panel" id="exercise-form"><div className="sectionhead"><div><span className="eyebrow">DETAILS</span><h2>Log an exercise</h2></div><span className="spark">✳</span></div>
      <p>{activeSession ? 'Exercises automatically save to your active session.' : 'Start a session above to log exercises.'}</p>
      <form onSubmit={saveExercise}>

        <label>Exercise<select value={exerciseName} onChange={e=>{setExerciseName(e.target.value);setSetIndex(1);setSetFeedback('');setLoggedSetCounts(v=>({...v,[e.target.value]:exerciseLogs.filter(l=>l.session_id===activeSession?.id&&l.exercise_name===e.target.value&&l.notes?.startsWith('[Set ')).length}));}}>
          {[...EXERCISES.map(e=>e.name),'Other'].map(name=><option key={name} value={name}>{name}</option>)}
        </select></label>
        {exerciseName==='Other' && <p>Use the notes field to specify the exercise.</p>}
        <label>Side<select value={side} onChange={e=>setSide(e.target.value)}><option value="both">Both / center</option><option value="left">Left</option><option value="right">Right</option></select></label>
        <div className="set-counter"><strong>Set {setIndex} of {setTarget}</strong><span>{exerciseLogs.filter(l=>l.session_id===activeSession?.id&&l.exercise_name===exerciseName&&l.notes?.startsWith('[Set ')).length} saved this session</span></div>
        <div className="fields"><label>Sets<input type="number" min="1" max="100" value="1" disabled readOnly/></label>
        <label>Reps<input type="number" min="0" max="1000" value={reps} onChange={e=>setReps(e.target.value)}/></label>
        <label>Hold (seconds)<input type="number" min="0" step="0.5" value={holdSeconds} onChange={e=>setHoldSeconds(e.target.value)}/></label></div>
        <label>Difficulty <strong>{difficulty}/10</strong><input type="range" min="1" max="10" value={difficulty} onChange={e=>setDifficulty(e.target.value)}/></label>
        <label>How did this set feel?<textarea rows="2" placeholder="Range, control, cramping, left/right difference…" value={setFeedback} onChange={e=>setSetFeedback(e.target.value)}/></label>
        <label>Additional exercise notes<textarea rows="2" placeholder="Optional notes…" value={exerciseNotes} onChange={e=>setExerciseNotes(e.target.value)}/></label>
        <button disabled={exerciseSaving || !activeSession} type="submit">{exerciseSaving?'Saving…':'✓ Save set '+setIndex}</button>
        <p className="routine-note">Each tap saves one set separately, with its own reps, hold duration, difficulty and feedback. You can adjust the next set before saving.</p>
      </form></section>}
      {screen==='session' && sessionStage==='measurement' && <section className="panel"><div className="sectionhead"><div><span className="eyebrow">PROGRESS</span><h2>Middle-splits measurements</h2></div><span className="spark">↘</span></div>
        <p>Optional end-of-session measurement. Measure the vertical gap from the floor to your pelvis in centimeters, using the same position and setup each time.</p>
        <button className="quiet" onClick={()=>{setSessionStage('exercises');setScreen('home')}}>Skip measurement · Back to overview →</button>
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
      </section>}
      {screen==='history' && <section className="panel progress-screen">
        <span className="eyebrow">YOUR JOURNEY</span><h2>Split progress</h2>
        {(() => {
          const points = measurements.filter(m=>Number.isFinite(Number(m.value_cm)) && Number(m.value_cm)>=0)
            .map(m=>({date:new Date(m.measured_at),gap:Number(m.value_cm)})).filter(m=>!Number.isNaN(m.date.getTime()))
            .sort((a,b)=>a.date-b.date);
          const first=points[0], last=points[points.length-1];
          const rangeDays=points.length>1?(last.date-first.date)/86400000:0;
          const xs=points.map(p=>(p.date-first.date)/86400000);
          const meanX=xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
          const meanY=points.reduce((a,p)=>a+p.gap,0)/Math.max(1,points.length);
          const denom=xs.reduce((a,x)=>a+(x-meanX)**2,0);
          const slope=denom>0?xs.reduce((a,x,i)=>a+(x-meanX)*(points[i].gap-meanY),0)/denom:0;
          const enough=points.length>=3 && rangeDays>=14 && slope<0 && last.gap>0;
          const daysToZero=enough?last.gap/-slope:null;
          const plausible=enough && daysToZero>=14 && daysToZero<=3650;
          const forecast=plausible?new Date(last.date.getTime()+daysToZero*86400000):null;
          const values=points.map(p=>p.gap);
          const low=Math.min(0,...values), high=Math.max(1,...values);
          const xAt=i=>points.length===1?160:28+i*264/(points.length-1);
          const yAt=v=>132-(v-low)/(high-low)*108;
          const path=points.map((p,i)=>xAt(i)+','+yAt(p.gap)).join(' ');
          const completed=sessions.filter(s=>s.completed);
          const weeks=Array.from({length:8},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7)-(7-i)*7);const end=new Date(d);end.setDate(end.getDate()+7);return {date:d,count:completed.filter(s=>{const t=new Date(s.session_date+'T12:00:00');return t>=d&&t<end}).length};});
          const maxSessions=Math.max(1,...weeks.map(w=>w.count));
          return <>
            <div className="dashboard-stats"><div><strong>{last?last.gap+' cm':'—'}</strong><span>Latest gap</span></div><div><strong>{points.length>1?(first.gap-last.gap>0?'−':first.gap-last.gap<0?'+':'')+Math.abs(first.gap-last.gap).toFixed(1)+' cm':'—'}</strong><span>Gap change</span></div><div><strong>{completed.length}</strong><span>Sessions completed</span></div></div>
            <div className="progress-visual"><h3>Distance to middle split</h3><p className="routine-note">Floor-to-pelvis gap · lower is closer to a full split</p>
              {points.length?<><svg viewBox="0 0 320 166" role="img" aria-label="Middle split gap measurements over time" className="progress-chart"><line x1="28" y1="132" x2="292" y2="132" stroke="#bacbbc"/><line x1="28" y1="24" x2="292" y2="24" stroke="#e1e9df"/><text x="2" y="27" fontSize="10" fill="#647569">{high.toFixed(0)}</text><text x="8" y="135" fontSize="10" fill="#647569">{low.toFixed(0)}</text><polyline points={path} fill="none" stroke="#426e50" strokeWidth="3" strokeLinejoin="round"/>{points.map((p,i)=><circle key={i} cx={xAt(i)} cy={yAt(p.gap)} r="4" fill="#426e50"/>)}<text x="28" y="153" fontSize="10" fill="#647569">{first.date.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</text><text x="292" y="153" fontSize="10" fill="#647569" textAnchor="end">{last.date.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</text></svg><p className="routine-note">{points.length} measurement{points.length===1?'':'s'} recorded</p></>:<p>No measurements yet. Record your split gap after a workout to start tracking.</p>}
            </div>
            <div className="progress-visual"><h3>Sessions over the last 8 weeks</h3><div className="session-bars">{weeks.map((w,i)=><div key={i} className="session-bar-column"><strong>{w.count||''}</strong><div className="session-bar-track"><div style={{height:(w.count/maxSessions*100)+'%'}}/></div><span>{w.date.toLocaleDateString(undefined,{month:'numeric',day:'numeric'})}</span></div>)}</div><p className="routine-note">{completed.length} completed sessions total · recent activity shown by week</p></div>
            <div className="progress-visual"><h3>When might I reach a full split?</h3>{forecast?<><p className="forecast-date">{forecast.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</p><p>This is a rough straight-line projection from your measured trend, not a reliable deadline. Flexibility gains are rarely linear, and progress can slow or plateau.</p></>:<><p><strong>Not enough progress data for a meaningful estimate yet.</strong></p><p>We need at least 3 measurements spanning 2 weeks and a downward gap trend. Even then, a forecast will be a rough extrapolation, not a guarantee.</p></>}
            <p className="routine-note">Measure consistently after warming up, using the same setup. A 0 cm gap alone does not guarantee a safe or comfortable full split.</p></div>
          </>;
        })()}
      </section>}
      {screen==='history' && <section className="panel"><div className="sectionhead"><div><span className="eyebrow">TRAINING LOG</span><h2>Session history</h2></div><span className="count">{sessions.length}</span></div>
      {sessions.length===0?<p>No workouts yet. Log your first session above.</p>:<div className="history">{sessions.map(s=><article key={s.id} className="entry"><button type="button" className="history-toggle" aria-expanded={openHistory===s.id} onClick={()=>setOpenHistory(openHistory===s.id?null:s.id)}><strong>{s.session_date}</strong><span>{s.completed?'✓ Completed':'In progress'} · {exerciseLogs.filter(l=>l.session_id===s.id).length} exercises · {elapsed(s)===null?'Time unavailable':elapsed(s)+' min'} {openHistory===s.id?'↑':'↓'}</span></button>{openHistory===s.id&&<div className="history-details"><div><strong>{s.session_date}</strong><span>{s.completed ? `Effort ${s.effort ?? '—'}/10` : 'In progress'}</span></div><p>{s.notes || (s.completed ? 'Workout completed' : 'Workout in progress')}</p>{exerciseLogs.filter(log=>log.session_id===s.id).map(log=><div className="exercise-entry" key={log.id}><strong>{log.exercise_name}</strong><span>{log.side} · {log.sets} sets{log.reps!=null ? ` × ${log.reps} reps` : ''}{log.hold_seconds!=null ? ` · ${log.hold_seconds}s` : ''} · difficulty {log.difficulty}/10</span>{log.notes && <p>{log.notes}</p>}</div>)}</div>}</article>)}</div>}
      <div className="export-history">
        <h3>Share your training history</h3>
        <p>Download your sessions, exercise feedback, measurements and plans as a JSON file to upload to ChatGPT. Your data stays private until you choose to share the file.</p>
        <button type="button" disabled={exporting} onClick={exportTrainingHistory}>
          {exporting ? 'Preparing export…' : '↓ Export training history'}
        </button>
      </div>
      </section>}
    </>}
    {message && <p role="status" className="status">{message}</p>}
    <footer>Built for the long game 🌿</footer>
  </main>;
}
