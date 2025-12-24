import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MessageSquare, Users, BarChart2, Zap, LogOut, ChevronLeft, ChevronRight, Menu, Kanban as KanbanIcon } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout, abaAtendimentosVisivel, abaLeadsVisivel, msgs } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const countUnread = () => {
    // Simplified Logic
    return msgs.filter(m => !m.nao_mostrar && !m.msg_da_IA && (!m.role || m.role === 'user') && m.timestamp > (JSON.parse(localStorage.getItem('chat_read_state') || '{}')[m.remotejid] || 0)).length;
  };
  const unreadCount = countUnread();

  const NavItem = ({ to, icon: Icon, label, disabled, badge }: any) => {
    const active = location.pathname === to;
    return (
      <button
        onClick={() => !disabled && navigate(to)}
        className={`w-full flex items-center px-3 py-3 rounded-lg transition-all group mb-1 
        ${active ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50' : 'text-purple-200/60 hover:bg-purple-900/20 hover:text-purple-100'}
        ${disabled ? 'opacity-50 cursor-not-allowed bg-transparent' : ''}`}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && (
            <span className="ml-3 text-sm font-medium whitespace-nowrap flex-1 text-left">{label}</span>
        )}
        {!collapsed && badge > 0 && (
            <span className="bg-green-500 text-white py-0.5 px-2 rounded-full text-xs font-bold shadow-sm">{badge}</span>
        )}
      </button>
    );
  };

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-72'} bg-[#1a0b2e] text-white transition-all duration-300 flex flex-col shadow-xl z-20 flex-shrink-0 border-r border-purple-900/20 h-screen`}>
      <div className="h-16 flex items-center justify-between px-4 border-b border-purple-900/30 bg-[#130722]">
        {!collapsed && (
          <div className="flex items-center space-x-2 animate-fade-in">
            <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center flex-shrink-0 shadow-purple-500/20 shadow-lg">
                <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Radar<span className="text-purple-400">IA</span></span>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className={`p-2 rounded-lg hover:bg-purple-900/30 text-purple-200/70 hover:text-white transition ${collapsed ? 'mx-auto' : ''}`}>
           <Menu className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
        <NavItem to="/" icon={Home} label="Dashboard" />
        <NavItem to="/chat" icon={MessageSquare} label="Atendimentos" disabled={!abaAtendimentosVisivel} badge={unreadCount} />
        <NavItem to="/kanban" icon={KanbanIcon} label="Kanban CRM" disabled={!abaLeadsVisivel} />
        <NavItem to="/leads" icon={Users} label="Leads" disabled={!abaLeadsVisivel} />
        <NavItem to="/reports" icon={BarChart2} label="Relatórios" />
        <NavItem to="/training" icon={Zap} label="Estúdio de Teste" />
      </nav>

      <div className="p-4 border-t border-purple-900/30 bg-[#130722]">
        {!collapsed && user && (
           <div className="flex items-center space-x-3 mb-4 animate-fade-in">
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                {user.nome.charAt(0).toUpperCase()}
             </div>
             <div>
                <p className="text-sm font-semibold text-white">{user.nome}</p>
                <p className="text-xs text-purple-300/60 truncate w-32">{user.email}</p>
             </div>
           </div>
        )}
        <button onClick={logout} className="w-full flex items-center justify-center px-4 py-2 bg-purple-900/50 hover:bg-red-900/50 text-purple-200 hover:text-red-200 rounded-lg transition group">
           <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
           {!collapsed && <span className="ml-2 text-sm font-medium">Sair</span>}
        </button>
      </div>
    </aside>
  );
};