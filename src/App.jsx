import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './lib/supabase'
import { Cat, Search, Users, Sparkles, Trophy, Settings, Monitor, LogOut, Upload, Download, Play, RotateCcw, ImagePlus, Heart, CheckCircle2, MousePointer2, CircleHelp } from 'lucide-react'

const defaultSettings = { id: 1, target_taps: 100, success_message: 'เช็คอินครบ 100% แล้ว!', image_url: null, status: 'waiting', total_taps: 0 }
const fullName = s => `${s.prefix || ''}${s.first_name || ''} ${s.last_name || ''}`.trim()
const errorText = e => e?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'

function useGameData() {
  const [settings, setSettings] = useState(defaultSettings)
  const [students, setStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const refresh = useCallback(async () => {
    if (!supabase) return
    const [g, s, p] = await Promise.all([
      supabase.from('game_settings').select('*').eq('id', 1).single(),
      supabase.from('student_directory').select('id,prefix,first_name,last_name,tap_count').order('first_name'),
      supabase.from('active_player_directory').select('student_id,joined_at')
    ])
    if (g.data) setSettings(g.data)
    if (s.data) setStudents(s.data)
    if (p.data) setSessions(p.data)
  }, [])
  useEffect(() => {
    if (!supabase) return
    refresh()
    const channel = supabase.channel('pop-cat-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_settings' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_sessions' }, refresh)
      .subscribe()
    const timer = setInterval(refresh, 8000)
    return () => { clearInterval(timer); supabase.removeChannel(channel) }
  }, [refresh])
  return { settings, students, sessions, refresh }
}

function SetupNotice() {
  return <main className="setup-wrap"><div className="setup-card"><div className="brand-mark"><Cat size={30}/></div><h1>Pop Cat Check-in</h1><p>ยังไม่ได้เชื่อมต่อฐานข้อมูล Supabase</p><p className="muted">คัดลอกไฟล์ <code>.env.example</code> เป็น <code>.env</code> แล้วใส่ Project URL และ Publishable/anon key จาก Supabase จากนั้นรีสตาร์ตเว็บ</p><div className="setup-steps"><b>เริ่มต้นอย่างรวดเร็ว</b><ol><li>สร้างโปรเจกต์ Supabase</li><li>รันไฟล์ <code>supabase/schema.sql</code> ใน SQL Editor</li><li>ตั้งค่า <code>VITE_SUPABASE_URL</code> และ <code>VITE_SUPABASE_ANON_KEY</code></li></ol></div></div></main>
}

function Header({ subtitle, right }) {
  return <header className="topbar"><a href="/" className="brand"><span className="brand-icon"><Cat size={23}/></span><span>Pop Cat <b>Check-in</b><small>{subtitle}</small></span></a><div className="top-actions">{right}</div></header>
}

function Player({ settings, students, sessions, refresh }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [joined, setJoined] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(0)
  const flushTimer = useRef(null)
  const [pop, setPop] = useState(false)
  const [myTaps, setMyTaps] = useState(0)
  const directory = useMemo(() => students.filter(s => fullName(s).toLowerCase().includes(query.toLowerCase()) || (s.first_name+' '+s.last_name).toLowerCase().includes(query.toLowerCase())), [students, query])
  const activeSession = selected && sessions.some(s => s.student_id === selected.id)
  useEffect(() => {
    if (!selected || !activeSession) return
    setJoined(true)
    setMyTaps(Number(students.find(s => s.id === selected.id)?.tap_count || 0))
  }, [activeSession, selected, students])
  const join = async s => {
    if (!supabase) return
    setBusy(true); setNotice('')
    const { error } = await supabase.rpc('join_game', { p_student_id: s.id })
    setBusy(false)
    if (error) return setNotice(errorText(error))
    setSelected(s); setJoined(true); setNotice('เข้าร่วมสำเร็จ รอแอดมินเริ่มเกมได้เลย!')
    await refresh()
  }
  const flush = useCallback(async () => {
    if (!selected || pending.current < 1 || !supabase) return
    const amount = Math.min(25, pending.current)
    pending.current -= amount
    const { data, error } = await supabase.rpc('add_taps', { p_student_id: selected.id, p_amount: amount })
    if (error) { pending.current = 0; setNotice(errorText(error)); return }
    setMyTaps(Number(data?.player_taps || 0))
    await refresh()
    if (pending.current > 0) flushTimer.current = setTimeout(() => { flushTimer.current = null; flush() }, 250)
  }, [selected, refresh])
  useEffect(() => () => { if (flushTimer.current) clearTimeout(flushTimer.current) }, [])
  const tap = () => {
    if (settings.status !== 'playing' || !selected) return
    setPop(true); setTimeout(() => setPop(false), 180)
    setMyTaps(v => v + 1); pending.current += 1
    if (!flushTimer.current) flushTimer.current = setTimeout(() => { flushTimer.current = null; flush() }, 350)
  }
  if (!joined || !selected) return <><Header subtitle="PLAYER ZONE" right={<span className="online-pill"><span/> ระบบพร้อมใช้งาน</span>}/><main className="player-select"><div className="hero-copy"><div className="eyebrow"><Sparkles size={15}/> SCHOOL CHECK-IN GAME</div><h1>วันนี้ใครมาแล้ว<br/><span>ขอเสียงหน่อย!</span></h1><p>ค้นหาชื่อของตัวเอง แล้วเข้าร่วมภารกิจแตะหน้าจอไปพร้อมกัน</p><div className="search-box"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="พิมพ์ชื่อหรือนามสกุลของคุณ..." autoFocus/></div><div className="directory-heading"><b>รายชื่อผู้เข้าร่วม</b><span>{directory.length} รายชื่อ</span></div><div className="name-list">{directory.slice(0,80).map(s=><button key={s.id} className="name-option" onClick={()=>join(s)} disabled={busy}><span className="avatar">{(s.first_name||'?').slice(0,1)}</span><span>{fullName(s)}</span><span className="choose-label">เลือกฉัน <span>→</span></span></button>)}{directory.length===0&&<div className="empty-state">ไม่พบรายชื่อ ลองค้นหาอีกครั้ง</div>}{directory.length>80&&<p className="muted small">แสดง 80 รายชื่อแรก กรุณาพิมพ์ค้นหาให้เฉพาะเจาะจงขึ้น</p>}</div>{notice&&<p className="notice">{notice}</p>}</div><aside className="welcome-art"><div className="float float-one">✦</div><div className="float float-two">♡</div><div className="cat-blob"><div className="cat-ears"><i/><i/></div><div className="cat-face"><span className="eyes">• •</span><span className="nose">⌄</span><span className="mouth">ᴗ</span><span className="whiskers">〰</span></div><div className="cat-paws"><i/><i/></div></div><div className="speech-bubble">พร้อมแล้วใช่มั้ย? <span>ฅ^•ﻌ•^ฅ</span></div><div className="art-caption"><Heart size={15} fill="currentColor"/> แตะด้วยกัน สนุกด้วยกัน!</div></aside></main></>
  return <><Header subtitle="PLAYER ZONE" right={<button className="soft-btn" onClick={()=>{setSelected(null);setJoined(false);setNotice('')}}><LogOut size={16}/> ออกจากหน้าผู้เล่น</button>}/><main className="tap-screen"><div className="player-welcome"><span className="eyebrow"><CheckCircle2 size={15}/> เข้าร่วมแล้ว</span><h1>สวัสดี {selected.first_name}!</h1><p>{settings.status==='waiting'?'รอแอดมินเริ่มเกม แล้วมาแตะไปพร้อมกันนะ':settings.status==='completed'?'ภารกิจสำเร็จแล้ว เก่งมากทุกคน!':'พร้อมแล้วก็แตะเลย!'}</p></div><button className={`tap-character ${pop?'popping':''}`} onClick={tap} disabled={settings.status!=='playing'} aria-label="แตะเพื่อช่วยเพิ่มคะแนน">{settings.image_url?<img src={settings.image_url} alt="ตัวการ์ตูนประจำเกม"/>:<div className="cat-blob big-cat"><div className="cat-ears"><i/><i/></div><div className="cat-face"><span className="eyes">• •</span><span className="nose">⌄</span><span className="mouth">ᴗ</span><span className="whiskers">〰</span></div><div className="cat-paws"><i/><i/></div></div>}</button><div className="tap-instruction">{settings.status==='playing'?<><MousePointer2 size={17}/> ช่วยกันแตะหน้าจอ</>:settings.status==='completed'?<><Sparkles size={17}/> {settings.success_message}</>:<><span className="waiting-dot"/> รอแอดมินกดเริ่มเกม...</>}</div><div className="my-score"><span>จำนวนครั้งที่ช่วยแตะ</span><b>{myTaps.toLocaleString('th-TH')}</b><small>แตะได้เต็มที่ ช่วยกันให้ครบเป้าหมาย!</small></div></main></>
}

function Projector({ settings, students, sessions }) {
  const target = Math.max(1, Number(settings.target_taps || 100))
  const total = Math.min(target, Number(settings.total_taps || 0))
  const percent = Math.min(100, Math.round(total / target * 100))
  const joinedIds = new Set(sessions.map(s=>s.student_id))
  const leaderboard = [...students].filter(s=>Number(s.tap_count)>0).sort((a,b)=>Number(b.tap_count)-Number(a.tap_count)).slice(0,8)
  return <div className="projector">
    <div className="projector-top"><div className="brand projector-brand"><span className="brand-icon"><Cat size={23}/></span><span>Pop Cat <b>Check-in</b><small>LET'S POP TOGETHER!</small></span></div><div className="live-label"><span/> LIVE GAME</div><div className="joined-count"><Users size={19}/><b>{sessions.length}</b><span>คนเข้าร่วมแล้ว</span></div></div>
    {settings.status==='waiting'?<div className="waiting-projector"><div className="party-spark">✦</div><div className="cat-blob projector-cat"><div className="cat-ears"><i/><i/></div><div className="cat-face"><span className="eyes">• •</span><span className="nose">⌄</span><span className="mouth">ᴗ</span><span className="whiskers">〰</span></div><div className="cat-paws"><i/><i/></div></div><h1>พร้อมกันหรือยัง?</h1><p>รอเพื่อน ๆ เข้าร่วมกิจกรรมอยู่...</p><div className="waiting-stat"><Users size={20}/><b>{sessions.length}</b> / {students.length} คนเข้าร่วมแล้ว</div><div className="waiting-track"><span style={{width:`${students.length?Math.min(100,sessions.length/students.length*100):0}%`}}/></div><small>เปิดเว็บบนมือถือ เลือกชื่อ แล้วรอเริ่มเกมได้เลย</small></div>:<div className="game-board"><aside className="leaderboard"><h2><Trophy size={21}/> TOP POPPERS</h2><p>นักแตะมือไว</p>{leaderboard.length?leaderboard.map((s,i)=><div className="leader-row" key={s.id}><span className={`rank rank-${i+1}`}>{i+1}</span><span className="leader-name">{fullName(s)}</span><b>{Number(s.tap_count).toLocaleString('th-TH')}</b></div>):<div className="empty-leader">รอคะแนนแรก...</div>}</aside><section className="main-game"><div className="progress-label"><span>TEAM PROGRESS</span><b>{percent}%</b></div><div className="progress-track"><span style={{width:`${percent}%`}}/></div><div className={`projector-character ${settings.status==='completed'?'celebrate':''}`}><div className="character-glow"/>{settings.image_url?<img src={settings.image_url} alt="ตัวการ์ตูนประจำเกม" style={{clipPath:`inset(${100-percent}% 0 0 0)`}}/>:<div className="character-emoji" style={{opacity:Math.max(.12,percent/100),transform:`scale(${0.82+percent/550})`}}>🐱</div>}{settings.status==='completed'&&<div className="confetti-text">🎉 🎊 ✨ 🎉</div>}</div><div className="total-count"><b>{total.toLocaleString('th-TH')}</b><span> / {target.toLocaleString('th-TH')} TAPS</span></div>{settings.status==='completed'?<div className="success-banner"><Sparkles size={22}/><span>{settings.success_message}</span><Sparkles size={22}/></div>:<div className="game-cheer">แตะอีกนิดเดียว! ทุกคนช่วยกันได้ 💜</div>}<div className="footer-progress"><span><Users size={15}/> {sessions.length} คนร่วมเล่น</span><span><MousePointer2 size={15}/> {target-total} ครั้งที่เหลือ</span></div></section></div>}
    <div className="projector-footer"><span>PCSHS • SCHOOL ACTIVITY</span><span>แตะพร้อมกัน สนุกไปด้วยกัน <Heart size={13} fill="currentColor"/></span></div>
  </div>
}

function Admin({ settings, students, sessions, refresh }) {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [session,setSession] = useState(null)
  const [message,setMessage] = useState('')
  const [target,setTarget] = useState(String(settings.target_taps || 100))
  const [successText,setSuccessText] = useState(settings.success_message || 'เช็คอินครบ 100% แล้ว!')
  const [imageUrl,setImageUrl] = useState(settings.image_url || '')
  const [uploading,setUploading] = useState(false)
  const [importing,setImporting] = useState(false)
  const [busy,setBusy] = useState(false)
  const fileRef = useRef(null)
  useEffect(()=>{supabase?.auth.getSession().then(({data})=>setSession(data.session)); const {data}=supabase?.auth.onAuthStateChange((_e,s)=>setSession(s))||{data:null};return()=>data?.subscription?.unsubscribe()},[])
  useEffect(() => {
  setTarget(String(settings.target_taps || 100))
  setSuccessText(
    settings.success_message || 'เช็คอินครบ 100% แล้ว!'
  )

  // อัปเดตรูปจากฐานข้อมูลเมื่อมี URL เท่านั้น
  // ป้องกันการล้างรูปที่เพิ่งอัปโหลดแต่ยังไม่ได้บันทึก
  if (settings.image_url) {
    setImageUrl(settings.image_url)
  }
}, [
  settings.target_taps,
  settings.success_message,
  settings.image_url
])
  const login = async e => { e.preventDefault();setMessage('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setMessage(errorText(error));else setMessage('เข้าสู่ระบบแล้ว') }
  const logout = async()=>{await supabase.auth.signOut();setSession(null)}
  const downloadTemplate = () => {
    const ws=XLSX.utils.aoa_to_sheet([['คำนำหน้า','ชื่อ','นามสกุล','รหัสนักเรียน'],['เด็กชาย','ตัวอย่าง','ใจดี','12345'],['เด็กหญิง','ตัวอย่าง','รักเรียน','12346']])
    ws['!cols']=[{wch:16},{wch:20},{wch:22},{wch:18}]
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'รายชื่อนักเรียน');XLSX.writeFile(wb,'PopCat_Student_Template.xlsx')
  }
  const uploadImage = async e => {
    const file=e.target.files?.[0];if(!file)return
    if(file.type!=='image/png'){setMessage('กรุณาเลือกไฟล์ PNG เท่านั้น');return}
    if(file.size>5*1024*1024){setMessage('ไฟล์ต้องมีขนาดไม่เกิน 5 MB');return}
    setUploading(true);setMessage('')
    const path=`characters/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`
    const {error}=await supabase.storage.from('game-assets').upload(path,file,{contentType:'image/png',upsert:true})
    if(error){setMessage(errorText(error));setUploading(false);return}
    const {data}=supabase.storage.from('game-assets').getPublicUrl(path)
    setImageUrl(data.publicUrl);setUploading(false);setMessage('อัปโหลดรูปแล้ว กดเริ่มเกมเพื่อใช้รูปนี้')
  }
  const importExcel = async e => {
    const file=e.target.files?.[0];if(!file)return
    setImporting(true);setMessage('')
    try {
      const data=await file.arrayBuffer();const wb=XLSX.read(data);const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''})
      const normalize = r => {
        const obj={};for(const [k,v] of Object.entries(r)) obj[String(k).trim().toLowerCase().replace(/\s/g,'')]=String(v??'').trim()
        const get=(...keys)=>{for(const k of keys)if(obj[k]!==undefined)return obj[k];return ''}
        return {prefix:get('คำนำหน้า','prefix','คํานําหน้า'),first_name:get('ชื่อ','firstname','first_name'),last_name:get('นามสกุล','นามสุกล','lastname','last_name'),student_code:get('รหัสนักเรียน','รหัสประจำตัว','studentcode','student_code')}
      }
      const parsed=rows.map(normalize).filter(r=>r.first_name&&r.last_name&&r.student_code)
      if(!parsed.length)throw new Error('ไม่พบข้อมูลที่ครบถ้วน ตรวจสอบหัวตารางในไฟล์ Excel')
      const chunk=100
      for(let i=0;i<parsed.length;i+=chunk){
        const {error}=await supabase.from('students').upsert(parsed.slice(i,i+chunk),{onConflict:'student_code'})
        if(error)throw error
      }
      setMessage(`นำเข้ารายชื่อสำเร็จ ${parsed.length} รายชื่อ (รหัสนักเรียนซ้ำจะอัปเดตข้อมูลเดิม)`);await refresh()
    } catch(err){setMessage(errorText(err))} finally{setImporting(false);e.target.value=''}
  }
  const startGame = async e => {
    e.preventDefault();setBusy(true);setMessage('')
    const n=Number(target)
    if(!Number.isInteger(n)||n<1){setMessage('เป้าหมายต้องเป็นจำนวนเต็มมากกว่า 0');setBusy(false);return}
    const {error}=await supabase.rpc('admin_start_game',{p_target:n,p_message:successText,p_image_url:imageUrl||null,p_reset:true})
    if(error)setMessage(errorText(error));else{setMessage('เริ่มเกมแล้ว! หน้าจอทุกเครื่องจะอัปเดตอัตโนมัติ');await refresh()}
    setBusy(false)
  }
  const resetGame = async()=>{if(!confirm('ต้องการรีเซ็ตคะแนนและรายชื่อผู้เข้าร่วมทั้งหมดหรือไม่?'))return;const {error}=await supabase.rpc('admin_reset_game');setMessage(error?errorText(error):'รีเซ็ตเกมแล้ว');await refresh()}
  if(!session) return <><Header subtitle="ADMIN CONSOLE"/><main className="login-wrap"><form className="login-card" onSubmit={login}><div className="login-icon"><Settings size={27}/></div><span className="eyebrow">ADMIN ACCESS</span><h1>หลังบ้านแอดมิน</h1><p>เข้าสู่ระบบเพื่อจัดการรายชื่อและควบคุมเกม</p><label>อีเมลแอดมิน<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com" required/></label><label>รหัสผ่าน<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="รหัสผ่าน Supabase Auth" required/></label><button className="primary-btn wide" type="submit">เข้าสู่ระบบ <span>→</span></button>{message&&<p className="notice">{message}</p>}<small>สร้างบัญชีแอดมินใน Supabase Dashboard → Authentication → Users ก่อนเข้าใช้งาน</small></form></main></>
  return <><Header subtitle="ADMIN CONSOLE" right={<><a className="soft-btn" href="/projector" target="_blank" rel="noreferrer"><Monitor size={16}/> เปิดจอโปรเจกเตอร์</a><button className="soft-btn" onClick={logout}><LogOut size={16}/> ออกจากระบบ</button></>}/><main className="admin-page"><div className="admin-heading"><div><span className="eyebrow"><Settings size={15}/> CONTROL ROOM</span><h1>จัดการเกมของคุณ</h1><p>ตั้งค่ากิจกรรม ดูสถานะ และควบคุมการเล่นได้จากที่นี่</p></div><span className={`status-chip ${settings.status}`}>{settings.status==='waiting'?'● กำลังรอ':settings.status==='playing'?'● กำลังเล่น':'✓ จบเกมแล้ว'}</span></div><div className="stats-grid"><div className="stat-card"><span><Users size={18}/> ผู้เข้าร่วมแล้ว</span><b>{sessions.length}<small> / {students.length} คน</small></b><div className="mini-track"><span style={{width:`${students.length?Math.min(100,sessions.length/students.length*100):0}%`}}/></div></div><div className="stat-card"><span><MousePointer2 size={18}/> จำนวนแตะรวม</span><b>{Number(settings.total_taps||0).toLocaleString('th-TH')}</b><small>เป้าหมาย {Number(settings.target_taps||100).toLocaleString('th-TH')} ครั้ง</small></div><div className="stat-card"><span><Trophy size={18}/> อันดับ 1</span><b className="top-score">{students.slice().sort((a,b)=>Number(b.tap_count)-Number(a.tap_count))[0]?.first_name||'—'}</b><small>ผู้ช่วยแตะมากที่สุด</small></div></div><div className="admin-grid"><section className="panel"><div className="panel-title"><span className="panel-icon purple"><Settings size={19}/></span><div><h2>ตั้งค่าเกม</h2><p>กำหนดเป้าหมายและข้อความเมื่อสำเร็จ</p></div></div><form onSubmit={startGame} className="settings-form"><label>จำนวนครั้งที่ต้องการให้แตะรวม<input type="number" min="1" step="1" value={target} onChange={e=>setTarget(e.target.value)} required/><small>ตัวอย่าง 100 = แตะรวมกันครบ 100 ครั้ง ภาพจะเต็ม 100%</small></label><label>ข้อความเมื่อครบเป้าหมาย<input value={successText} onChange={e=>setSuccessText(e.target.value)} maxLength={120} placeholder="เช็คอินครบ 100% แล้ว!"/></label><div className="upload-box"><div className="upload-preview">{imageUrl?<img src={imageUrl} alt="ตัวอย่างรูปการ์ตูน"/>:<div className="preview-placeholder"><Cat size={36}/><span>POP!</span></div>}</div><div className="upload-copy"><b>รูปตัวการ์ตูน</b><p>รองรับไฟล์ PNG พื้นหลังโปร่งใสจะดูสวยที่สุด ขนาดไม่เกิน 5 MB</p><button className="outline-btn" type="button" onClick={()=>fileRef.current?.click()} disabled={uploading}><ImagePlus size={16}/>{uploading?'กำลังอัปโหลด...':'เลือกไฟล์ PNG'}</button><input ref={fileRef} type="file" accept="image/png" hidden onChange={uploadImage}/>{imageUrl&&<button className="text-btn" type="button" onClick={()=>setImageUrl('')}>เอารูปออก</button>}</div></div><button className="primary-btn wide" disabled={busy||uploading}><Play size={17} fill="currentColor"/>{busy?'กำลังเริ่ม...':'เริ่มเกม / เริ่มรอบใหม่'}</button><button className="danger-outline wide" type="button" onClick={resetGame}><RotateCcw size={16}/> รีเซ็ตเกมและรายชื่อที่เข้าร่วม</button></form></section><section className="panel"><div className="panel-title"><span className="panel-icon orange"><Users size={19}/></span><div><h2>รายชื่อนักเรียน</h2><p>นำเข้าจากไฟล์ Excel ได้ครั้งละหลายรายชื่อ</p></div></div><div className="import-instructions"><b>รูปแบบไฟล์ที่รองรับ</b><p>คำนำหน้า · ชื่อ · นามสกุล · รหัสนักเรียน</p><button className="outline-btn" type="button" onClick={downloadTemplate}><Download size={16}/> ดาวน์โหลดเทมเพลต Excel</button></div><label className="drop-zone"><Upload size={25}/><b>{importing?'กำลังนำเข้ารายชื่อ...':'คลิกเพื่อเลือกไฟล์ Excel'}</b><span>รองรับ .xlsx และ .xls</span><input type="file" accept=".xlsx,.xls" hidden disabled={importing} onChange={importExcel}/></label><div className="roster-head"><b>รายชื่อในระบบ</b><span>{students.length} คน</span></div><div className="roster-list">{students.slice(0,12).map(s=><div className="roster-row" key={s.id}><span className="avatar small-avatar">{(s.first_name||'?').slice(0,1)}</span><span>{fullName(s)}</span><small>{s.student_code||''}</small></div>)}{students.length===0&&<p className="muted">ยังไม่มีรายชื่อ นำเข้าไฟล์ Excel เพื่อเริ่มต้น</p>}{students.length>12&&<p className="muted small">แสดง 12 รายชื่อแรก จากทั้งหมด {students.length} คน</p>}</div></section></div>{message&&<div className="admin-message"><CircleHelp size={18}/>{message}<button onClick={()=>setMessage('')}>×</button></div>}<p className="security-note">🔒 หน้านี้ใช้ Supabase Auth และฐานข้อมูลมีสิทธิ์ควบคุมตามบทบาท อย่าใส่ service_role key ลงในหน้าเว็บหรือไฟล์ .env ที่เผยแพร่</p></main></>
}

export default function App() {
  const path = window.location.pathname.replace(/\/+$/,'') || '/'
  const { settings, students, sessions, refresh } = useGameData()
  if (!supabase) return <SetupNotice/>
  if (path === '/admin') return <Admin settings={settings} students={students} sessions={sessions} refresh={refresh}/>
  if (path === '/projector') return <Projector settings={settings} students={students} sessions={sessions}/>
  return <Player settings={settings} students={students} sessions={sessions} refresh={refresh}/>
}
