import React, {useState} from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { doSignOut } from '../../firebase/auth';
import { useAuth } from '../../contexts/authContext';
import './dashboard.css';

export default function TopBar({onLogout, onSettings}){
  const { currentUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    try{
      await doSignOut();
    }catch(err){
      console.warn('Sign out failed', err);
    }
    if(onLogout) onLogout();
    navigate('/login');
  }

  const displayName = currentUser?.displayName || currentUser?.email || 'User';

  return (
    <div className="topbar" style={{position:'relative'}}>
      <div className="left">
        <div className="logo">DocVoice-Agent</div>
        <div className="session-badge">Session Active</div>
      </div>

      <div style={{display:'flex', alignItems:'center', position:'relative'}}>
        <button
          className="icon-btn"
          aria-label="Toggle dark mode"
          onClick={toggleTheme}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, marginRight: 16 }}
        >
          {theme === 'dark' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" fill="#e5e7eb"/></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#facc15"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#facc15" strokeWidth="2" strokeLinecap="round"/></svg>
          )}
        </button>
        <div className="profile" onClick={()=>setOpen(v=>!v)} style={{cursor:'pointer'}}>
          <div style={{textAlign:'right', marginRight:8}}>
            <div style={{fontSize:13,fontWeight:700}}>{displayName}</div>
            <div style={{fontSize:12,color:'var(--muted)'}}>{currentUser?.email}</div>
          </div>
          <div className="avatar">{(currentUser?.displayName||'U')[0].toUpperCase()}</div>
        </div>

        {open && (
          <div style={{position:'absolute', right:0, top:50, background:'#fff', border:'1px solid rgba(15,23,42,0.06)', borderRadius:8, boxShadow:'0 8px 30px rgba(2,6,23,0.08)', overflow:'hidden', zIndex:40}}>
            <button onClick={()=>{ setOpen(false); if(onSettings) onSettings(); }} style={{display:'block', padding:'10px 16px', width:220, textAlign:'left', background:'transparent', border:'none', cursor:'pointer'}}>Settings</button>
            <div style={{height:1, background:'rgba(15,23,42,0.03)'}} />
            <button onClick={handleLogout} style={{display:'block', padding:'10px 16px', width:220, textAlign:'left', background:'transparent', border:'none', cursor:'pointer', color:'#ef4444'}}>Logout</button>
          </div>
        )}
      </div>
    </div>
  )
}
