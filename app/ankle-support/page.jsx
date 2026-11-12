"use client";
import { useEffect, useState } from "react";
const exercises=[
{title:"Supported single-leg balance",dose:"3 × 15–20 seconds each side",instructions:"Stand beside a counter in supportive shoes. Use fingertip support. Stop if the ankle snaps, hurts, or feels unstable.",status:"Optional only if completely painless"},
{title:"Gentle calf stretch",dose:"2 × 20 seconds each side",instructions:"Face a wall with the back heel down. Keep the ankle neutral and use only a mild stretch. Skip if symptoms occur.",status:"Optional only if completely painless"},
{title:"Calf raises",dose:"Previously 2 × 10–12",instructions:"On hold: caused left-ankle soreness. Do not retry until assessed or symptoms have settled and a clinician advises progression.",status:"ON HOLD"},
{title:"Short-foot arch activation",dose:"Previously 2 × 8–10",instructions:"On hold: caused left-ankle soreness.",status:"ON HOLD"},
{title:"Plantar fascia toe stretch",dose:"Previously 3 × 20 seconds",instructions:"On hold: caused left-ankle pain. Do not force toes or ankle into the painful position.",status:"ON HOLD"}
];
export default function AnkleSupport(){
const [symptoms,setSymptoms]=useState({pain:"",snap:"",notes:""});
useEffect(()=>{try{const v=localStorage.getItem("ankle-support-log");if(v)setSymptoms(JSON.parse(v))}catch{}},[]);
function change(k,v){setSymptoms(s=>{const next={...s,[k]:v};try{localStorage.setItem("ankle-support-log",JSON.stringify(next))}catch{}return next})}
return <main style={{maxWidth:700,margin:"32px auto",padding:20,fontFamily:"system-ui",lineHeight:1.55}}>
<a href="/">← Back to Middle Splits</a><h1>Foot & ankle stability</h1>
<p>Optional support for foot control and chronic plantar fascia irritation. This is not a diagnosis or a treatment for possible tendon subluxation.</p>
<div style={{padding:16,border:"1px solid #d9a441",borderRadius:12}}><strong>Current precaution</strong><p>Left ankle has snapped for months and became sore after calf raises and arch activation, with pain during plantar fascia stretching. Pause all three. Avoid deliberately reproducing the snap. Arrange a nonurgent sports medicine or foot-and-ankle assessment; seek prompt care for swelling, instability, worsening pain or difficulty bearing weight.</p></div>
<h2>Exercises</h2>{exercises.map(e=><section key={e.title} style={{padding:"14px 0",borderBottom:"1px solid #aaa"}}><strong>{e.title}</strong><p style={{margin:"4px 0"}}>{e.status} · {e.dose}</p><p>{e.instructions}</p></section>)}
<h2>Symptom check-in</h2><p>Saved on this device; does not alter your splits progress chart.</p>
<label>Left ankle discomfort (0–10)<input aria-label="Left ankle discomfort" type="number" min="0" max="10" value={symptoms.pain} onChange={e=>change("pain",e.target.value)} style={{display:"block",padding:8,marginBottom:12}}/></label>
<label>Snapping today<select value={symptoms.snap} onChange={e=>change("snap",e.target.value)} style={{display:"block",padding:8,marginBottom:12}}><option value="">Select</option><option>None</option><option>Occasional</option><option>Frequent</option></select></label>
<label>Notes<textarea value={symptoms.notes} onChange={e=>change("notes",e.target.value)} rows={3} style={{display:"block",width:"100%",padding:8}} placeholder="Shoes, walking, tenderness, what triggered it…"/></label>
</main>}
