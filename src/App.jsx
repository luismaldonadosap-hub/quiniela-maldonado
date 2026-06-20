import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from './supabase.js'

// ── CONSTANTES ────────────────────────────────────────────────
const ADMIN_PIN  = '2145'
const LOCK_DATE  = new Date('2026-06-11T21:00:00Z')

const GROUPS = {
  A:['México','Sudáfrica','Corea del Sur','Chequia'],
  B:['Canadá','Bosnia-Herzegovina','Catar','Suiza'],
  C:['Brasil','Marruecos','Haití','Escocia'],
  D:['EE.UU.','Paraguay','Australia','Turquía'],
  E:['Alemania','Curacao','Costa de Marfil','Ecuador'],
  F:['Japón','Países Bajos','Suecia','Túnez'],
  G:['Bélgica','Egipto','Irán','Nueva Zelanda'],
  H:['España','Cabo Verde','Arabia Saudí','Uruguay'],
  I:['Francia','Senegal','Irak','Noruega'],
  J:['Argentina','Argelia','Austria','Jordania'],
  K:['Portugal','DR Congo','Uzbekistán','Colombia'],
  L:['Inglaterra','Croacia','Ghana','Panamá'],
}

const FLAGS = {
  'México':'🇲🇽','Sudáfrica':'🇿🇦','Corea del Sur':'🇰🇷','Chequia':'🇨🇿',
  'Canadá':'🇨🇦','Bosnia-Herzegovina':'🇧🇦','Catar':'🇶🇦','Suiza':'🇨🇭',
  'Brasil':'🇧🇷','Marruecos':'🇲🇦','Haití':'🇭🇹','Escocia':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'EE.UU.':'🇺🇸','Paraguay':'🇵🇾','Australia':'🇦🇺','Turquía':'🇹🇷',
  'Alemania':'🇩🇪','Curacao':'🇨🇼','Costa de Marfil':'🇨🇮','Ecuador':'🇪🇨',
  'Japón':'🇯🇵','Países Bajos':'🇳🇱','Suecia':'🇸🇪','Túnez':'🇹🇳',
  'Bélgica':'🇧🇪','Egipto':'🇪🇬','Irán':'🇮🇷','Nueva Zelanda':'🇳🇿',
  'España':'🇪🇸','Cabo Verde':'🇨🇻','Arabia Saudí':'🇸🇦','Uruguay':'🇺🇾',
  'Francia':'🇫🇷','Senegal':'🇸🇳','Irak':'🇮🇶','Noruega':'🇳🇴',
  'Argentina':'🇦🇷','Argelia':'🇩🇿','Austria':'🇦🇹','Jordania':'🇯🇴',
  'Portugal':'🇵🇹','DR Congo':'🇨🇩','Uzbekistán':'🇺🇿','Colombia':'🇨🇴',
  'Inglaterra':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Croacia':'🇭🇷','Ghana':'🇬🇭','Panamá':'🇵🇦',
}
const F = t => (FLAGS[t] || '🏳') + ' ' + (t || '?')

const PHASE_ORDER  = ['r32','r16','qf','sf','tp','final']
const PHASE_LABELS = {r32:'Ronda de 32',r16:'Octavos',qf:'Cuartos',sf:'Semis',tp:'3er Puesto',final:'⭐ Final'}
const PHASE_COLORS = {r32:'#546e7a',r16:'#1565c0',qf:'#6a1b9a',sf:'#ad1457',tp:'#37474f',final:'#f57f17'}
const PHASE_COUNT  = {r32:16,r16:8,qf:4,sf:2,tp:1,final:1}

// ── GENERADORES ───────────────────────────────────────────────
function buildGroupMatches() {
  const m=[]; let id=0
  const pairs=[[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]]
  for(const [grp,teams] of Object.entries(GROUPS)){
    pairs.forEach(([i,j])=>m.push({id:`groups-${grp}-${id++}`,phase:'groups',grp,t1:teams[i],t2:teams[j],s1:'',s2:'',pen1:'',pen2:''}))
  }
  return m
}
function buildKnockoutMatches() {
  const m=[]; let id=0
  for(const phase of PHASE_ORDER){
    for(let i=0;i<PHASE_COUNT[phase];i++) m.push({id:`${phase}-${id++}`,phase,grp:null,t1:'',t2:'',s1:'',s2:'',pen1:'',pen2:''})
  }
  return m
}
const DEFAULT_MATCHES = [...buildGroupMatches(), ...buildKnockoutMatches()]

// ── STANDINGS ─────────────────────────────────────────────────
function sortGroup(teams, matches){
  const s={}
  teams.forEach(t=>{s[t]={pts:0,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0}})
  matches.forEach(m=>{
    const g1=parseInt(m.s1),g2=parseInt(m.s2)
    if(isNaN(g1)||isNaN(g2)) return
    const t1=s[m.t1],t2=s[m.t2]
    if(!t1||!t2) return
    t1.pj++;t2.pj++;t1.gf+=g1;t1.gc+=g2;t2.gf+=g2;t2.gc+=g1
    if(g1>g2){t1.pg++;t1.pts+=3;t2.pp++}
    else if(g2>g1){t2.pg++;t2.pts+=3;t1.pp++}
    else{t1.pe++;t1.pts++;t2.pe++;t2.pts++}
  })
  return Object.entries(s).sort(([,a],[,b])=>{
    if(b.pts!==a.pts) return b.pts-a.pts
    const dA=a.gf-a.gc,dB=b.gf-b.gc
    if(dB!==dA) return dB-dA
    return b.gf-a.gf
  })
}

// ── COMPONENTES ───────────────────────────────────────────────
const ScoreInput = ({val,onChange,locked,w=44,color='#fff'}) => (
  <input type="number" min="0" max="30" value={val}
    onChange={e=>!locked&&onChange(e.target.value)}
    readOnly={locked}
    style={{width:w,textAlign:'center',background:locked?'#111':'#1e2d3d',
      border:`2px solid ${locked?'#263238':'#37474f'}`,borderRadius:8,
      color,fontSize:16,fontWeight:800,padding:'4px',cursor:locked?'not-allowed':'text'}}/>
)

function MatchRow({m,onScore,locked,isAdmin}){
  const hasPen=m.s1!==''&&m.s2!==''&&parseInt(m.s1)===parseInt(m.s2)&&m.phase!=='groups'
  return(
    <div style={{background:'#0d1b2a',borderRadius:10,padding:'10px 12px',border:'1px solid #1e3a5f',marginBottom:6,opacity:m.t1||m.phase==='groups'?1:0.4}}>
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <div style={{flex:1,textAlign:'right',fontSize:13,fontWeight:600,minWidth:90}}>{F(m.t1)}</div>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <ScoreInput val={m.s1} onChange={v=>onScore(m.id,'s1',v)} locked={locked}/>
          <span style={{color:'#546e7a',fontWeight:700}}>–</span>
          <ScoreInput val={m.s2} onChange={v=>onScore(m.id,'s2',v)} locked={locked}/>
        </div>
        <div style={{flex:1,textAlign:'left',fontSize:13,fontWeight:600,minWidth:90}}>{F(m.t2)}</div>
      </div>
      {hasPen&&(
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:6}}>
          <span style={{fontSize:11,color:'#ff7043'}}>Penaltis:</span>
          <ScoreInput val={m.pen1} onChange={v=>onScore(m.id,'pen1',v)} locked={locked} w={36} color='#ff8a65'/>
          <span style={{color:'#546e7a'}}>–</span>
          <ScoreInput val={m.pen2} onChange={v=>onScore(m.id,'pen2',v)} locked={locked} w={36} color='#ff8a65'/>
        </div>
      )}
    </div>
  )
}

