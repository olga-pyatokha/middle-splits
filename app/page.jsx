'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// rest = seconds of rest between sets. Time estimates are computed from sets, reps/holds and rest
// (see estimateSeconds) instead of a hand-entered "minutes" number.
const EXERCISES = [
  { name: 'Quadruped rock-backs', sets: 2, reps: 8, hold_seconds: null, rest: 15, focus: 'mobility', cue: 'Move gently through a comfortable range.' },
  { name: 'Adductor rock-backs', sets: 2, reps: 8, hold_seconds: null, rest: 15, focus: 'middle', cue: 'Extend one leg to the side; rock back without forcing range.' },
  { name: 'Frog stretch', sets: 2, reps: null, hold_seconds: 30, rest: 15, focus: 'middle', cue: 'Support your weight and stay in a comfortable stretch.' },
  { name: 'Supported middle split hold', sets: 2, reps: null, hold_seconds: 20, rest: 20, focus: 'middle', cue: 'Use blocks or hands for support; maintain control.' },
  { name: 'Elevated pancake good mornings', sets: 2, reps: 8, hold_seconds: null, rest: 20, focus: 'pancake', cue: 'Hinge from the hips; sit on a block if helpful.' },
  { name: 'Seated pancake hold', sets: 2, reps: null, hold_seconds: 30, rest: 15, focus: 'pancake', cue: 'Keep a comfortable forward hinge rather than rounding to reach farther.' },
  { name: 'Seated straddle compression lifts', sets: 2, reps: 5, hold_seconds: null, rest: 30, secPerRep: 5, focus: 'strength', cue: 'Use support, stop before cramping; note left/right differences.' },
  { name: 'Wide-stance lateral weight shifts', sets: 2, reps: 6, hold_seconds: null, rest: 20, focus: 'strength', cue: 'Move slowly and keep the range comfortable.' }
];
const SEC_PER_REP = 4;        // average pace for a controlled rep
const PREP_SECONDS = 5;       // "get into position" countdown before the first hold
const TRANSITION_SECONDS = 15; // moving between exercises
const AUTO_NEXT_SECONDS = 8;  // pause on "exercise done" before the next one pops up
function workSeconds(e) { return e.hold_seconds != null ? e.hold_seconds : (e.reps || 0) * (e.secPerRep || SEC_PER_REP); }
function estimateSeconds(e) {
  const prep = e.hold_seconds != null ? PREP_SECONDS : 0;
  return prep + e.sets * workSeconds(e) + Math.max(0, e.sets - 1) * (e.rest || 0) + TRANSITION_SECONDS;
}
function fmtClock(sec) { const s = Math.max(0, Math.ceil(sec)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function fmtMinutes(sec) { const m = Math.round(sec / 30) / 2; return (m < 1 ? '<1' : String(m).replace('.5', '½')) + ' min'; }
function doseLabel(e) { return e.sets + ' × ' + (e.hold_seconds != null ? e.hold_seconds + 's hold' : e.reps + ' reps'); }
function dateKey(d) { return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); }

// The schedule is a rotation that advances each time you finish a workout — not tied to weekdays.
// Skip a day and the same workout is simply waiting for you next time.
const ROTATION = ['middle', 'pancake', 'recovery', 'middle', 'pancake', 'mixed'];
const FOCUS_LABEL = { middle: 'Middle splits', pancake: 'Pancake', recovery: 'Recovery', mixed: 'Mixed' };
const ROT_TAG = /^\[rot:(\d+)\]\s*/;
function sessionRot(s) { const m = s?.notes?.match(ROT_TAG); return m ? Number(m[1]) % ROTATION.length : null; }
function cleanNotes(n) { return (n || '').replace(ROT_TAG, ''); }
function nextRotation(sessions) {
  const done = sessions.filter(s => s.completed)
    .sort((a, b) => (b.started_at || b.session_date).localeCompare(a.started_at || a.session_date));
  const last = done.find(s => sessionRot(s) != null);
  if (last) return (sessionRot(last) + 1) % ROTATION.length;
  return done.length % ROTATION.length; // sessions from before the rotation existed
}

let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) { const C = window.AudioContext || window.webkitAudioContext; if (C) audioCtx = new C(); }
    audioCtx?.resume?.();
  } catch {}
}
function beep(freq = 880, ms = 120, vol = 0.18) {
  try {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime;
    o.type = 'sine'; o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.start(t); o.stop(t + ms / 1000 + 0.02);
  } catch {}
}
function buzz(pattern) { try { navigator.vibrate?.(pattern); } catch {} }
function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock = null, cancelled = false;
    const request = async () => { try { lock = await navigator.wakeLock.request('screen'); if (cancelled) lock.release(); } catch {} };
    request();
    const onVisible = () => { if (document.visibilityState === 'visible') request(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); try { lock?.release()?.catch(() => {}); } catch {} };
  }, [active]);
}
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
const EXERCISE_POSES = {
  'Quadruped rock-backs': { body:[72,60,115,62], limbs:[[72,60,52,87],[115,62,132,86],[52,87,36,87],[132,86,148,86]], head:[128,48] },
  'Adductor rock-backs': { body:[70,60,113,62], limbs:[[70,60,48,91],[113,62,128,89],[48,91,25,91],[128,89,176,89]], head:[127,47] },
  'Frog stretch': { body:[90,48,90,76], limbs:[[90,49,62,72],[90,49,118,72],[90,76,43,91],[90,76,137,91]], head:[90,34] },
  'Supported middle split hold': { body:[90,31,90,70], limbs:[[90,70,20,95],[90,70,160,95],[90,44,61,76],[90,44,119,76]], head:[90,18] },
  'Elevated pancake good mornings': { body:[87,43,117,73], limbs:[[117,73,25,96],[117,73,173,96],[91,49,115,84],[91,49,135,79]], head:[77,33] },
  'Seated pancake hold': { body:[92,43,120,76], limbs:[[120,76,23,96],[120,76,175,96],[99,51,136,87],[99,51,146,84]], head:[81,33] },
  'Seated straddle compression lifts': { body:[90,32,90,70], limbs:[[90,70,23,82],[90,70,158,82],[90,42,65,69],[90,42,114,69]], head:[90,18] },
  'Wide-stance lateral weight shifts': { body:[90,30,76,66], limbs:[[76,66,25,93],[76,66,158,93],[85,42,53,59],[85,42,119,56]], head:[90,17] }
};
function ExercisePicture({name}) {
  const [photoUnavailable,setPhotoUnavailable]=useState(false);
  const pose=EXERCISE_POSES[name];
  if (!pose) return null;
  const panelIndex={
    'Frog stretch':0,
    'Adductor rock-backs':1,
    'Seated pancake hold':2,
    'Elevated pancake good mornings':3,
    'Seated straddle compression lifts':4,
    'Wide-stance lateral weight shifts':5,
    'Supported middle split hold':6
  }[name];
  if (panelIndex!==undefined && !photoUnavailable) {
    const col=panelIndex%2, row=Math.floor(panelIndex/2);
    return <div className="exercise-photo-crop" role="img" aria-label={name+' illustrated positioning guide'}>
      <img src="/a_clean_infographic_style_collage_image_like_a_f.png" loading="lazy" alt="" onError={()=>setPhotoUnavailable(true)}
        style={{left:col===0?'0':'-100%',top:'-'+row*100+'%'}}/>
    </div>;
  }
  return <svg className="exercise-picture" viewBox="0 0 180 110" role="img" aria-label={name+' position illustration'} xmlns="http://www.w3.org/2000/svg">
    <rect width="180" height="110" rx="12" fill="#edf4ee"/>
    <path d="M12 99 H168" stroke="#a9bfae" strokeWidth="2"/>
    {name==='Elevated pancake good mornings' && <rect x="103" y="78" width="29" height="13" rx="3" fill="#c4aa83"/>}
    {name==='Supported middle split hold' && <><rect x="49" y="77" width="23" height="19" rx="3" fill="#c4aa83"/><rect x="108" y="77" width="23" height="19" rx="3" fill="#c4aa83"/></>}
    {pose.limbs.map((l,i)=><line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#446c57" strokeWidth="7" strokeLinecap="round"/>)}
    <line x1={pose.body[0]} y1={pose.body[1]} x2={pose.body[2]} y2={pose.body[3]} stroke="#446c57" strokeWidth="11" strokeLinecap="round"/>
    <circle cx={pose.head[0]} cy={pose.head[1]} r="10" fill="#d9a57f" stroke="#446c57" strokeWidth="2"/>
  </svg>;
}
function exerciseSearchUrl(name, platform) {
  const query = encodeURIComponent(name + ' exercise demonstration');
  return platform === 'instagram'
    ? 'https://www.instagram.com/explore/search/keyword/?q=' + query
    : 'https://www.youtube.com/results?search_query=' + query;
}

function buildWorkout(minutes, focusIndex, sessions, logs, activeId) {
  const focus = ROTATION[focusIndex];
  const todayKey = dateKey(new Date());
  const recentSessions = sessions.filter(s => s.completed && s.id !== activeId && (new Date(todayKey + 'T12:00:00') - new Date(s.session_date + 'T12:00:00')) / 86400000 <= 2);
  const recentNames = new Set(logs.filter(l => recentSessions.some(s => s.id === l.session_id)).map(l => l.exercise_name));
  const order = focus === 'recovery' ? ['mobility', 'pancake'] :
    focus === 'middle' ? ['mobility', 'middle', 'strength', 'pancake'] :
    focus === 'pancake' ? ['mobility', 'pancake', 'strength', 'middle'] :
    ['mobility', 'middle', 'pancake', 'strength'];
  const candidates = EXERCISES.filter(e => focus !== 'recovery' || e.focus === 'mobility' || e.name === 'Seated pancake hold')
    .sort((a, b) => order.indexOf(a.focus) - order.indexOf(b.focus) || Number(recentNames.has(a.name)) - Number(recentNames.has(b.name)));
  const selected = [];
  let remaining = Number(minutes) * 60;
  for (const e of candidates) {
    const cost = estimateSeconds(e);
    if (cost > remaining) continue;
    selected.push(e); remaining -= cost;
  }
  return { focus, label: FOCUS_LABEL[focus], exercises: selected };
}

function TimerRing({ leftMs, duration, label, sub }) {
  const r = 88, c = 2 * Math.PI * r;
  const frac = duration ? Math.min(1, Math.max(0, leftMs / duration)) : 0;
  return <div className="timer-ring" role="timer" aria-label={label + ' ' + fmtClock(leftMs / 1000)}>
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r={r} className="ring-track" />
      <circle cx="100" cy="100" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform="rotate(-90 100 100)" />
    </svg>
    <div className="ring-center"><span className="ring-label">{label}</span><strong>{fmtClock(leftMs / 1000)}</strong>{sub && <span className="ring-sub">{sub}</span>}</div>
  </div>;
}

// Full-screen guided player for one exercise: start → (get ready) → hold/reps → auto-logged set → rest → … → next exercise.
function Player({ item, position, total, initialDone, next, message, finishing, onLogSet, onRate, onNext, onClose, onFinish }) {
  const isHold = item.hold_seconds != null;
  const [done, setDone] = useState(initialDone);
  const [phase, setPhase] = useState(initialDone >= item.sets ? 'complete' : 'ready'); // ready | prep | work | rest | complete
  const [endAt, setEndAt] = useState(null);
  const [duration, setDuration] = useState(0);
  const [pausedLeft, setPausedLeft] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [rating, setRating] = useState(null);
  const [effort, setEffort] = useState(null);
  const lastBeep = useRef(null);
  useWakeLock(true);
  useEffect(() => { document.body.classList.add('player-open'); return () => document.body.classList.remove('player-open'); }, []);

  const running = endAt != null && pausedLeft == null;
  useEffect(() => { if (!running) return; const id = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(id); }, [running]);
  const leftMs = pausedLeft != null ? pausedLeft : endAt != null ? Math.max(0, endAt - now) : 0;

  function countdown(nextPhase, seconds) {
    const t = Date.now(), ms = seconds * 1000;
    setPhase(nextPhase); setDuration(ms); setPausedLeft(null); setNow(t); setEndAt(t + ms); lastBeep.current = null;
  }
  function settle(nextPhase) { setEndAt(null); setPausedLeft(null); setPhase(nextPhase); }
  function completeSet(heldSeconds) {
    const setNo = done + 1;
    setDone(setNo);
    onLogSet(item, setNo, heldSeconds);
    buzz([80, 60, 80]);
    if (setNo >= item.sets) { beep(1046, 400); if (next) countdown('complete', AUTO_NEXT_SECONDS); else settle('complete'); }
    else { beep(660, 220); countdown('rest', item.rest || 15); }
  }
  function beginWork() {
    beep(988, 260); buzz(150);
    if (isHold) countdown('work', item.hold_seconds); else settle('work');
  }
  function startSet() {
    unlockAudio();
    if (isHold && done === 0) countdown('prep', PREP_SECONDS); else beginWork();
  }

  useEffect(() => {
    if (!running) return;
    const secLeft = Math.ceil(leftMs / 1000);
    if (leftMs > 0) {
      if ((phase === 'prep' || phase === 'rest' || phase === 'work') && secLeft <= 3 && lastBeep.current !== secLeft) {
        lastBeep.current = secLeft; beep(phase === 'work' ? 520 : 660, 90, phase === 'work' ? 0.08 : 0.15);
      }
      return;
    }
    if (phase === 'prep' || phase === 'rest') beginWork();
    else if (phase === 'work') completeSet(item.hold_seconds);
    else if (phase === 'complete') { setEndAt(null); onNext(); }
  }, [now, running]); // eslint-disable-line react-hooks/exhaustive-deps

  function togglePause() {
    if (pausedLeft != null) { const t = Date.now(); setNow(t); setEndAt(t + pausedLeft); setPausedLeft(null); }
    else setPausedLeft(Math.max(0, endAt - Date.now()));
  }
  function addRest(sec) {
    setDuration(d => d + sec * 1000);
    if (pausedLeft != null) setPausedLeft(p => p + sec * 1000); else setEndAt(e => e + sec * 1000);
  }
  function skipCountdown() { const t = Date.now(); setNow(t); setPausedLeft(null); setEndAt(t); }
  function rate(value) { setRating(value); onRate(item, value); }

  const media = EXERCISE_MEDIA[item.name];
  const pauseButton = <button className="ghost" onClick={togglePause}>{pausedLeft != null ? '▶ Resume' : '❚❚ Pause'}</button>;
  const nextUp = next && <div className="up-next"><span className="eyebrow">UP NEXT</span><strong>{next.name}</strong><span>{doseLabel(next)} · ~{fmtMinutes(estimateSeconds(next))}</span></div>;

  return <div className={'player phase-' + phase} role="dialog" aria-modal="true" aria-label={item.name}>
    <header className="player-top">
      <button className="player-close" onClick={onClose} aria-label="Back to exercise list">✕</button>
      <span>Exercise {position} of {total}</span>
      <span className="player-est">~{fmtMinutes(estimateSeconds(item))}</span>
    </header>
    <div className="player-body">
      <h2>{item.name}</h2>
      <p className="player-dose">{doseLabel(item)}{item.sets > 1 ? ' · ' + (item.rest || 15) + 's rest between sets' : ''}</p>
      <div className="set-dots" aria-label={done + ' of ' + item.sets + ' sets done'}>
        {Array.from({ length: item.sets }, (_, i) => <span key={i} className={i < done ? 'done' : (i === done && phase !== 'complete' ? 'current' : '')}>{i < done ? '✓' : 'Set ' + (i + 1)}</span>)}
      </div>

      {phase === 'ready' && <>
        <ExercisePicture name={item.name} />
        <p className="player-cue">{item.cue}</p>
        {isHold && <p className="player-hint">Tap start, then you get {PREP_SECONDS}s to get into position. Sets log themselves and rest starts automatically.</p>}
        {!isHold && <p className="player-hint">Do your reps at your own pace, then tap done. Rest starts automatically.</p>}
      </>}
      {phase === 'prep' && <TimerRing leftMs={leftMs} duration={duration} label="Get into position" sub={'Set ' + (done + 1) + ' of ' + item.sets} />}
      {phase === 'work' && isHold && <TimerRing leftMs={leftMs} duration={duration} label={pausedLeft != null ? 'Paused' : 'Hold'} sub={'Set ' + (done + 1) + ' of ' + item.sets} />}
      {phase === 'work' && !isHold && <div className="rep-target"><strong>{item.reps}</strong><span>reps · set {done + 1} of {item.sets}</span><p className="player-cue">{item.cue}</p></div>}
      {phase === 'rest' && <>
        <TimerRing leftMs={leftMs} duration={duration} label={pausedLeft != null ? 'Paused' : 'Rest'} sub={'Next: set ' + (done + 1) + ' of ' + item.sets} />
        <p className="player-hint">{isHold ? 'The next hold starts on its own when rest ends — listen for the beeps.' : 'Get ready for your next set.'}</p>
      </>}
      {phase === 'complete' && <div className="complete-card">
        <div className="complete-check">✓</div>
        <h3>{item.sets} sets logged</h3>
        <p className="player-hint">How did it feel? (optional)</p>
        <div className="chip-row">{[['Easy', 3], ['Good', 5], ['Hard', 8]].map(([label, value]) =>
          <button key={label} className={'chip' + (rating === value ? ' selected' : '')} onClick={() => rate(value)}>{label}</button>)}</div>
        {nextUp}
        {!next && <>
          <h3 className="finish-title">That was the last one 🎉</h3>
          <p className="player-hint">Overall effort (optional)</p>
          <div className="chip-row">{[['Light', 3], ['Moderate', 5], ['Tough', 8]].map(([label, value]) =>
            <button key={label} className={'chip' + (effort === value ? ' selected' : '')} onClick={() => setEffort(effort === value ? null : value)}>{label}</button>)}</div>
        </>}
      </div>}
      {message && <p className="player-toast" role="status">{message}</p>}
    </div>

    <footer className="player-controls">
      {phase === 'ready' && <>
        <button className="primary" onClick={startSet}>▶ Start {done > 0 ? 'set ' + (done + 1) : ''}</button>
        <div className="control-row">
          {media && <a className="ghost" href={media.url} target="_blank" rel="noopener noreferrer">Watch demo ↗</a>}
          <button className="ghost" onClick={next ? onNext : onClose}>Skip exercise</button>
        </div>
      </>}
      {phase === 'prep' && <div className="control-row">{pauseButton}<button className="ghost" onClick={skipCountdown}>Start hold now →</button></div>}
      {phase === 'work' && isHold && <div className="control-row">{pauseButton}<button className="ghost" onClick={() => completeSet(Math.max(1, Math.round(item.hold_seconds - leftMs / 1000)))}>✓ Done early</button></div>}
      {phase === 'work' && !isHold && <button className="primary" onClick={() => completeSet(null)}>✓ Done · log set {done + 1}</button>}
      {phase === 'rest' && <div className="control-row">{pauseButton}<button className="ghost" onClick={() => addRest(15)}>+15s</button><button className="ghost" onClick={skipCountdown}>Skip rest →</button></div>}
      {phase === 'complete' && next && <>
        <button className="primary" onClick={onNext}>Next exercise {running ? '(' + Math.ceil(leftMs / 1000) + ')' : ''} →</button>
        <div className="control-row">{running && <button className="ghost" onClick={() => settle('complete')}>Stay here</button>}<button className="ghost" onClick={onClose}>Back to list</button></div>
      </>}
      {phase === 'complete' && !next && <>
        <button className="primary" disabled={finishing} onClick={() => onFinish(effort)}>{finishing ? 'Finishing…' : '✓ Finish workout'}</button>
        <div className="control-row"><button className="ghost" onClick={onClose}>Back to list</button></div>
      </>}
    </footer>
  </div>;
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
  const [effort, setEffort] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exerciseName, setExerciseName] = useState('Seated straddle compression lifts');
  const [side, setSide] = useState('both');
  const [reps, setReps] = useState('5');
  const [holdSeconds, setHoldSeconds] = useState('');
  const [difficulty, setDifficulty] = useState(5);
  const [exerciseNotes, setExerciseNotes] = useState('');
  const [exerciseLogs, setExerciseLogs] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [exerciseSaving, setExerciseSaving] = useState(false);
  const [workoutMinutes, setWorkoutMinutes] = useState('15');
  const [focusOverride, setFocusOverride] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [measurementValue, setMeasurementValue] = useState('');
  const [measurementMethod, setMeasurementMethod] = useState('Floor-to-pelvis gap');
  const [measurementWarmedUp, setMeasurementWarmedUp] = useState(true);
  const [measurementNotes, setMeasurementNotes] = useState('');
  const [measurementSaving, setMeasurementSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [screen, setScreen] = useState('home');
  const [sessionStage, setSessionStage] = useState('exercises');
  const [openDay, setOpenDay] = useState(null);
  const [openHistory, setOpenHistory] = useState(null);
  const [carry, setCarry] = useState([]);
  const [goalDays, setGoalDays] = useState(3);
  const [goalMinutes, setGoalMinutes] = useState(60);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    try { const m = localStorage.getItem('splits:workoutMinutes'); if (['5', '15', '30'].includes(m)) setWorkoutMinutes(m); } catch {}
  }, []);
  function chooseMinutes(m) { setWorkoutMinutes(m); try { localStorage.setItem('splits:workoutMinutes', m); } catch {} }

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !supabase) { setSessions([]); setActiveSession(null); return; }
    let active = true;
    supabase.from('sessions').select('id,session_date,effort,notes,completed,duration_minutes,started_at')
      .order('session_date', { ascending: false }).order('started_at', { ascending: false, nullsFirst: false }).limit(30)
      .then(({ data, error }) => { if (active) { if (error) setMessage(error.message); else { setSessions(data ?? []); setActiveSession((data ?? []).find(s => s.completed === false) ?? null); } } });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) { setExerciseLogs([]); return; }
    let active = true;
    supabase.from('exercise_logs').select('id,session_id,exercise_name,side,sets,reps,hold_seconds,difficulty,notes,created_at')
      .order('created_at', { ascending: false }).limit(200)
      .then(({ data, error }) => { if (active) { if (error) setMessage(error.message); else setExerciseLogs(data ?? []); } });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) { setMeasurements([]); return; }
    let active = true;
    supabase.from('measurements').select('id,measured_at,metric,value_cm,method,warmed_up,notes')
      .eq('metric', 'middle_split_gap_cm').order('measured_at', { ascending: true }).limit(100)
      .then(({ data, error }) => { if (active) { if (error) setMessage(error.message); else setMeasurements(data ?? []); } });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || !supabase) { setPreferencesLoaded(false); return; }
    let active = true;
    async function loadPreferences() {
      const { data, error } = await supabase.from('user_preferences').select('goal_days,goal_minutes,carry_exercises').eq('user_id', user.id).maybeSingle();
      if (!active) return;
      if (error) { setMessage('Could not load training preferences: ' + error.message); return; }
      if (data) {
        setGoalDays(data.goal_days); setGoalMinutes(data.goal_minutes);
        setCarry(Array.isArray(data.carry_exercises) ? data.carry_exercises : []);
      } else {
        const key = 'splits:' + user.id + ':';
        let days = 3, minutes = 60, items = [];
        try {
          days = Number(JSON.parse(localStorage.getItem(key + 'days') || '3'));
          minutes = Number(JSON.parse(localStorage.getItem(key + 'minutes') || '60'));
          items = JSON.parse(localStorage.getItem(key + 'carry') || '[]');
        } catch {}
        days = Math.max(1, Math.min(7, days || 3)); minutes = Math.max(5, Math.min(1000, minutes || 60));
        if (!Array.isArray(items)) items = [];
        const { error: saveError } = await supabase.from('user_preferences').upsert({ user_id: user.id, goal_days: days, goal_minutes: minutes, carry_exercises: items }, { onConflict: 'user_id' });
        if (!active) return;
        if (saveError) setMessage('Could not sync preferences: ' + saveError.message);
        setGoalDays(days); setGoalMinutes(minutes); setCarry(items);
      }
      setPreferencesLoaded(true);
    }
    loadPreferences();
    return () => { active = false; };
  }, [user]);
  useEffect(() => { if (!activeSession) return; const id = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(id); }, [activeSession]);

  async function persist(k, v) {
    if (!user || !supabase || !preferencesLoaded) return;
    const column = { days: 'goal_days', minutes: 'goal_minutes', carry: 'carry_exercises' }[k];
    if (!column) return;
    const { error } = await supabase.from('user_preferences').update({ [column]: v, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    if (error) setMessage('Could not save preferences: ' + error.message);
  }
  function toggleCarry(name) { const next = carry.includes(name) ? carry.filter(n => n !== name) : [...carry, name]; setCarry(next); persist('carry', next); }
  function elapsed(s) {
    if (s.duration_minutes != null) return Number(s.duration_minutes);
    if (!s.started_at) return null;
    return s.completed ? null : Math.max(0, Math.round((clock - new Date(s.started_at).getTime()) / 60000));
  }

  async function saveMeasurement(e) {
    e.preventDefault(); setMeasurementSaving(true); setMessage('');
    const value = Number(measurementValue);
    if (!Number.isFinite(value) || value < 0 || measurementValue.trim() === '') {
      setMessage('Enter a valid non-negative measurement in centimeters.');
      setMeasurementSaving(false); return;
    }
    const { data, error } = await supabase.from('measurements').insert({
      user_id: user.id, measured_at: new Date().toISOString(), metric: 'middle_split_gap_cm',
      value_cm: value, method: measurementMethod, warmed_up: measurementWarmedUp, notes: measurementNotes.trim()
    }).select('id,measured_at,metric,value_cm,method,warmed_up,notes').single();
    if (error) setMessage(error.message);
    else { setMeasurements(current => [...current, data].sort((a, b) => new Date(a.measured_at) - new Date(b.measured_at))); setMeasurementValue(''); setMeasurementNotes(''); setMessage('Measurement saved!'); if (sessionStage === 'measurement') { setSessionStage('exercises'); setScreen('home'); } }
    setMeasurementSaving(false);
  }

  function setsDone(name) {
    return activeSession ? exerciseLogs.filter(l => l.session_id === activeSession.id && l.exercise_name === name).length : 0;
  }

  // One tap per set — no forms. Called by the player when a hold finishes or "Done" is tapped.
  async function logSet(item, setNo, heldSeconds) {
    if (!activeSession) return;
    const { data, error } = await supabase.from('exercise_logs').insert({
      user_id: user.id, session_id: activeSession.id, exercise_name: item.name, side: 'both', sets: 1,
      reps: item.reps ?? null, hold_seconds: heldSeconds ?? item.hold_seconds ?? null, difficulty: null, notes: '[Set ' + setNo + ']'
    }).select('id,session_id,exercise_name,side,sets,reps,hold_seconds,difficulty,notes,created_at').single();
    if (error) setMessage('Set ' + setNo + ' did not save: ' + error.message);
    else setExerciseLogs(current => [data, ...current]);
  }
  async function rateExercise(item, value) {
    if (!activeSession) return;
    const { error } = await supabase.from('exercise_logs').update({ difficulty: value })
      .eq('session_id', activeSession.id).eq('exercise_name', item.name);
    if (error) setMessage('Could not save rating: ' + error.message);
    else setExerciseLogs(current => current.map(l => l.session_id === activeSession.id && l.exercise_name === item.name ? { ...l, difficulty: value } : l));
  }

  async function saveExercise(e) {
    e.preventDefault();
    if (!activeSession) { setMessage('Start a workout first.'); return; }
    setExerciseSaving(true); setMessage('');
    const payload = { user_id: user.id, session_id: activeSession.id, exercise_name: exerciseName.trim(),
      side, sets: 1, reps: reps === '' ? null : Number(reps),
      hold_seconds: holdSeconds === '' ? null : Number(holdSeconds),
      difficulty: Number(difficulty), notes: exerciseNotes.trim() };
    const { data, error } = await supabase.from('exercise_logs').insert(payload)
      .select('id,session_id,exercise_name,side,sets,reps,hold_seconds,difficulty,notes,created_at').single();
    if (error) setMessage(error.message);
    else { setExerciseLogs(current => [data, ...current]); setExerciseNotes(''); setMessage(exerciseName + ' logged.'); }
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

  async function startWorkout(openName) {
    if (saving) return;
    if (activeSession) { setScreen('session'); setSessionStage('exercises'); if (openName) { unlockAudio(); setPlayerName(openName); } return; }
    unlockAudio();
    setSaving(true); setMessage('');
    const { data, error } = await supabase.from('sessions').insert({
      user_id: user.id, session_date: dateKey(new Date()), plan_id: null,
      started_at: new Date().toISOString(), completed: false, notes: '[rot:' + plannedRotation + ']'
    }).select('id,session_date,effort,notes,completed,duration_minutes,started_at').single();
    if (error) setMessage(error.message);
    else {
      setSessions(current => [data, ...current]); setActiveSession(data); setFocusOverride(null);
      setScreen('session'); setSessionStage('exercises');
      if (openName) setPlayerName(openName);
      window.scrollTo?.({ top: 0 });
    }
    setSaving(false);
  }
  function openExercise(name) {
    if (!activeSession) { startWorkout(name); return; }
    unlockAudio(); setMessage(''); setPlayerName(name);
  }

  async function finishWorkout(effortValue) {
    if (!activeSession || saving) return;
    setSaving(true); setMessage('');
    const tag = (activeSession.notes || '').match(ROT_TAG)?.[0]?.trim() || '';
    const finalEffort = effortValue ?? effort;
    const { data, error } = await supabase.from('sessions')
      .update({ effort: finalEffort == null ? null : Number(finalEffort), notes: [tag, notes.trim()].filter(Boolean).join(' '), completed: true, duration_minutes: Math.max(0, Math.min(480, elapsed(activeSession) ?? 0)) })
      .eq('id', activeSession.id).eq('completed', false)
      .select('id,session_date,effort,notes,completed,duration_minutes,started_at').single();
    if (error) setMessage(error.message);
    else {
      const logged = new Set(exerciseLogs.filter(l => l.session_id === activeSession.id).map(l => l.exercise_name));
      if (carry.some(n => logged.has(n))) { const next = carry.filter(n => !logged.has(n)); setCarry(next); persist('carry', next); }
      setSessions(current => current.map(s => s.id === data.id ? data : s)); setActiveSession(null); setPlayerName(null);
      setNotes(''); setEffort(null); setSessionStage('measurement'); setScreen('session');
      setMessage('Workout complete. Add a measurement if you like, or skip.');
      window.scrollTo?.({ top: 0 });
    }
    setSaving(false);
  }

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
      const payload = { format: 'middle-splits-training-export', version: 1, exported_at: new Date().toISOString(), history };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'middle-splits-training-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Training history exported. You can upload the JSON file to ChatGPT for a session review.');
    } catch (error) {
      setMessage('Export failed: ' + error.message);
    } finally {
      setExporting(false);
    }
  }

  const upcomingRotation = nextRotation(sessions);
  const plannedRotation = focusOverride ?? upcomingRotation;
  const workoutRotation = activeSession ? (sessionRot(activeSession) ?? plannedRotation) : plannedRotation;
  const suggestedWorkout = buildWorkout(workoutMinutes, workoutRotation, sessions, exerciseLogs, activeSession?.id);
  const workoutItems = [...carry.map(n => EXERCISES.find(e => e.name === n)).filter(Boolean), ...suggestedWorkout.exercises.filter(e => !carry.includes(e.name))];
  const workoutSeconds = workoutItems.reduce((sum, e) => sum + estimateSeconds(e), 0);
  const isDone = item => setsDone(item.name) >= item.sets;
  const doneCount = workoutItems.filter(isDone).length;
  const remainingSeconds = workoutItems.filter(i => !isDone(i)).reduce((sum, e) => sum + estimateSeconds(e), 0);
  const nextUndone = workoutItems.find(i => !isDone(i));
  const playerIndex = workoutItems.findIndex(i => i.name === playerName);
  const playerItem = playerName ? (workoutItems[playerIndex] || EXERCISES.find(e => e.name === playerName)) : null;
  const playerNext = playerItem ? (workoutItems.slice(playerIndex + 1).find(i => !isDone(i)) || workoutItems.slice(0, Math.max(0, playerIndex)).find(i => !isDone(i)) || null) : null;

  const today = new Date(), monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const mondayKey = dateKey(monday);
  const weekSessions = sessions.filter(s => s.completed && s.session_date >= mondayKey);
  const activeDays = new Set(weekSessions.map(s => s.session_date)).size;
  const weekMinutes = weekSessions.reduce((sum, s) => sum + (elapsed(s) || 0), 0);

  const focusPicker = !activeSession && <div className="chip-row focus-chips" role="group" aria-label="Workout focus">
    {['middle', 'pancake', 'mixed', 'recovery'].map(f => {
      const idx = ROTATION[plannedRotation] === f ? plannedRotation : ROTATION.indexOf(f);
      return <button key={f} className={'chip' + (ROTATION[plannedRotation] === f ? ' selected' : '')}
        onClick={() => setFocusOverride(idx === upcomingRotation ? null : idx)}>{FOCUS_LABEL[f]}</button>;
    })}
  </div>;
  const timePicker = !activeSession && <div className="chip-row" role="group" aria-label="Time available">
    {[['5', 'Quick · 5'], ['15', 'Regular · 15'], ['30', 'Long · 30']].map(([v, label]) =>
      <button key={v} className={'chip' + (workoutMinutes === v ? ' selected' : '')} onClick={() => chooseMinutes(v)}>{label} min</button>)}
  </div>;

  if (!supabase) return <main className="shell"><h1>Middle Splits</h1><p>Set your Supabase environment variables to connect the app.</p></main>;
  if (loading) return <main className="shell"><p>Loading…</p></main>;

  return <main className="shell">
    <header className="top"><div><span className="eyebrow">FLEXIBILITY JOURNAL</span><h1>Middle Splits <span>✳</span></h1><p>Small sessions. Steady progress.</p></div>{user && <button className="quiet" onClick={() => supabase.auth.signOut()}>Sign out</button>}</header>
    {!user ? <section className="panel"><h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2><p>Sign in to keep your training history private.</p>
      <form onSubmit={authenticate}><label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" minLength={6} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button type="submit">{mode === 'signin' ? 'Sign in' : 'Sign up'}</button></form>
      <button className="link" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }}>{mode === 'signin' ? 'New here? Create an account' : 'Already registered? Sign in'}</button>
    </section> : <>
      <nav className="app-tabs" aria-label="App sections"><button className={screen === 'home' ? 'selected' : ''} onClick={() => setScreen('home')}>⌂ Home</button><button className={screen === 'session' ? 'selected' : ''} onClick={() => setScreen('session')}>▶ Workout</button><button className={screen === 'history' ? 'selected' : ''} onClick={() => setScreen('history')}>↗ Progress</button></nav>

      {screen === 'home' && <section className="panel dashboard-panel">
        <span className="eyebrow">{activeSession ? 'IN PROGRESS' : 'UP NEXT'}</span>
        <h2>{suggestedWorkout.label}</h2>
        <p>{workoutItems.length} exercises · about {fmtMinutes(activeSession ? remainingSeconds : workoutSeconds)}{activeSession ? ' left' : ''}</p>
        {focusPicker}
        {timePicker}
        <button className="big-start" disabled={saving} onClick={() => startWorkout()}>{saving ? 'Starting…' : activeSession ? '▶ Continue workout' : '▶ Start workout'}</button>
        <p className="routine-note">Your plan follows your workouts, not the calendar: skip a day and this workout is still waiting. After this: {[1, 2, 3].map(i => FOCUS_LABEL[ROTATION[(workoutRotation + i) % ROTATION.length]]).join(' → ')}.</p>
        <div className="dashboard-stats"><div><strong>{activeDays}/{goalDays}</strong><span>Active days this week</span></div><div><strong>{weekMinutes}/{goalMinutes}</strong><span>Tracked minutes</span></div><div><strong>{measurements.length ? Number(measurements[measurements.length - 1].value_cm) + ' cm' : '—'}</strong><span>Latest split gap</span></div></div>
      </section>}

      {screen === 'home' && <section className="panel"><div className="sectionhead"><div><span className="eyebrow">YOUR WEEK</span><h2>This week</h2></div><span className="spark">✦</span></div>
        <div className="week-overview">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => {
          const day = new Date(monday); day.setDate(day.getDate() + i);
          const date = dateKey(day);
          const records = sessions.filter(s => s.session_date === date);
          const doneRecords = records.filter(s => s.completed);
          const focusNames = [...new Set(doneRecords.map(s => sessionRot(s)).filter(r => r != null).map(r => FOCUS_LABEL[ROTATION[r]]))];
          return <div key={date}><button type="button" className={'week-day day-toggle' + (date === dateKey(today) ? ' current' : '')} aria-expanded={openDay === date} onClick={() => setOpenDay(openDay === date ? null : date)}>
            {label} {doneRecords.length ? '✓ ' + (focusNames.join(', ') || 'Workout') : ''}</button>
            {openDay === date && <div className="day-details"><strong>{date}</strong><p>{records.length ? records.length + ' session(s)' : 'No workout logged'}</p>{records.map(s => <p key={s.id}>{s.completed ? 'Completed' : 'In progress'} · {exerciseLogs.filter(l => l.session_id === s.id).length} sets · {elapsed(s) === null ? 'Time unavailable' : elapsed(s) + ' min'}</p>)}</div>}</div>;
        })}</div>
        <div className="goal-progress"><h3>Weekly activity goals</h3><p><strong>{activeDays}/{goalDays} active days</strong> · {weekMinutes}/{goalMinutes} tracked minutes</p><div className="goal-meter"><span style={{ width: Math.min(100, activeDays / Math.max(1, goalDays) * 100) + '%' }} /></div><div className="goal-settings"><label>Days/week<select value={goalDays} onChange={e => { const n = Number(e.target.value); setGoalDays(n); persist('days', n); }}>{[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n}>{n}</option>)}</select></label><label>Minutes/week<input type="number" min="5" max="1000" value={goalMinutes} onChange={e => { const n = Number(e.target.value); setGoalMinutes(n); persist('minutes', n); }} /></label></div></div>
      </section>}

      {screen === 'session' && sessionStage === 'exercises' && <section className="panel workout-panel">
        <div className="sectionhead"><div><span className="eyebrow">{activeSession ? '● IN PROGRESS' : 'TODAY'}</span><h2>{suggestedWorkout.label}</h2></div>
          {activeSession && <span className="count">{elapsed(activeSession) ?? 0} min</span>}</div>
        {activeSession ? <>
          <div className="workout-progress"><div className="goal-meter"><span style={{ width: (workoutItems.length ? doneCount / workoutItems.length * 100 : 0) + '%' }} /></div>
            <p>{doneCount} of {workoutItems.length} done · ~{fmtMinutes(remainingSeconds)} left</p></div>
          {nextUndone && <button className="big-start" onClick={() => openExercise(nextUndone.name)}>▶ {doneCount ? 'Continue' : 'Start'}: {nextUndone.name}</button>}
        </> : <>
          <p>{workoutItems.length} exercises · about {fmtMinutes(workoutSeconds)}. Tap Start, or tap any exercise to jump straight in.</p>
          {focusPicker}{timePicker}
          <button className="big-start" disabled={saving} onClick={() => startWorkout()}>{saving ? 'Starting…' : '▶ Start workout'}</button>
        </>}

        <ol className="exercise-list">{workoutItems.map(item => {
          const n = setsDone(item.name), complete = n >= item.sets;
          return <li key={item.name} className={'exercise-row' + (complete ? ' complete' : '') + (n > 0 && !complete ? ' partial' : '')}>
            <button className="exercise-open" onClick={() => openExercise(item.name)}>
              <span className="exercise-status" aria-hidden="true">{complete ? '✓' : n > 0 ? n + '/' + item.sets : '▶'}</span>
              <span className="exercise-text"><strong>{item.name}</strong><span>{doseLabel(item)} · ~{fmtMinutes(estimateSeconds(item))}</span></span>
            </button>
            <button className={'carry-toggle' + (carry.includes(item.name) ? ' on' : '')} title={carry.includes(item.name) ? 'Pinned to next workout' : 'Pin to next workout'} aria-label={(carry.includes(item.name) ? 'Unpin ' : 'Pin to next workout: ') + item.name} onClick={() => toggleCarry(item.name)}>↪</button>
          </li>;
        })}</ol>

        {activeSession && <div className="finish-box">
          <p className="player-hint">Overall effort (optional)</p>
          <div className="chip-row">{[['Light', 3], ['Moderate', 5], ['Tough', 8]].map(([label, value]) =>
            <button key={label} className={'chip' + (effort === value ? ' selected' : '')} onClick={() => setEffort(effort === value ? null : value)}>{label}</button>)}</div>
          <details><summary>Add a note</summary><textarea rows="2" placeholder="How did it feel overall?" value={notes} onChange={e => setNotes(e.target.value)} /></details>
          <button className={doneCount === workoutItems.length ? '' : 'secondary'} disabled={saving} onClick={() => finishWorkout()}>{saving ? 'Finishing…' : '✓ Finish workout'}</button>
          <button className="quiet" onClick={() => setSessionStage('measurement')}>Measure now (optional) →</button>
        </div>}

        {activeSession && <details className="manual-log"><summary>Log something else</summary>
          <form onSubmit={saveExercise}>
            <label>Exercise<select value={exerciseName} onChange={e => setExerciseName(e.target.value)}>
              {[...EXERCISES.map(e => e.name), 'Other'].map(name => <option key={name} value={name}>{name}</option>)}
            </select></label>
            {exerciseName === 'Other' && <p>Use the notes field to name the exercise.</p>}
            <label>Side<select value={side} onChange={e => setSide(e.target.value)}><option value="both">Both / center</option><option value="left">Left</option><option value="right">Right</option></select></label>
            <div className="fields"><label>Reps<input type="number" min="0" max="1000" value={reps} onChange={e => setReps(e.target.value)} /></label>
              <label>Hold (s)<input type="number" min="0" step="0.5" value={holdSeconds} onChange={e => setHoldSeconds(e.target.value)} /></label></div>
            <label>Difficulty <strong>{difficulty}/10</strong><input type="range" min="1" max="10" value={difficulty} onChange={e => setDifficulty(e.target.value)} /></label>
            <label>Notes<textarea rows="2" placeholder="Optional…" value={exerciseNotes} onChange={e => setExerciseNotes(e.target.value)} /></label>
            <button disabled={exerciseSaving} type="submit">{exerciseSaving ? 'Saving…' : '✓ Log set'}</button>
          </form>
        </details>}
        <p className="routine-note">Times include rest between sets. ↪ pins an exercise to your next workout. Stop if you feel pain or cramping.</p>
      </section>}

      {screen === 'session' && sessionStage === 'measurement' && <section className="panel"><div className="sectionhead"><div><span className="eyebrow">PROGRESS</span><h2>Middle-splits measurements</h2></div><span className="spark">↘</span></div>
        <p>Optional end-of-session measurement. Measure the vertical gap from the floor to your pelvis in centimeters, using the same position and setup each time.</p>
        <button className="quiet" onClick={() => { setSessionStage('exercises'); setScreen('home'); }}>Skip measurement · Back to overview →</button>
        <form onSubmit={saveMeasurement}>
          <label>Gap to floor (cm)<input type="number" min="0" step="0.1" required placeholder="e.g. 25.5" value={measurementValue} onChange={e => setMeasurementValue(e.target.value)} /></label>
          <label>Method<select value={measurementMethod} onChange={e => setMeasurementMethod(e.target.value)}>
            <option>Floor-to-pelvis gap</option><option>Block-supported floor-to-pelvis gap</option>
          </select></label>
          <label className="checkline"><input type="checkbox" checked={measurementWarmedUp} onChange={e => setMeasurementWarmedUp(e.target.checked)} /> Measured after warming up</label>
          <label>Notes<textarea rows="2" placeholder="Position, blocks, discomfort, setup…" value={measurementNotes} onChange={e => setMeasurementNotes(e.target.value)} /></label>
          <button disabled={measurementSaving} type="submit">{measurementSaving ? 'Saving…' : 'Save measurement'}</button>
        </form>
        {measurements.length > 0 && <div className="measure-history">
          <h3>Progress history</h3>
          {measurements.length > 1 && <div className="chart-scroll"><svg viewBox="0 0 320 150" role="img" aria-label="Middle splits floor gap over time" className="progress-chart">
            {(() => {
              const vals = measurements.map(m => Number(m.value_cm));
              const low = Math.min(...vals), high = Math.max(...vals), span = Math.max(1, high - low);
              const pts = vals.map((v, i) => [20 + i * 280 / Math.max(1, vals.length - 1), 15 + (high - v) / span * 110]);
              return <><line x1="20" y1="125" x2="300" y2="125" stroke="#cad8cb" /><polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="#426e50" strokeWidth="3" strokeLinejoin="round" />{pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#426e50" />)}</>;
            })()}
          </svg></div>}
          <div className="history">{[...measurements].reverse().slice(0, 8).map(m => <article key={m.id} className="entry"><div><strong>{Number(m.value_cm)} cm</strong><span>{new Date(m.measured_at).toLocaleDateString()}</span></div><p>{m.method} · {m.warmed_up ? 'Warmed up' : 'Not warmed up'}{m.notes ? ' · ' + m.notes : ''}</p></article>)}</div>
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
            <div className="progress-visual"><h3>When might I reach a full split?</h3>{forecast?<><p className="forecast-date">{forecast.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</p><p>Estimated from your measured trend. This is a rough projection, not a deadline; progress may slow or plateau.</p></>:<><p className="forecast-date">{new Date(Date.now()+18*30.4375*86400000).toLocaleDateString(undefined,{month:'long',year:'numeric'})}</p><p><strong>Starter estimate: about 18 months</strong> for someone beginning with low mobility and training around 3 times weekly. A broad planning range is 12–36+ months, and full splits are not possible for everyone. This is an assumption, not a validated average.</p><p className="routine-note">Once you have 3 measurements spanning at least 2 weeks with a clear improving trend, we'll replace this starter estimate with your personal projection.</p></>}
            <p className="routine-note">Measure consistently after warming up, using the same setup. A 0 cm gap alone does not guarantee a safe or comfortable full split.</p></div>
          </>;
        })()}
      </section>}
      {screen==='history' && <section className="panel"><div className="sectionhead"><div><span className="eyebrow">TRAINING LOG</span><h2>Session history</h2></div><span className="count">{sessions.length}</span></div>
      {sessions.length===0?<p>No workouts yet. Start your first one from the Workout tab.</p>:<div className="history">{sessions.map(s=><article key={s.id} className="entry"><button type="button" className="history-toggle" aria-expanded={openHistory===s.id} onClick={()=>setOpenHistory(openHistory===s.id?null:s.id)}><strong>{s.session_date}{sessionRot(s)!=null ? ' · '+FOCUS_LABEL[ROTATION[sessionRot(s)]] : ''}</strong><span>{s.completed?'✓ Completed':'In progress'} · {exerciseLogs.filter(l=>l.session_id===s.id).length} sets · {elapsed(s)===null?'Time unavailable':elapsed(s)+' min'} {openHistory===s.id?'↑':'↓'}</span></button>{openHistory===s.id&&<div className="history-details"><div><strong>{s.session_date}</strong><span>{s.completed ? `Effort ${s.effort ?? '—'}/10` : 'In progress'}</span></div><p>{cleanNotes(s.notes) || (s.completed ? 'Workout completed' : 'Workout in progress')}</p>{exerciseLogs.filter(log=>log.session_id===s.id).map(log=><div className="exercise-entry" key={log.id}><strong>{log.exercise_name}</strong><span>{log.side} · {log.sets} sets{log.reps!=null ? ` × ${log.reps} reps` : ''}{log.hold_seconds!=null ? ` · ${log.hold_seconds}s` : ''}{log.difficulty!=null ? ` · difficulty ${log.difficulty}/10` : ''}</span>{log.notes && <p>{log.notes}</p>}</div>)}</div>}</article>)}</div>}
      <div className="export-history">
        <h3>Share your training history</h3>
        <p>Download your sessions, exercise feedback, measurements and plans as a JSON file to upload to ChatGPT. Your data stays private until you choose to share the file.</p>
        <button type="button" disabled={exporting} onClick={exportTrainingHistory}>
          {exporting ? 'Preparing export…' : '↓ Export training history'}
        </button>
      </div>
      </section>}
      {playerItem && activeSession && <Player key={playerItem.name} item={playerItem}
        position={playerIndex >= 0 ? playerIndex + 1 : workoutItems.length + 1} total={Math.max(workoutItems.length, playerIndex + 1)}
        initialDone={setsDone(playerItem.name)} next={playerNext} message={message} finishing={saving}
        onLogSet={logSet} onRate={rateExercise}
        onNext={() => { setMessage(''); setPlayerName(playerNext ? playerNext.name : null); }}
        onClose={() => setPlayerName(null)} onFinish={finishWorkout} />}
    </>}
    {message && !playerItem && <p role="status" className="status">{message}</p>}
    <footer>Built for the long game 🌿</footer>
  </main>;
}
