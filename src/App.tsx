import { useEffect, useMemo, useState } from 'react';
import { createMockTurn, describeBossStage, describeDoor, doorInsightFrom, encounterTurnRecord, getMockPrompt, recordsFromMockTurn } from './cartographer/mock';
import { activeBossRun, activeDoorRun, availableBosses, availableDoors, bossDefinition, currentBossStage } from './game/encounters';
import { applyGameEvents, createInitialCampaign, xpIntoCurrentLevel } from './game/engine';
import type { CampaignState, GameEvent, SassLevel } from './game/types';
import { deleteCampaign, loadCampaign, saveCampaign } from './persistence/db';
import { deserializeCampaign, downloadCampaign } from './persistence/transfer';

type Screen = 'map'|'talk'|'vault'|'me';
const GREYSON_MAP_SPRITE = '/assets/greyson/map/idle-front.png';

export default function App() {
  const [state, setState] = useState<CampaignState>(() => createInitialCampaign());
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>('map');
  const [reply, setReply] = useState('');
  const [answer, setAnswer] = useState('');
  const [message, setMessage] = useState('');
  const prompt = useMemo(() => getMockPrompt(state), [state]);
  const dispatch = (...events: GameEvent[]) => setState((current) => applyGameEvents(current, events));

  useEffect(() => { let live = true; void loadCampaign().then((saved) => { if (live && saved) setState(saved); }).catch(() => setMessage('Local save could not be read.')).finally(() => { if (live) setHydrated(true); }); return () => { live = false; }; }, []);
  useEffect(() => { if (hydrated) void saveCampaign(state).catch(() => setMessage('Automatic save failed. Export before leaving.')); }, [state, hydrated]);
  useEffect(() => { document.documentElement.dataset.reducedMotion = String(state.settings.reducedMotion); }, [state.settings.reducedMotion]);

  const submit = () => {
    if (!answer.trim() || state.sessionStatus === 'paused') return;
    const model = createMockTurn(state, prompt, answer);
    const records = recordsFromMockTurn(prompt, answer, model);
    const events: GameEvent[] = [{ type: 'ANSWER_ACCEPTED', turn: records.turnRecord }, ...records.evidence.map((evidence) => ({ type: 'EVIDENCE_ADDED', evidence }) as GameEvent)];
    if (records.insight) events.push({ type: 'INSIGHT_ADDED', insight: records.insight });
    setState((current) => applyGameEvents(current, events));
    setReply(model.reply); setAnswer('');
  };

  const bossRun = activeBossRun(state);
  const bossStage = currentBossStage(bossRun);
  const doorRun = activeDoorRun(state);
  const territoryLabels = Object.fromEntries(state.territories.map((item) => [item.id, item.label]));
  const encounter = bossRun && bossStage
    ? { kind: 'boss' as const, heading: bossDefinition(bossRun.bossId)?.label ?? 'Boss Fight', step: `Stage ${bossRun.stages.indexOf(bossStage) + 1} of ${bossRun.stages.length}`, dimension: bossStage.dimensions[0], ...describeBossStage(state, bossStage) }
    : doorRun
      ? { kind: 'door' as const, heading: 'Mystery Door', step: 'One crossing', dimension: doorRun.dimensions[0], ...describeDoor(state, doorRun, territoryLabels) }
      : null;

  const submitEncounter = () => {
    if (!encounter || !answer.trim() || state.sessionStatus === 'paused') return;
    if (encounter.kind === 'boss' && bossRun) {
      dispatch({ type: 'BOSS_STAGE_ANSWERED', turn: encounterTurnRecord(bossRun.territoryId, encounter.dimension, encounter.question, answer) });
      setReply('Logged. The map does not get to soften that one for you.');
    } else if (doorRun) {
      const wording = describeDoor(state, doorRun, territoryLabels);
      dispatch({ type: 'DOOR_ANSWERED', turn: encounterTurnRecord(doorRun.territoryIds[0], encounter.dimension, wording.question, answer), insight: doorInsightFrom(doorRun, wording) });
      setReply('The crossing is recorded as a hypothesis, not a verdict.');
    }
    setAnswer('');
  };

  const leaveEncounter = () => { dispatch(encounter?.kind === 'boss' ? { type: 'BOSS_WITHDRAWN' } : { type: 'DOOR_CLOSED' }); setReply('Stepped back. Nothing was lost.'); setAnswer(''); };

  const xp = xpIntoCurrentLevel(state);
  const openBosses = availableBosses(state);
  const openDoors = availableDoors(state);
  const activeTerritory = state.territories.find((item) => item.id === state.activeTerritory) ?? state.territories[0];
  const quest = state.quests.find((item) => item.id === state.activeQuest);
  const notices = state.presentation === 'normal' ? state.presentationQueue : [];

  // The six permanent controls. They are rendered identically for ordinary
  // encounters, Boss Fights and Mystery Doors, and never depend on progression.
  const renderAgency = (onPass: () => void, privateDimension: string) => <div className="agency" data-testid="agency">
    <button data-testid="agency-pass" onClick={onPass}>PASS</button>
    <button data-testid="agency-private" onClick={()=>{dispatch({type:'PRIVATE_TOPIC_ADDED',topic:privateDimension});setReply('Private. I will not intentionally return to that dimension.');}}>PRIVATE</button>
    <button data-testid="agency-stop" onClick={()=>dispatch({type:'SESSION_SET',status:state.sessionStatus==='paused'?'active':'paused'})}>{state.sessionStatus==='paused'?'RESUME':'STOP'}</button>
    <button data-testid="agency-serious" onClick={()=>{dispatch({type:'PRESENTATION_SET',mode:'quiet'});setReply('Serious mode. Plain language; no fanfare.');}}>SERIOUS</button>
    <button data-testid="agency-help" onClick={()=>setMessage('PASS skips. PRIVATE closes a topic. STOP pauses. SERIOUS suppresses fanfare. Sass is always adjustable.')}>HELP</button>
    <button data-testid="agency-sass" onClick={()=>dispatch({type:'SASS_SET',sass:state.settings.sass==='low'?'medium':state.settings.sass==='medium'?'risks-understood':'low'})}>SASS</button>
  </div>;

  const renderEncounter = () => encounter && <section className="screen" data-testid={`encounter-${encounter.kind}`}>
    <div className="eyebrow">{encounter.kind==='boss'?'BOSS FIGHT':'MYSTERY DOOR'}</div>
    <header><div><h1>{encounter.heading}</h1><p>{encounter.step} · resolved by the game engine, not the Cartographer</p></div><span className="chip">{state.presentation}</span></header>
    <article className={`card encounter ${encounter.kind}`}>
      {reply && <p className="reply">{reply}</p>}
      <h2>{encounter.question}</h2>
      {encounter.evidenceClaims.length>0 && <ul className="evidence-list">{encounter.evidenceClaims.map((claim,index)=><li key={index}>{claim}</li>)}</ul>}
      <small>Drawn from evidence you already mapped. Dimension: {encounter.dimension}</small>
    </article>
    {state.sessionStatus==='paused' && <div className="quiet">Session paused. Your Atlas is safe.</div>}
    <label className="answer">Your position<textarea rows={6} value={answer} onChange={(e)=>setAnswer(e.target.value)} disabled={state.sessionStatus==='paused'} data-testid="encounter-input" /></label>
    <button className="primary full" data-testid="encounter-submit" onClick={submitEncounter} disabled={!answer.trim()||state.sessionStatus==='paused'}>{encounter.kind==='boss'?'Hold this position':'Walk through'}</button>
    <button className="full leave" data-testid="encounter-leave" onClick={leaveEncounter}>{encounter.kind==='boss'?'Step back for now':'Close the door for now'}</button>
    {renderAgency(()=>{dispatch(encounter.kind==='boss'?{type:'BOSS_STAGE_PASSED'}:{type:'DOOR_CLOSED'});setReply('Passed. No penalty, no cost.');setAnswer('');}, encounter.dimension)}
  </section>;

  const renderMap = () => <section className="screen"><div className="eyebrow">THE GREYSON MAP</div><header><div><h1>Atlas of One</h1><p>One person. More territory than a questionnaire can survive.</p></div><b className="level">L{state.level}</b></header><div className="xp"><span>XP {state.xp}</span><div><i style={{width:`${Math.min(100,(xp.current/xp.required)*100)}%`}} /></div></div><div className="map"><div className="avatar"><img src={GREYSON_MAP_SPRITE} alt="Greyson map avatar" draggable={false}/></div>{state.territories.map((territory) => <button key={territory.id} className={`territory ${territory.id===state.activeTerritory?'active':''}`} onClick={() => dispatch({type:'ACTIVE_TERRITORY_SET',territoryId:territory.id})}><strong>{territory.label}</strong><small>{territory.status} · {territory.coveredDimensions.length}/{territory.requiredDimensions.length}</small></button>)}</div><article className="card"><span className="eyebrow">CURRENT TERRITORY</span><h2>{activeTerritory.label}</h2><p>{activeTerritory.coveredDimensions.length} dimensions mapped.</p><button className="primary" onClick={() => setScreen('talk')}>Continue encounter</button></article><article className="quest"><b>◆</b><div><span className="eyebrow">CURRENT QUEST</span><strong>{quest?.label ?? 'No active quest'}</strong><small>{quest ? `${quest.progress}/${quest.target} · ${quest.description}` : ''}</small></div></article>{(openBosses.length>0||openDoors.length>0||encounter)&&<article className="card encounters" data-testid="encounter-offers"><span className="eyebrow">OPEN ENCOUNTERS</span><p>Earned from territory you have already mapped.</p>{encounter&&<button className="primary full" data-testid="resume-encounter" onClick={()=>setScreen('talk')}>Resume {encounter.heading}</button>}{!encounter&&openBosses.map((boss)=>{const run=state.bossRuns.find((item)=>item.bossId===boss.id&&item.status==='active');const done=run?run.stages.filter((stage)=>stage.outcome!=='pending').length:0;return <button key={boss.id} className="offer boss" data-testid={`start-${boss.id}`} onClick={()=>{dispatch({type:'BOSS_STARTED',bossId:boss.id});setReply('');setScreen('talk');}}><strong>▲ {run?'Resume: ':''}{boss.label}</strong><small>{run?`Stage ${done+1} of ${run.stages.length} · progress kept`:boss.description}</small></button>;})}{!encounter&&openDoors.slice(0,3).map((door)=><button key={door.doorId} className="offer door" data-testid={`open-${door.doorId}`} onClick={()=>{dispatch({type:'DOOR_OPENED',doorId:door.doorId});setReply('');setScreen('talk');}}><strong>◈ {territoryLabels[door.territoryIds[0]]} × {territoryLabels[door.territoryIds[1]]}</strong><small>A crossing between two mapped regions.</small></button>)}</article>}</section>;

  const renderTalk = () => encounter ? renderEncounter() : <section className="screen"><div className="eyebrow">ENCOUNTER · {activeTerritory.label.toUpperCase()}</div><header><div><h1>The Cartographer</h1><p>Mock mode · deterministic game engine</p></div><span className="chip">{state.presentation}</span></header><article className="card prompt">{reply && <p className="reply">{reply}</p>}<h2>{prompt.question}</h2><small>Evidence dimension: {prompt.dimension}</small></article>{state.sessionStatus==='paused' && <div className="quiet">Session paused. Your Atlas is safe.</div>}<label className="answer">Your coordinate<textarea rows={6} value={answer} onChange={(e)=>setAnswer(e.target.value)} disabled={state.sessionStatus==='paused'} /></label><button className="primary full" onClick={submit} disabled={!answer.trim()||state.sessionStatus==='paused'}>Map this answer</button>{renderAgency(()=>setReply('Passed. No penalty.'), prompt.dimension)}</section>;

  const renderVault = () => <section className="screen"><div className="eyebrow">LOCAL EVIDENCE VAULT</div><h1>Vault</h1><p>Evidence, fragments, contradictions, and things the map is not allowed to pretend it knows.</p><h2>Insight Cards</h2>{state.insights.length===0?<div className="empty">No insight cards yet. Correct.</div>:state.insights.slice().reverse().map((insight)=><article className="card" key={insight.id}><span className="eyebrow">{insight.confidence.toUpperCase()} · {insight.status}</span><h3>{insight.title}</h3><p>{insight.summary}</p>{insight.status==='pending'&&<div className="row"><button onClick={()=>dispatch({type:'INSIGHT_CONFIRMED',insightId:insight.id})}>ACCURATE</button><button onClick={()=>dispatch({type:'INSIGHT_REJECTED',insightId:insight.id})}>NOPE</button></div>}</article>)}<h2>Fragments</h2><div className="fragment-grid">{state.territories.map((t)=><div key={t.id}><b>{state.mapFragments.some((f)=>f.territoryId===t.id)?'◆':'◇'}</b><small>{t.label}</small></div>)}</div><h2>Achievements</h2>{state.achievements.filter((a)=>a.unlockedAt).map((a)=><article className="quest" key={a.id}><b>✦</b><div><strong>{a.label}</strong><small>{a.description}</small></div></article>)}</section>;

  const importFile = async (file?: File) => { if (!file) return; try { setState(deserializeCampaign(await file.text())); setMessage('Atlas imported and validated.'); setScreen('map'); } catch (error) { setMessage(error instanceof Error ? `Import rejected: ${error.message}` : 'Import rejected.'); } };
  const renderMe = () => <section className="screen"><div className="eyebrow">CHARACTER RECORD</div><div className="profile"><div className="portrait"><img src={GREYSON_MAP_SPRITE} alt="Greyson character avatar" draggable={false}/></div><div><h1>Greyson</h1><p>{state.player.pronouns} · Level {state.level} · {state.xp} XP</p></div></div><div className="stats"><div><b>{state.evidence.filter((e)=>e.status==='active').length}</b><small>Evidence</small></div><div><b>{state.insights.filter((i)=>i.status==='confirmed').length}</b><small>Confirmed</small></div><div><b>{state.mapFragments.length}</b><small>Fragments</small></div><div><b>{state.unlocks.filter((u)=>u.unlockedAt).length}</b><small>Unlocks</small></div></div><article className="card settings"><h2>Cartographer</h2><label>Sass<select value={state.settings.sass} onChange={(e)=>dispatch({type:'SASS_SET',sass:e.target.value as SassLevel})}><option value="low">Low</option><option value="medium">Medium</option><option value="risks-understood">I Understand the Risks</option></select></label><label>Reduced motion<input type="checkbox" checked={state.settings.reducedMotion} onChange={(e)=>setState((s)=>({...s,settings:{...s.settings,reducedMotion:e.target.checked}}))}/></label></article><article className="card settings"><h2>Your Atlas</h2><button onClick={()=>downloadCampaign(state)}>Export Atlas</button><label className="file">Import Atlas<input type="file" accept="application/json,.json,.atlas" onChange={(e)=>void importFile(e.target.files?.[0])}/></label><button className="danger" onClick={()=>void deleteCampaign().then(()=>setState(createInitialCampaign()))}>Delete local Atlas</button></article><article className="empty"><span className="eyebrow">LEVEL 8 REVEAL</span><h2>Detailed character turnaround</h2><p>The canonical Aerron/Greyson turnaround is supplied and reserved for the later Character/Vault reveal pass.</p></article></section>;

  return <div className="shell">{message&&<div className="toast">{message}<button onClick={()=>setMessage('')}>×</button></div>}{notices.length>0&&<div className="overlay"><article className="unlock"><span className="eyebrow">MAP UPDATED</span><h2>{notices[0].title}</h2><p>{notices[0].detail}</p><button className="primary" onClick={()=>dispatch({type:'PRESENTATION_QUEUE_CLEARED'})}>Continue</button></article></div>}{screen==='map'?renderMap():screen==='talk'?renderTalk():screen==='vault'?renderVault():renderMe()}<nav>{(['map','talk','vault','me'] as Screen[]).map((item)=><button key={item} className={screen===item?'active':''} onClick={()=>setScreen(item)}><span>{item==='map'?'⌖':item==='talk'?'◉':item==='vault'?'◆':'◇'}</span><small>{item==='me'?'Me':item[0].toUpperCase()+item.slice(1)}</small></button>)}</nav></div>;
}