// ── APP ───────────────────────────────────────────────────────
export default function App(){
  const [nickname,setNickname]         = useState('')
  const [nickInput,setNickInput]       = useState('')
  const [pinInput,setPinInput]         = useState('')
  const [pinConfirm,setPinConfirm]     = useState('')
  const [pinAuth,setPinAuth]           = useState('')
  const [pinStep,setPinStep]           = useState('nick')
  const [pinErrorMsg,setPinErrorMsg]   = useState('')
  const [tab,setTab]                   = useState('grupos')
  const [activeGroup,setActiveGroup]   = useState('A')
  const [matches,setMatches]           = useState(DEFAULT_MATCHES)
  const matchesRef                     = useRef(DEFAULT_MATCHES)
  const [quiniela,setQuiniela]         = useState({})
  const [allQuinielas,setAllQuinielas] = useState([])
  const [isAdmin,setIsAdmin]           = useState(false)
  const [showLogin,setShowLogin]       = useState(false)
  const [pin,setPin]                   = useState('')
  const [adminPinError,setAdminPinError] = useState(false)
  const [saving,setSaving]             = useState(false)
  const [aiLoading,setAiLoading]       = useState(false)
  const [aiMsg,setAiMsg]               = useState('')
  const [pronView,setPronView]         = useState('tabla')
  const [selectedNick,setSelectedNick] = useState('')
  const [adminSelectedNick,setAdminSelectedNick] = useState('')
  const [csvMsg,setCsvMsg]             = useState('')
  const [csvLoading,setCsvLoading]     = useState(false)
  const [showChangePin,setShowChangePin]   = useState(false)
  const [changePinCurrent,setChangePinCurrent] = useState('')
  const [changePinNew,setChangePinNew]     = useState('')
  const [changePinConfirm,setChangePinConfirm] = useState('')
  const [changePinMsg,setChangePinMsg]     = useState('')

  const now = new Date()
  const isLocked = now >= LOCK_DATE && !isAdmin
  const tournamentStarted = now >= LOCK_DATE

  // Keep matchesRef in sync with matches state
  useEffect(()=>{ matchesRef.current = matches },[matches])

  // ── CARGA INICIAL ─────────────────────────────────────────
  useEffect(()=>{ loadMatches() },[])
  useEffect(()=>{ if(nickname){ loadMyQuiniela(); loadAllQuinielas() } },[nickname])

  async function loadMatches(){
    const {data} = await supabase.from('matches').select('*')
    if(data&&data.length>0){
      setMatches(prev=>prev.map(m=>{
        const row=data.find(r=>r.id===m.id)
        return row?{...m,t1:row.t1||m.t1,t2:row.t2||m.t2,s1:row.s1||'',s2:row.s2||'',pen1:row.pen1||'',pen2:row.pen2||''}:m
      }))
    }
  }

  async function loadMyQuiniela(){
    const {data} = await supabase.from('quiniela').select('*').eq('nickname',nickname)
    if(data){ const q={}; data.forEach(r=>{q[r.match_id]={s1:r.s1,s2:r.s2}}); setQuiniela(q) }
  }

  async function loadAllQuinielas(){
    const {data} = await supabase.from('quiniela').select('*')
    if(data) setAllQuinielas(data)
  }

  // ── REALTIME ──────────────────────────────────────────────
  useEffect(()=>{
    const ch1=supabase.channel('matches-changes')
      .on('postgres_changes',{event:'*',schema:'public',table:'matches'},()=>loadMatches())
      .subscribe()
    const ch2=supabase.channel('quiniela-changes')
      .on('postgres_changes',{event:'*',schema:'public',table:'quiniela'},()=>loadAllQuinielas())
      .subscribe()
    return()=>{ supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  },[])

  // ── PIN HANDLERS ──────────────────────────────────────────
  async function handleNickSubmit(){
    const nick=nickInput.trim()
    if(!nick) return
    try{
      const {data,error}=await supabase.from('players').select('pin').eq('nickname',nick).single()
      if(data&&!error){ setNickname(nick); setPinStep('verify') }
      else{ setNickname(nick); setPinStep('create') }
    }catch{ setNickname(nick); setPinStep('create') }
  }

  async function handleCreatePin(){
    if(pinInput.length!==4||!/^\d{4}$/.test(pinInput)){ setPinErrorMsg('El PIN debe ser de 4 dígitos numéricos'); return }
    if(pinInput!==pinConfirm){ setPinErrorMsg('Los PINs no coinciden'); return }
    await supabase.from('players').upsert({nickname,pin:pinInput})
    setPinStep('done'); setPinErrorMsg('')
  }

  async function handleVerifyPin(){
    const {data}=await supabase.from('players').select('pin').eq('nickname',nickname)
    if(data&&data.length>0&&data[0].pin===pinAuth){ setPinStep('done'); setPinErrorMsg('') }
    else setPinErrorMsg('PIN incorrecto')
  }

  async function handleChangePin(){
    if(changePinNew.length!==4||!/^\d{4}$/.test(changePinNew)){ setChangePinMsg('El PIN debe ser de 4 dígitos'); return }
    if(changePinNew!==changePinConfirm){ setChangePinMsg('Los PINs no coinciden'); return }
    const {data}=await supabase.from('players').select('pin').eq('nickname',nickname)
    if(!data||data.length===0||data[0].pin!==changePinCurrent){ setChangePinMsg('PIN actual incorrecto'); return }
    await supabase.from('players').update({pin:changePinNew}).eq('nickname',nickname)
    setChangePinMsg('✅ PIN cambiado correctamente')
    setTimeout(()=>{ setShowChangePin(false); setChangePinCurrent(''); setChangePinNew(''); setChangePinConfirm(''); setChangePinMsg('') },1500)
  }

  // ── ADMIN ─────────────────────────────────────────────────
  function tryLogin(){
    if(pin===ADMIN_PIN){ setIsAdmin(true); setShowLogin(false); setAdminPinError(false); setPin('') }
    else setAdminPinError(true)
  }

  // ── MATCH SCORES ──────────────────────────────────────────
  const updateMatchScore = useCallback(async(id,field,val)=>{
    if(isLocked) return
    setMatches(prev=>prev.map(m=>m.id===id?{...m,[field]:val}:m))
    const m=matchesRef.current.find(x=>x.id===id)
    if(!m) return
    setSaving(true)
    await supabase.from('matches').upsert({
      id,phase:m.phase,grp:m.grp,
      t1:field==='t1'?val:m.t1,t2:field==='t2'?val:m.t2,
      s1:field==='s1'?val:m.s1,s2:field==='s2'?val:m.s2,
      pen1:field==='pen1'?val:m.pen1,pen2:field==='pen2'?val:m.pen2,
    })
    setSaving(false)
  },[isLocked])

  const updateKnockoutTeam = useCallback(async(id,field,val)=>{
    if(!isAdmin||isLocked) return
    setMatches(prev=>prev.map(m=>m.id===id?{...m,[field]:val}:m))
    const m=matchesRef.current.find(x=>x.id===id)
    if(!m) return
    await supabase.from('matches').upsert({
      id,phase:m.phase,grp:m.grp,
      t1:field==='t1'?val:m.t1,t2:field==='t2'?val:m.t2,
      s1:m.s1,s2:m.s2,pen1:m.pen1,pen2:m.pen2,
    })
  },[isAdmin,isLocked])

  // ── QUINIELA ──────────────────────────────────────────────
  const updateQuiniela = useCallback(async(matchId,field,val)=>{
    if(tournamentStarted||!nickname) return
    setQuiniela(prev=>({...prev,[matchId]:{...(prev[matchId]||{s1:'',s2:''}), [field]:val}}))
    const cur=quiniela[matchId]||{s1:'',s2:''}
    await supabase.from('quiniela').upsert({
      nickname,match_id:matchId,
      s1:field==='s1'?val:cur.s1,
      s2:field==='s2'?val:cur.s2,
    },{onConflict:'nickname,match_id'})
  },[quiniela,nickname,tournamentStarted])

  // ── CSV IMPORT ────────────────────────────────────────────
  async function importCSV(file){
    setCsvLoading(true); setCsvMsg('')
    const text=await file.text()
    const lines=text.trim().replace(/\r/g,'').split('\n').slice(1)
    let ok=0,err=0
    for(const line of lines){
      const sep=line.includes(';')?';':','
      const parts=line.split(sep)
      if(parts.length<6){err++;continue}
      const [nick,grp,t1,t2,s1,s2]=parts.map(p=>p.trim().replace(/"/g,'').replace(/\r/g,''))
      if(!nick||!grp||!t1||!t2){err++;continue}
      const m=matchesRef.current.find(x=>x.grp===grp&&x.t1===t1&&x.t2===t2&&x.phase==='groups')
      if(!m){err++;continue}
      await supabase.from('quiniela').upsert({nickname:nick,match_id:m.id,s1:s1||'',s2:s2||''},{onConflict:'nickname,match_id'})
      ok++
    }
    setCsvMsg(`✅ ${ok} pronósticos importados${err>0?` · ⚠️ ${err} líneas con error`:''}`)
    setCsvLoading(false)
    loadAllQuinielas()
  }

  async function saveAdminQuiniela(matchId,field,val){
    if(!adminSelectedNick) return
    const cur=allQuinielas.find(r=>r.nickname===adminSelectedNick&&r.match_id===matchId)||{s1:'',s2:''}
    await supabase.from('quiniela').upsert({
      nickname:adminSelectedNick,match_id:matchId,
      s1:field==='s1'?val:cur.s1,
      s2:field==='s2'?val:cur.s2,
    },{onConflict:'nickname,match_id'})
    loadAllQuinielas()
  }

  // ── AI FETCH ──────────────────────────────────────────────
  async function fetchRealScores(){
    setAiLoading(true); setAiMsg('')
    try{
      const res=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'x-api-key':import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version':'2023-06-01',
          'anthropic-dangerous-direct-browser-access':'true',
        },
        body:JSON.stringify({
          model:'claude-sonnet-4-6',max_tokens:2000,
          tools:[{type:'web_search_20250305',name:'web_search'}],
          messages:[{role:'user',content:`Busca resultados reales de la Copa del Mundo FIFA 2026 (empieza 11 jun 2026).
Devuelve SOLO JSON sin markdown:
Sin partidos: {"played":false,"message":"..."}
Con partidos: {"played":true,"matches":[{"phase":"groups","grp":"A","t1":"México","t2":"Sudáfrica","s1":2,"s2":0},...]}
Para eliminatorias usa phase: r32/r16/qf/sf/tp/final y omite grp.`}]
        })
      })
      const data=await res.json()
      const text=data.content?.filter(c=>c.type==='text').map(c=>c.text).join('')||''
      const clean=text.replace(/```json|```/g,'').replace(/^[^{]*/,'').replace(/[^}]*$/,'').trim()
      const parsed=JSON.parse(clean)
      if(!parsed.played){ setAiMsg(parsed.message||'Torneo no iniciado.') }
      else if(parsed.matches?.length){
        // Upsert all matches directly to Supabase
        for(const pm of parsed.matches){
          const m=matchesRef.current.find(x=>x.grp===pm.grp&&x.t1===pm.t1&&x.t2===pm.t2&&x.phase===pm.phase)
          if(m){
            await supabase.from('matches').upsert({
              id:m.id,phase:m.phase,grp:m.grp,
              t1:m.t1,t2:m.t2,
              s1:String(pm.s1),s2:String(pm.s2),
              pen1:m.pen1||'',pen2:m.pen2||''
            })
          }
        }
        // Reload fresh data from Supabase
        const {data:freshData}=await supabase.from('matches').select('*')
        if(freshData){
          setMatches(prev=>prev.map(m=>{
            const row=freshData.find(r=>r.id===m.id)
            return row?{...m,s1:row.s1||'',s2:row.s2||'',pen1:row.pen1||'',pen2:row.pen2||''}:m
          }))
        }
        setAiMsg(`✅ ${parsed.matches.length} resultado(s) actualizados.`)
      }
    }catch(e){ setAiMsg('Error al obtener resultados.') }
    setAiLoading(false)
  }

  // ── STANDINGS ─────────────────────────────────────────────
  const groupStandings=useMemo(()=>{
    const s={}
    for(const [g,teams] of Object.entries(GROUPS)){
      s[g]=sortGroup(teams,matches.filter(m=>m.grp===g))
    }
    return s
  },[matches])

  // ── RANKING ───────────────────────────────────────────────
  const ranking=useMemo(()=>{
    const users=[...new Set(allQuinielas.map(r=>r.nickname))]
    return users.map(nick=>{
      let pts=0
      matches.forEach(m=>{
        if(m.s1===''||m.s2==='') return
        const r1=parseInt(m.s1),r2=parseInt(m.s2)
        if(isNaN(r1)||isNaN(r2)) return
        const q=allQuinielas.find(r=>r.nickname===nick&&r.match_id===m.id)
        if(!q||q.s1===''||q.s2==='') return
        const q1=parseInt(q.s1),q2=parseInt(q.s2)
        if(isNaN(q1)||isNaN(q2)) return
        if(q1===r1&&q2===r2) pts+=3
        else{const rR=r1>r2?'1':r1<r2?'2':'X',qR=q1>q2?'1':q1<q2?'2':'X'; if(rR===qR) pts++}
      })
      return{nick,pts}
    }).sort((a,b)=>b.pts-a.pts)
  },[allQuinielas,matches])

  // ── PRONÓSTICOS ───────────────────────────────────────────
  const allNicknames=[...new Set(allQuinielas.map(r=>r.nickname))]
  const PLAYER_COLORS=['#42a5f5','#69f0ae','#ff7043','#ce93d8','#ffca28','#26c6da','#ef5350','#66bb6a','#ffa726','#ab47bc']
  const playerColor=nick=>PLAYER_COLORS[allNicknames.indexOf(nick)%PLAYER_COLORS.length]
  const playedMatches=matches.filter(m=>m.s1!==''&&m.s2!==''&&!isNaN(parseInt(m.s1))&&!isNaN(parseInt(m.s2)))
  const groupMs=matches.filter(m=>m.grp===activeGroup)

  function getBadge(match,q){
    if(!q||q.s1===''||q.s2==='') return null
    if(match.s1===''||match.s2==='') return null
    const r1=parseInt(match.s1),r2=parseInt(match.s2)
    const q1=parseInt(q.s1),q2=parseInt(q.s2)
    if(isNaN(r1)||isNaN(r2)||isNaN(q1)||isNaN(q2)) return null
    if(q1===r1&&q2===r2) return{pts:3,color:'#69f0ae',label:'✅'}
    const rR=r1>r2?'1':r1<r2?'2':'X',qR=q1>q2?'1':q1<q2?'2':'X'
    if(rR===qR) return{pts:1,color:'#ffeb3b',label:'🟡'}
    return{pts:0,color:'#ef5350',label:'❌'}
  }

  const getQ=(nick,matchId)=>allQuinielas.find(r=>r.nickname===nick&&r.match_id===matchId)

  // ── ESTADÍSTICAS ──────────────────────────────────────────
  const progressData=useMemo(()=>{
    return playedMatches.map((m,idx)=>{
      const point={label:`P${idx+1}`,idx:idx+1}
      allNicknames.forEach(nick=>{
        let acc=0
        for(let i=0;i<=idx;i++){
          const pm=playedMatches[i]
          const pq=allQuinielas.find(r=>r.nickname===nick&&r.match_id===pm.id)
          const pb=getBadge(pm,pq)
          if(pb) acc+=pb.pts
        }
        point[nick]=acc
      })
      return point
    })
  },[playedMatches,allNicknames,allQuinielas])

  const playerStats=useMemo(()=>{
    return allNicknames.map(nick=>{
      let current=0,maxExtra=0
      matches.forEach(m=>{
        const q=allQuinielas.find(r=>r.nickname===nick&&r.match_id===m.id)
        const badge=getBadge(m,q)
        if(badge) current+=badge.pts
        if((m.s1===''||m.s2==='')&&q&&q.s1!==''&&q.s2!=='') maxExtra+=3
      })
      return{nick,current,max:current+maxExtra}
    }).sort((a,b)=>b.current-a.current)
  },[allNicknames,allQuinielas,matches])

const winProb=useMemo(()=>{
    if(playerStats.length===0) return{}
    const totalCurrent=playerStats.reduce((s,p)=>s+p.current,0)
    const totalMax=playerStats.reduce((s,p)=>s+p.max,0)
    const useMax = totalCurrent===0
    const scores=playerStats.map(p=>({
      nick:p.nick,
      score: useMax ? p.max : (p.current*0.85 + p.max*0.15)
    }))
    const totalScore=scores.reduce((s,p)=>s+p.score,0)
    const probs={}
    scores.forEach(p=>{probs[p.nick]=totalScore>0?Math.round((p.score/totalScore)*100):0})
    const total=Object.values(probs).reduce((s,v)=>s+v,0)
    if(total!==100&&scores.length>0){
      const sorted=[...scores].sort((a,b)=>b.score-a.score)
      probs[sorted[0].nick]+=100-total
    }
    return probs
  },[playerStats])
  // ── TABS ──────────────────────────────────────────────────
  const TABS=[
    {id:'grupos',label:'📊 Grupos'},
    ...(isAdmin?[{id:'partidos',label:'⚽ Partidos'}]:[]),
    {id:'eliminatorias',label:'🏆 Eliminatorias'},
    {id:'bracket',label:'🌐 Bracket'},
    {id:'quiniela',label:'🎯 Quiniela'},
    {id:'ranking',label:'🥇 Ranking'},
    {id:'pronosticos',label:'👁 Pronósticos'},
    {id:'estadisticas',label:'📈 Estadísticas'},
    ...(isAdmin?[{id:'adminpanel',label:'⚙️ Admin'}]:[]),
  ]

  // ── PANTALLA DE ENTRADA ───────────────────────────────────
  if(!nickname||pinStep==='nick'||pinStep==='create'||pinStep==='verify') return(
    <div style={{fontFamily:'system-ui',background:'#0a0e1a',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>
      <div style={{background:'#0d1b2a',border:'2px solid #1565c0',borderRadius:20,padding:36,width:300,textAlign:'center',boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
        <div style={{fontSize:40,marginBottom:8}}>🏆</div>
        <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>Quiniela Maldonado-González 2026</div>

        {pinStep==='nick'&&<>
          <div style={{fontSize:13,color:'#90caf9',marginBottom:24}}>Introduce tu nombre para entrar</div>
          <input value={nickInput} onChange={e=>setNickInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&nickInput.trim()&&handleNickSubmit()}
            placeholder="Tu nombre o apodo"
            style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'2px solid #37474f',background:'#1e2d3d',color:'#fff',fontSize:16,textAlign:'center',boxSizing:'border-box',marginBottom:14}}/>
          <button onClick={handleNickSubmit}
            style={{width:'100%',background:'#1565c0',border:'none',borderRadius:10,padding:12,color:'#fff',fontWeight:800,fontSize:16,cursor:'pointer'}}>
            ¡Entrar! ⚽
          </button>
        </>}

        {pinStep==='create'&&<>
          <div style={{fontSize:13,color:'#90caf9',marginBottom:8}}>Hola <b>{nickname}</b> 👋</div>
          <div style={{fontSize:12,color:'#546e7a',marginBottom:20}}>Primera vez aquí. Crea un PIN de 4 dígitos para proteger tu quiniela.</div>
          <input type="password" maxLength={4} value={pinInput} onChange={e=>setPinInput(e.target.value)}
            placeholder="PIN de 4 dígitos"
            style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'2px solid #37474f',background:'#1e2d3d',color:'#fff',fontSize:20,textAlign:'center',boxSizing:'border-box',marginBottom:10,letterSpacing:8}}/>
          <input type="password" maxLength={4} value={pinConfirm} onChange={e=>setPinConfirm(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleCreatePin()}
            placeholder="Confirmar PIN"
            style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'2px solid #37474f',background:'#1e2d3d',color:'#fff',fontSize:20,textAlign:'center',boxSizing:'border-box',marginBottom:14,letterSpacing:8}}/>
          {pinErrorMsg&&<div style={{color:'#e53935',fontSize:12,marginBottom:10}}>{pinErrorMsg}</div>}
          <button onClick={handleCreatePin}
            style={{width:'100%',background:'#1b5e20',border:'none',borderRadius:10,padding:12,color:'#fff',fontWeight:800,fontSize:16,cursor:'pointer'}}>
            Crear PIN 🔐
          </button>
        </>}

        {pinStep==='verify'&&<>
          <div style={{fontSize:13,color:'#90caf9',marginBottom:8}}>Bienvenido de vuelta, <b>{nickname}</b> 👋</div>
          <div style={{fontSize:12,color:'#546e7a',marginBottom:20}}>Introduce tu PIN para acceder a tu quiniela.</div>
          <input type="password" maxLength={4} value={pinAuth} onChange={e=>setPinAuth(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleVerifyPin()}
            placeholder="Tu PIN"
            style={{width:'100%',padding:'10px 12px',borderRadius:8,border:`2px solid ${pinErrorMsg?'#e53935':'#37474f'}`,background:'#1e2d3d',color:'#fff',fontSize:20,textAlign:'center',boxSizing:'border-box',marginBottom:14,letterSpacing:8}}/>
          {pinErrorMsg&&<div style={{color:'#e53935',fontSize:12,marginBottom:10}}>{pinErrorMsg}</div>}
          <button onClick={handleVerifyPin}
            style={{width:'100%',background:'#1565c0',border:'none',borderRadius:10,padding:12,color:'#fff',fontWeight:800,fontSize:16,cursor:'pointer'}}>
            Entrar 🔐
          </button>
          <button onClick={()=>{setNickname('');setPinStep('nick');setPinErrorMsg('');setPinAuth('')}}
            style={{width:'100%',background:'transparent',border:'none',color:'#546e7a',fontSize:12,cursor:'pointer',marginTop:8}}>
            ← Cambiar nombre
          </button>
        </>}
      </div>
    </div>
  )

  // ── UI PRINCIPAL ──────────────────────────────────────────
  return(
    <div style={{fontFamily:'system-ui,sans-serif',background:'#0a0e1a',minHeight:'100vh',color:'#e8eaf6'}}>

      {/* MODAL CAMBIAR PIN */}
      {showChangePin&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#0d1b2a',border:'2px solid #1565c0',borderRadius:16,padding:28,width:280,textAlign:'center'}}>
            <div style={{fontSize:20,fontWeight:800,marginBottom:16}}>🔑 Cambiar PIN</div>
            <input type="password" maxLength={4} value={changePinCurrent} onChange={e=>setChangePinCurrent(e.target.value)}
              placeholder="PIN actual"
              style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'2px solid #37474f',background:'#1e2d3d',color:'#fff',fontSize:20,textAlign:'center',boxSizing:'border-box',marginBottom:10,letterSpacing:8}}/>
            <input type="password" maxLength={4} value={changePinNew} onChange={e=>setChangePinNew(e.target.value)}
              placeholder="Nuevo PIN"
              style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'2px solid #37474f',background:'#1e2d3d',color:'#fff',fontSize:20,textAlign:'center',boxSizing:'border-box',marginBottom:10,letterSpacing:8}}/>
            <input type="password" maxLength={4} value={changePinConfirm} onChange={e=>setChangePinConfirm(e.target.value)}
              placeholder="Confirmar nuevo PIN"
              style={{width:'100%',padding:'10px 12px',borderRadius:8,border:'2px solid #37474f',background:'#1e2d3d',color:'#fff',fontSize:20,textAlign:'center',boxSizing:'border-box',marginBottom:14,letterSpacing:8}}/>
            {changePinMsg&&<div style={{fontSize:12,marginBottom:10,color:changePinMsg.startsWith('✅')?'#69f0ae':'#e53935'}}>{changePinMsg}</div>}
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{setShowChangePin(false);setChangePinMsg('');setChangePinCurrent('');setChangePinNew('');setChangePinConfirm('')}}
                style={{flex:1,padding:10,borderRadius:8,border:'none',background:'#263238',color:'#90a4ae',cursor:'pointer',fontWeight:700}}>Cancelar</button>
              <button onClick={handleChangePin}
                style={{flex:1,padding:10,borderRadius:8,border:'none',background:'#1565c0',color:'#fff',cursor:'pointer',fontWeight:700}}>Cambiar</button>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLogin&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#0d1b2a',border:'2px solid #1565c0',borderRadius:16,padding:28,width:280,textAlign:'center'}}>
            <div style={{fontSize:20,fontWeight:800,marginBottom:16}}>🔐 Administrador</div>
            <input type="password" value={pin} onChange={e=>setPin(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&tryLogin()} placeholder="PIN"
              style={{width:'100%',padding:'10px 12px',borderRadius:8,border:`2px solid ${adminPinError?'#e53935':'#37474f'}`,background:'#1e2d3d',color:'#fff',fontSize:16,textAlign:'center',boxSizing:'border-box'}}/>
            {adminPinError&&<div style={{color:'#e53935',fontSize:12,marginTop:6}}>PIN incorrecto</div>}
            <div style={{display:'flex',gap:8,marginTop:14}}>
              <button onClick={()=>{setShowLogin(false);setAdminPinError(false);setPin('')}}
                style={{flex:1,padding:10,borderRadius:8,border:'none',background:'#263238',color:'#90a4ae',cursor:'pointer',fontWeight:700}}>Cancelar</button>
              <button onClick={tryLogin}
                style={{flex:1,padding:10,borderRadius:8,border:'none',background:'#1565c0',color:'#fff',cursor:'pointer',fontWeight:700}}>Entrar</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:'linear-gradient(135deg,#1a237e,#283593,#1565c0)',padding:'14px 16px 0',textAlign:'center'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',maxWidth:900,margin:'0 auto'}}>
          <div style={{fontSize:13,color:'#90caf9',paddingTop:6}}>
            👤 {nickname}
            <button onClick={()=>setShowChangePin(true)}
              style={{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:10,padding:'2px 8px',color:'#90caf9',cursor:'pointer',fontSize:10,marginLeft:6}}>
              🔑 PIN
            </button>
          </div>
          <div>
            <div style={{fontSize:24,fontWeight:800}}>🏆 Quiniela Maldonado-González 2026</div>
            <div style={{fontSize:11,color:'#90caf9',marginBottom:6}}>EE.UU. · Canadá · México • 11 Jun – 19 Jul</div>
          </div>
          <div style={{textAlign:'right',paddingTop:4}}>
            {isAdmin
              ?<button onClick={()=>setIsAdmin(false)} style={{background:'#b71c1c',border:'none',borderRadius:20,padding:'5px 10px',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:11}}>🔓 Admin ✕</button>
              :<button onClick={()=>setShowLogin(true)} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:20,padding:'5px 10px',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:11}}>🔐 Admin</button>
            }
          </div>
        </div>

        <div style={{maxWidth:900,margin:'0 auto 6px',display:'flex',justifyContent:'center',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {isAdmin&&<button onClick={fetchRealScores} disabled={aiLoading}
            style={{background:aiLoading?'#37474f':'#f57f17',border:'none',borderRadius:20,padding:'6px 16px',color:'#fff',fontWeight:700,cursor:aiLoading?'not-allowed':'pointer',fontSize:12}}>
            {aiLoading?'⏳ Buscando...':'🔄 Actualizar en vivo'}
          </button>}
          {saving&&<span style={{fontSize:11,color:'#a5d6a7'}}>💾 Guardando...</span>}
          {isLocked&&<span style={{fontSize:11,background:'#b71c1c',borderRadius:20,padding:'3px 10px',fontWeight:700}}>🔒 Torneo en curso</span>}
          {isAdmin&&<span style={{fontSize:11,background:'#1b5e20',borderRadius:20,padding:'3px 10px',fontWeight:700}}>✅ Admin</span>}
        </div>
        {aiMsg&&<div style={{fontSize:12,color:'#a5d6a7',paddingBottom:6}}>{aiMsg}</div>}

        <div style={{display:'flex',justifyContent:'center',gap:3,flexWrap:'wrap',maxWidth:900,margin:'0 auto'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{background:tab===t.id?'#fff':'transparent',color:tab===t.id?'#1a237e':'#90caf9',
                border:'2px solid',borderColor:tab===t.id?'#fff':'#5c6bc0',
                borderRadius:'10px 10px 0 0',padding:'6px 12px',cursor:'pointer',fontWeight:700,fontSize:11}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:16,maxWidth:900,margin:'0 auto'}}>

        {/* SELECTOR GRUPO */}
        {['grupos','partidos','quiniela','pronosticos','adminpanel'].includes(tab)&&(
          <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:14,justifyContent:'center'}}>
            {Object.keys(GROUPS).map(g=>(
              <button key={g} onClick={()=>setActiveGroup(g)}
                style={{background:activeGroup===g?'#1565c0':'#1e2a3a',border:'2px solid',
                  borderColor:activeGroup===g?'#42a5f5':'#37474f',borderRadius:8,padding:'4px 11px',
                  color:activeGroup===g?'#fff':'#90caf9',cursor:'pointer',fontWeight:700,fontSize:12}}>
                Grupo {g}
              </button>
            ))}
          </div>
        )}

        {/* ── GRUPOS ── */}
        {tab==='grupos'&&(
          <div style={{background:'#0d1b2a',borderRadius:12,overflow:'hidden',border:'1px solid #1e3a5f'}}>
            <div style={{background:'#1565c0',padding:'10px 16px',fontWeight:700,fontSize:14}}>🏟 Grupo {activeGroup}</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'#0d2137',color:'#90caf9'}}>
                  {['#','Equipo','PJ','PG','PE','PP','GF','GC','DG','Pts'].map(h=>(
                    <th key={h} style={{padding:'7px 5px',textAlign:h==='Equipo'?'left':'center'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupStandings[activeGroup].map(([team,s],i)=>(
                  <tr key={team} style={{borderTop:'1px solid #1e3a5f',background:i<2?'rgba(21,101,192,0.18)':i===2?'rgba(255,183,0,0.07)':'transparent'}}>
                    <td style={{padding:'8px 5px',textAlign:'center',color:i===0?'#ffd600':i===1?'#90caf9':'#607d8b',fontWeight:700}}>{i+1}</td>
                    <td style={{padding:'8px 5px'}}>{F(team)}</td>
                    <td style={{textAlign:'center',padding:'8px 5px'}}>{s.pj}</td>
                    <td style={{textAlign:'center',padding:'8px 5px',color:'#81c784'}}>{s.pg}</td>
                    <td style={{textAlign:'center',padding:'8px 5px'}}>{s.pe}</td>
                    <td style={{textAlign:'center',padding:'8px 5px',color:'#e57373'}}>{s.pp}</td>
                    <td style={{textAlign:'center',padding:'8px 5px'}}>{s.gf}</td>
                    <td style={{textAlign:'center',padding:'8px 5px'}}>{s.gc}</td>
                    <td style={{textAlign:'center',padding:'8px 5px',color:s.gf-s.gc>=0?'#81c784':'#e57373'}}>{s.gf-s.gc>=0?'+':''}{s.gf-s.gc}</td>
                    <td style={{textAlign:'center',padding:'8px 5px',fontWeight:800,color:'#fff',fontSize:15}}>{s.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{padding:'6px 14px',fontSize:11,color:'#546e7a',borderTop:'1px solid #1e3a5f'}}>🟦 Clasificados · 🟡 Posible mejor tercero</div>
          </div>
        )}

        {/* ── PARTIDOS ── */}
        {tab==='partidos'&&isAdmin&&groupMs.map(m=>(
          <MatchRow key={m.id} m={m} onScore={updateMatchScore} locked={isLocked} isAdmin={isAdmin}/>
        ))}

        {/* ── ELIMINATORIAS ── */}
        {tab==='eliminatorias'&&PHASE_ORDER.map(phase=>{
          const ms=matches.filter(m=>m.phase===phase)
          return(
            <div key={phase} style={{marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:13,color:PHASE_COLORS[phase],borderLeft:`3px solid ${PHASE_COLORS[phase]}`,paddingLeft:10,marginBottom:8}}>
                {PHASE_LABELS[phase]}
              </div>
              {ms.map(m=>(
                <div key={m.id} style={{background:'#0d1b2a',borderRadius:10,padding:'10px 12px',border:'1px solid #1e3a5f',marginBottom:6,opacity:m.t1?1:0.4}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <div style={{flex:1,textAlign:'right'}}>
                      {isAdmin&&!isLocked
                        ?<input value={m.t1} onChange={e=>updateKnockoutTeam(m.id,'t1',e.target.value)} placeholder="Equipo 1"
                          style={{background:'#1e2d3d',border:'1px solid #37474f',borderRadius:6,color:'#fff',padding:'4px 8px',fontSize:12,width:120,textAlign:'right'}}/>
                        :<span style={{fontSize:13,fontWeight:600}}>{F(m.t1)||'—'}</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <ScoreInput val={m.s1} onChange={v=>updateMatchScore(m.id,'s1',v)} locked={isLocked}/>
                      <span style={{color:'#546e7a',fontWeight:700}}>–</span>
                      <ScoreInput val={m.s2} onChange={v=>updateMatchScore(m.id,'s2',v)} locked={isLocked}/>
                    </div>
                    <div style={{flex:1,textAlign:'left'}}>
                      {isAdmin&&!isLocked
                        ?<input value={m.t2} onChange={e=>updateKnockoutTeam(m.id,'t2',e.target.value)} placeholder="Equipo 2"
                          style={{background:'#1e2d3d',border:'1px solid #37474f',borderRadius:6,color:'#fff',padding:'4px 8px',fontSize:12,width:120}}/>
                        :<span style={{fontSize:13,fontWeight:600}}>{F(m.t2)||'—'}</span>}
                    </div>
                  </div>
                  {m.s1!==''&&m.s2!==''&&parseInt(m.s1)===parseInt(m.s2)&&(
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:6}}>
                      <span style={{fontSize:11,color:'#ff7043'}}>Penaltis:</span>
                      <ScoreInput val={m.pen1} onChange={v=>updateMatchScore(m.id,'pen1',v)} locked={isLocked} w={36} color='#ff8a65'/>
                      <span style={{color:'#546e7a'}}>–</span>
                      <ScoreInput val={m.pen2} onChange={v=>updateMatchScore(m.id,'pen2',v)} locked={isLocked} w={36} color='#ff8a65'/>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}

        {/* ── BRACKET ── */}
        {tab==='bracket'&&(
          <div style={{overflowX:'auto',paddingBottom:12}}>
            <div style={{display:'flex',gap:10,minWidth:1100,alignItems:'flex-start'}}>
              {PHASE_ORDER.filter(p=>p!=='tp').map(phase=>(
                <div key={phase} style={{minWidth:165,flex:'0 0 auto'}}>
                  <div style={{textAlign:'center',fontWeight:700,fontSize:11,color:PHASE_COLORS[phase],background:'rgba(0,0,0,0.3)',borderRadius:8,padding:'4px 8px',marginBottom:8}}>
                    {PHASE_LABELS[phase]}
                  </div>
                  {matches.filter(m=>m.phase===phase).map(m=>(
                    <div key={m.id} style={{background:'#0d1b2a',border:'1px solid #1e3a5f',borderRadius:8,padding:'8px 10px',marginBottom:8,fontSize:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                        <span style={{color:'#cfd8dc'}}>{F(m.t1)}</span>
                        <span style={{fontWeight:800,color:'#fff'}}>{m.s1}</span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between'}}>
                        <span style={{color:'#cfd8dc'}}>{F(m.t2)}</span>
                        <span style={{fontWeight:800,color:'#fff'}}>{m.s2}</span>
                      </div>
                      {(m.pen1||m.pen2)&&<div style={{fontSize:10,color:'#ff7043',textAlign:'right'}}>Pen {m.pen1}–{m.pen2}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {(()=>{
              const f=matches.find(m=>m.phase==='final')
              if(!f||(!f.s1&&!f.s2)) return null
              const g1=parseInt(f.s1),g2=parseInt(f.s2)
              let champ=''
              if(!isNaN(g1)&&!isNaN(g2)){
                if(g1>g2) champ=f.t1
                else if(g2>g1) champ=f.t2
                else if(f.pen1&&f.pen2) champ=parseInt(f.pen1)>parseInt(f.pen2)?f.t1:f.t2
              }
              if(!champ) return null
              return(
                <div style={{textAlign:'center',marginTop:20,background:'linear-gradient(135deg,#f57f17,#f9a825)',borderRadius:16,padding:'16px 24px'}}>
                  <div style={{fontSize:28}}>🏆</div>
                  <div style={{fontWeight:900,fontSize:18,color:'#1a1a1a'}}>¡CAMPEÓN DEL MUNDO!</div>
                  <div style={{fontWeight:900,fontSize:26,color:'#1a1a1a'}}>{F(champ)}</div>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── QUINIELA ── */}
        {tab==='quiniela'&&(
          <div>
            {tournamentStarted&&!isAdmin&&(
              <div style={{background:'#b71c1c',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#ffcdd2',marginBottom:12}}>
                🔒 La quiniela está cerrada. El torneo ya ha comenzado.
              </div>
            )}
            {!tournamentStarted&&(
              <div style={{background:'#1a2744',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#90caf9',marginBottom:12}}>
                🎯 Tus pronósticos se guardan automáticamente. Cierra el <b>11 de junio</b>.<br/>
                +3 pts resultado exacto · +1 pt ganador/empate correcto
              </div>
            )}
            {groupMs.map(m=>{
              const q=quiniela[m.id]||{s1:'',s2:''}
              const hasReal=m.s1!==''&&m.s2!==''
              let badge=null
              if(hasReal&&q.s1!==''&&q.s2!==''){
                const r1=parseInt(m.s1),r2=parseInt(m.s2),q1=parseInt(q.s1),q2=parseInt(q.s2)
                if(q1===r1&&q2===r2) badge=<span style={{color:'#69f0ae',fontWeight:700}}>✅ +3</span>
                else{const rR=r1>r2?'1':r1<r2?'2':'X',qR=q1>q2?'1':q1<q2?'2':'X'
                  badge=rR===qR?<span style={{color:'#ffeb3b',fontWeight:700}}>🟡 +1</span>:<span style={{color:'#ef5350',fontWeight:700}}>❌ +0</span>}
              }
              return(
                <div key={m.id} style={{background:'#0d1b2a',borderRadius:10,padding:'10px 12px',border:'1px solid #1e3a5f',marginBottom:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <div style={{flex:1,textAlign:'right',fontSize:13,fontWeight:600}}>{F(m.t1)}</div>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <ScoreInput val={q.s1} onChange={v=>updateQuiniela(m.id,'s1',v)} locked={tournamentStarted} w={40} color='#ce93d8'/>
                      <span style={{color:'#546e7a'}}>–</span>
                      <ScoreInput val={q.s2} onChange={v=>updateQuiniela(m.id,'s2',v)} locked={tournamentStarted} w={40} color='#ce93d8'/>
                    </div>
                    <div style={{flex:1,textAlign:'left',fontSize:13,fontWeight:600}}>{F(m.t2)}</div>
                  </div>
                  {hasReal&&<div style={{textAlign:'center',marginTop:4,fontSize:11,color:'#78909c'}}>Real: {m.s1}–{m.s2} {badge}</div>}
                </div>
              )
            })}
          </div>
        )}

        {/* ── RANKING ── */}
        {tab==='ranking'&&(
          <div style={{background:'#0d1b2a',borderRadius:12,overflow:'hidden',border:'1px solid #1e3a5f'}}>
            <div style={{background:'linear-gradient(90deg,#f57f17,#f9a825)',padding:'10px 16px',fontWeight:800,fontSize:14,color:'#1a1a1a'}}>
              🥇 Clasificación de la Quiniela
            </div>
            {ranking.length===0&&(
              <div style={{padding:20,textAlign:'center',color:'#546e7a',fontSize:13}}>Aún no hay participantes con pronósticos.</div>
            )}
            {ranking.map(({nick,pts},i)=>(
              <div key={nick} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderTop:'1px solid #1e3a5f',background:nick===nickname?'rgba(21,101,192,0.2)':'transparent'}}>
                <span style={{fontWeight:800,fontSize:18,width:28,textAlign:'center',color:i===0?'#ffd600':i===1?'#b0bec5':i===2?'#ff8a65':'#546e7a'}}>
                  {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                </span>
                <span style={{flex:1,fontWeight:nick===nickname?700:400}}>{nick}{nick===nickname&&' (tú)'}</span>
                <span style={{fontWeight:800,fontSize:18,color:'#fff'}}>{pts} <span style={{fontSize:12,color:'#546e7a'}}>pts</span></span>
              </div>
            ))}
          </div>
        )}

        {/* ── PRONÓSTICOS ── */}
        {tab==='pronosticos'&&(
          <div>
            {allNicknames.length===0?(
              <div style={{textAlign:'center',color:'#546e7a',padding:30,fontSize:13}}>Aún no hay participantes con pronósticos.</div>
            ):(
              <div>
                <div style={{display:'flex',gap:8,marginBottom:16,justifyContent:'center'}}>
                  {[{id:'tabla',label:'📋 Tabla comparativa'},{id:'perfil',label:'👤 Perfil individual'}].map(v=>(
                    <button key={v.id} onClick={()=>setPronView(v.id)}
                      style={{background:pronView===v.id?'#1565c0':'#1e2a3a',border:'2px solid',borderColor:pronView===v.id?'#42a5f5':'#37474f',borderRadius:8,padding:'6px 16px',color:pronView===v.id?'#fff':'#90caf9',cursor:'pointer',fontWeight:700,fontSize:12}}>
                      {v.label}
                    </button>
                  ))}
                </div>

                {pronView==='tabla'&&(
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:Math.max(400,allNicknames.length*55)}}>
                      <thead>
                        <tr style={{background:'#0d2137',color:'#90caf9'}}>
                          <th style={{padding:'8px 10px',textAlign:'left',minWidth:120}}>Partido</th>
                          {allNicknames.map(nick=>(
                            <th key={nick} style={{padding:'4px 2px',textAlign:'center',minWidth:50,color:nick===nickname?'#42a5f5':'#90caf9'}}>
                              {nick===nickname?'⭐ '+nick:nick}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {groupMs.map(m=>(
                          <tr key={m.id} style={{borderTop:'1px solid #1e3a5f',background:'#0d1b2a'}}>
                            <td style={{padding:'8px 10px',color:'#cfd8dc'}}>
                              <div style={{fontSize:11}}>{FLAGS[m.t1]||'🏳'} {m.t1}</div>
                              <div style={{fontSize:11}}>{FLAGS[m.t2]||'🏳'} {m.t2}</div>
                              {m.s1!==''&&m.s2!==''&&<div style={{fontSize:10,color:'#546e7a',marginTop:2}}>Real: {m.s1}–{m.s2}</div>}
                            </td>
                            {allNicknames.map(nick=>{
                              const q=getQ(nick,m.id)
                              const badge=getBadge(m,q)
                              return(
                                <td key={nick} style={{padding:'8px 6px',textAlign:'center',background:nick===nickname?'rgba(21,101,192,0.1)':'transparent'}}>
                                  {q&&q.s1!==''&&q.s2!==''?(
                                    <div>
                                      <div style={{fontWeight:700,color:'#fff'}}>{q.s1}–{q.s2}</div>
                                      {badge&&<div style={{fontSize:11,color:badge.color}}>{badge.label} +{badge.pts}</div>}
                                    </div>
                                  ):<span style={{color:'#37474f'}}>—</span>}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {pronView==='perfil'&&(
                  <div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:16,justifyContent:'center'}}>
                      {allNicknames.map(nick=>(
                        <button key={nick} onClick={()=>setSelectedNick(nick)}
                          style={{background:selectedNick===nick?'#6a1b9a':'#1e2a3a',border:'2px solid',borderColor:selectedNick===nick?'#ce93d8':'#37474f',borderRadius:20,padding:'5px 14px',color:selectedNick===nick?'#fff':'#90caf9',cursor:'pointer',fontWeight:700,fontSize:12}}>
                          {nick===nickname?'⭐ '+nick:nick}
                        </button>
                      ))}
                    </div>
                    {selectedNick&&(()=>{
                      let total=0,exactos=0,parciales=0,fallos=0
                      matches.forEach(m=>{
                        const q=getQ(selectedNick,m.id)
                        const badge=getBadge(m,q)
                        if(!badge) return
                        total++
                        if(badge.pts===3) exactos++
                        else if(badge.pts===1) parciales++
                        else fallos++
                      })
                      const pts=exactos*3+parciales
                      return(
                        <div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
                            {[{label:'Puntos',val:pts,color:'#fff',bg:'#1565c0'},{label:'Exactos',val:exactos,color:'#69f0ae',bg:'#1b5e20'},{label:'Parciales',val:parciales,color:'#ffeb3b',bg:'#f57f17'},{label:'Fallos',val:fallos,color:'#ef9a9a',bg:'#b71c1c'}].map(s=>(
                              <div key={s.label} style={{background:s.bg,borderRadius:10,padding:'10px 8px',textAlign:'center'}}>
                                <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.val}</div>
                                <div style={{fontSize:11,color:'rgba(255,255,255,0.8)'}}>{s.label}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:12,justifyContent:'center'}}>
                            {Object.keys(GROUPS).map(g=>(
                              <button key={g} onClick={()=>setActiveGroup(g)}
                                style={{background:activeGroup===g?'#6a1b9a':'#1e2a3a',border:'2px solid',borderColor:activeGroup===g?'#ce93d8':'#37474f',borderRadius:8,padding:'4px 11px',color:activeGroup===g?'#fff':'#90caf9',cursor:'pointer',fontWeight:700,fontSize:12}}>
                                Grupo {g}
                              </button>
                            ))}
                          </div>
                          {groupMs.map(m=>{
                            const q=getQ(selectedNick,m.id)
                            const badge=getBadge(m,q)
                            return(
                              <div key={m.id} style={{background:'#0d1b2a',borderRadius:10,padding:'10px 12px',border:'1px solid #1e3a5f',marginBottom:6}}>
                                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                                  <div style={{flex:1,textAlign:'right',fontSize:13,fontWeight:600}}>{F(m.t1)}</div>
                                  <div style={{textAlign:'center',minWidth:80}}>
                                    {q&&q.s1!==''&&q.s2!==''?(
                                      <div>
                                        <div style={{fontWeight:800,fontSize:16,color:'#ce93d8'}}>{q.s1}–{q.s2}</div>
                                        {badge&&<div style={{fontSize:11,color:badge.color}}>{badge.label} +{badge.pts} pts</div>}
                                        {m.s1!==''&&m.s2!==''&&<div style={{fontSize:10,color:'#546e7a'}}>Real: {m.s1}–{m.s2}</div>}
                                      </div>
                                    ):<span style={{color:'#37474f',fontSize:13}}>Sin pronóstico</span>}
                                  </div>
                                  <div style={{flex:1,textAlign:'left',fontSize:13,fontWeight:600}}>{F(m.t2)}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ESTADÍSTICAS ── */}
        {tab==='estadisticas'&&(
          <div>
            {allNicknames.length===0?(
              <div style={{textAlign:'center',color:'#546e7a',padding:30,fontSize:13}}>Aún no hay participantes.</div>
            ):(
              <div>
                <div style={{background:'#0d1b2a',borderRadius:12,padding:16,border:'1px solid #1e3a5f',marginBottom:16}}>
                  <div style={{fontWeight:800,fontSize:13,color:'#42a5f5',marginBottom:12}}>📊 Puntos actuales vs Máximo posible</div>
                  {playerStats.map(({nick,current,max})=>(
                    <div key={nick} style={{marginBottom:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                        <span style={{color:playerColor(nick),fontWeight:700}}>{nick===nickname?'⭐ '+nick:nick}</span>
                        <span style={{color:'#fff',fontWeight:800}}>{current} pts <span style={{color:'#546e7a',fontWeight:400}}>/ {max} max</span></span>
                      </div>
                      <div style={{background:'#1e2d3d',borderRadius:20,height:22,position:'relative',overflow:'hidden'}}>
                        <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${playerStats[0]?.max>0?(max/playerStats[0].max)*100:0}%`,background:'rgba(255,255,255,0.08)',borderRadius:20}}/>
                        <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${playerStats[0]?.max>0?(current/playerStats[0].max)*100:0}%`,background:`linear-gradient(90deg,${playerColor(nick)},${playerColor(nick)}99)`,borderRadius:20,transition:'width 0.5s'}}/>
                        <div style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',fontSize:10,color:'#546e7a'}}>+{max-current} posibles</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{background:'#0d1b2a',borderRadius:12,padding:16,border:'1px solid #1e3a5f',marginBottom:16}}>
                  <div style={{fontWeight:800,fontSize:13,color:'#ffca28',marginBottom:4}}>🎲 Probabilidad de ganar la quiniela</div>
                  <div style={{fontSize:11,color:'#546e7a',marginBottom:12}}>Basada en puntos máximos alcanzables</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginBottom:12}}>
                    {playerStats.map(({nick})=>(
                      <div key={nick} style={{textAlign:'center',background:'#1e2a3a',borderRadius:10,padding:'10px 14px',minWidth:80}}>
                        <div style={{fontSize:22,fontWeight:900,color:playerColor(nick)}}>{winProb[nick]}%</div>
                        <div style={{fontSize:11,color:'#90caf9',marginTop:2}}>{nick===nickname?'⭐ '+nick:nick}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',borderRadius:20,overflow:'hidden',height:28}}>
                    {playerStats.map(({nick})=>winProb[nick]>0&&(
                      <div key={nick} style={{width:`${winProb[nick]}%`,background:playerColor(nick),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#000',transition:'width 0.5s'}}>
                        {winProb[nick]>8?`${winProb[nick]}%`:''}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{background:'#0d1b2a',borderRadius:12,padding:16,border:'1px solid #1e3a5f',marginBottom:16}}>
                  <div style={{fontWeight:800,fontSize:13,color:'#69f0ae',marginBottom:12}}>📈 Progreso partido a partido</div>
                  {progressData.length===0?(
                    <div style={{textAlign:'center',color:'#546e7a',fontSize:12,padding:20}}>Disponible cuando haya resultados reales</div>
                  ):(
                    <div style={{overflowX:'auto'}}>
                      <div style={{minWidth:Math.max(300,progressData.length*60),position:'relative'}}>
                        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
                          {allNicknames.map(nick=>(
                            <div key={nick} style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}>
                              <div style={{width:12,height:12,borderRadius:'50%',background:playerColor(nick)}}/>
                              <span style={{color:'#cfd8dc'}}>{nick===nickname?'⭐ '+nick:nick}</span>
                            </div>
                          ))}
                        </div>
                        {(()=>{
                          const W=Math.max(300,progressData.length*60),H=160
                          const PAD={t:10,r:20,b:30,l:30}
                          const maxPts=Math.max(1,...allNicknames.map(nick=>Math.max(...progressData.map(d=>d[nick]||0))))
                          const x=i=>PAD.l+(i/(progressData.length-1||1))*(W-PAD.l-PAD.r)
                          const y=v=>PAD.t+(1-v/maxPts)*(H-PAD.t-PAD.b)
                          return(
                            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible'}}>
                              {[0,25,50,75,100].map(pct=>{
                                const yy=PAD.t+(1-pct/100)*(H-PAD.t-PAD.b)
                                return(
                                  <g key={pct}>
                                    <line x1={PAD.l} x2={W-PAD.r} y1={yy} y2={yy} stroke="#1e3a5f" strokeWidth="1"/>
                                    <text x={PAD.l-4} y={yy+4} fontSize="9" fill="#546e7a" textAnchor="end">{Math.round(maxPts*pct/100)}</text>
                                  </g>
                                )
                              })}
                              {allNicknames.map(nick=>{
                                const pts=progressData.map(d=>d[nick]||0)
                                const path=pts.map((v,i)=>`${i===0?'M':'L'}${x(i)},${y(v)}`).join(' ')
                                return(
                                  <g key={nick}>
                                    <path d={path} fill="none" stroke={playerColor(nick)} strokeWidth="2.5" strokeLinejoin="round"/>
                                    {pts.map((v,i)=>(
                                      <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={playerColor(nick)} stroke="#0a0e1a" strokeWidth="1.5"/>
                                    ))}
                                  </g>
                                )
                              })}
                              {progressData.map((d,i)=>(
                                <text key={i} x={x(i)} y={H-PAD.b+14} fontSize="8" fill="#546e7a" textAnchor="middle"
                                  transform={`rotate(-30,${x(i)},${H-PAD.b+14})`}>P{i+1}</text>
                              ))}
                            </svg>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ADMIN PANEL ── */}
        {tab==='adminpanel'&&isAdmin&&(
          <div>
            <div style={{background:'#0d1b2a',borderRadius:12,padding:16,border:'1px solid #1e3a5f',marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:14,color:'#f57f17',marginBottom:8}}>📥 Importar quiniela desde CSV</div>
              <div style={{fontSize:12,color:'#546e7a',marginBottom:12}}>
                Formato: <code style={{color:'#90caf9'}}>nickname,grupo,equipo1,equipo2,goles1,goles2</code>
              </div>
              <input type="file" accept=".csv" onChange={e=>e.target.files[0]&&importCSV(e.target.files[0])} style={{display:'none'}} id="csvInput"/>
              <label htmlFor="csvInput"
                style={{display:'inline-block',background:'#f57f17',border:'none',borderRadius:10,padding:'10px 20px',color:'#fff',fontWeight:700,cursor:'pointer',fontSize:13}}>
                {csvLoading?'⏳ Importando...':'📂 Seleccionar archivo CSV'}
              </label>
              {csvMsg&&<div style={{marginTop:10,fontSize:13,color:csvMsg.startsWith('✅')?'#69f0ae':'#ffeb3b'}}>{csvMsg}</div>}
            </div>

            <div style={{background:'#0d1b2a',borderRadius:12,padding:16,border:'1px solid #1e3a5f'}}>
              <div style={{fontWeight:800,fontSize:14,color:'#42a5f5',marginBottom:12}}>✏️ Editar quiniela de un jugador</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
                {allNicknames.map(nick=>(
                  <button key={nick} onClick={()=>setAdminSelectedNick(nick)}
                    style={{background:adminSelectedNick===nick?'#1565c0':'#1e2a3a',border:'2px solid',borderColor:adminSelectedNick===nick?'#42a5f5':'#37474f',borderRadius:20,padding:'5px 14px',color:adminSelectedNick===nick?'#fff':'#90caf9',cursor:'pointer',fontWeight:700,fontSize:12}}>
                    {nick}
                  </button>
                ))}
                <input placeholder="+ Nuevo nickname"
                  onKeyDown={e=>{if(e.key==='Enter'&&e.target.value.trim()){setAdminSelectedNick(e.target.value.trim());e.target.value=''}}}
                  style={{background:'#1e2d3d',border:'2px solid #37474f',borderRadius:20,padding:'5px 14px',color:'#fff',fontSize:12,width:140}}/>
              </div>
              {adminSelectedNick&&(
                <div>
                  <div style={{fontSize:13,color:'#90caf9',marginBottom:10}}>
                    Editando: <b style={{color:'#fff'}}>{adminSelectedNick}</b>
                  </div>
                  {groupMs.map(m=>{
                    const q=allQuinielas.find(r=>r.nickname===adminSelectedNick&&r.match_id===m.id)||{s1:'',s2:''}
                    return(
                      <div key={m.id} style={{background:'#0d2137',borderRadius:10,padding:'10px 12px',border:'1px solid #1e3a5f',marginBottom:6}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                          <div style={{flex:1,textAlign:'right',fontSize:13,fontWeight:600}}>{F(m.t1)}</div>
                          <div style={{display:'flex',alignItems:'center',gap:4}}>
                            <ScoreInput val={q.s1} onChange={v=>saveAdminQuiniela(m.id,'s1',v)} locked={false} w={40} color='#ce93d8'/>
                            <span style={{color:'#546e7a'}}>–</span>
                            <ScoreInput val={q.s2} onChange={v=>saveAdminQuiniela(m.id,'s2',v)} locked={false} w={40} color='#ce93d8'/>
                          </div>
                          <div style={{flex:1,textAlign:'left',fontSize:13,fontWeight:600}}>{F(m.t2)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
