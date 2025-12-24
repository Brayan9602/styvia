import React from 'react';
import { useApp } from '../context/AppContext';
import { 
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
    Zap, MessageSquare, Clock, AlertCircle, Calendar, Users, Bot, Laptop, 
    CheckCircle, PauseCircle, PlayCircle, Power, Info, Moon, Hourglass, Activity, ChevronRight 
} from 'lucide-react';
import { DASHBOARD_VERSION, WEBHOOK_URL } from '../constants';
import { useNavigate } from 'react-router-dom';
import { formatarData, getMsgRole } from '../services/utils';

export const Dashboard: React.FC = () => {
  const { stats, whatsappStatus, whatsappName, toggleIAGlobal, iaGlobalmentePausada, user, listaOficialIA, listaOficialHumano, msgs, setConversaSelecionada, getCRMData } = useApp();
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const navigate = useNavigate();

  // Dados para o Gráfico de Volume (7 dias)
  const chartData = React.useMemo(() => {
     const days = [];
     const today = new Date();
     for(let i=6; i>=0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
        // Simulação baseada no stats total ou random para demo visual se vazio
        const count = stats.totalMsgs > 0 ? Math.floor(Math.random() * (stats.totalMsgs / 5)) : 0; 
        days.push({ name: dateStr, msgs: count }); 
     }
     return days;
  }, [stats.totalMsgs]);

  // Dados para Horários de Pico (24h)
  const volumeData = stats.volumePorHora.map((v, i) => ({ name: `${i}h`, value: v }));

  // Conversas Recentes (Top 5)
  const recentConversations = React.useMemo(() => {
      const uniqueChats = [...new Set(msgs.map(m => m.remotejid))] as string[];
      return uniqueChats.slice(0, 5).map((id: string) => {
          const lastMsg = msgs.filter(m => m.remotejid === id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          const crm = getCRMData(id);
          const msgCount = msgs.filter(m => m.remotejid === id).length;
          return {
              id,
              name: crm.nome || id.replace('@s.whatsapp.net', ''),
              lastTime: lastMsg ? formatarData(lastMsg.timestamp) : '-',
              lastText: lastMsg ? (lastMsg.text || 'Mídia') : '',
              count: msgCount
          };
      });
  }, [msgs]);

  const handleConnect = async () => {
      if(whatsappStatus === 'connected') return;
      try {
          const res = await fetch(WEBHOOK_URL, {
              method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ action: 'whatsapp', email: user?.email })
          });
          const d = await res.json();
          if(d.base64) setQrCode(d.base64);
          else if(d[0]?.base64) setQrCode(d[0].base64);
      } catch(e) { alert("Erro ao conectar"); }
  };

  const handleDisconnect = async () => {
      const confirm = window.confirm("Tem certeza que deseja desconectar o WhatsApp?");
      if (!confirm) return;
      try {
          await fetch(WEBHOOK_URL, {
              method: 'POST', headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ action: 'desconectar_whatsapp', email: user?.email })
          });
          alert("Solicitação enviada. Aguarde a desconexão.");
      } catch(e) { alert("Erro ao desconectar"); }
  };

  const handleOpenChat = (id: string) => {
      setConversaSelecionada(id);
      navigate('/chat');
  };

  const MetricCard = ({ title, value, icon: Icon, iconColor, iconBg, info }: any) => (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-2 rounded-lg ${iconBg}`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            {info && <Info className="w-4 h-4 text-gray-300 cursor-help" />}
        </div>
        <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">{title} {info && <span className="sr-only">(info)</span>}</h3>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-6 bg-[#fbfaff]">
       {qrCode && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
               <div className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center">
                   <h2 className="text-xl font-bold mb-4">Escaneie o QR Code</h2>
                   <img src={qrCode} alt="QR" className="w-64 h-64 mb-4" />
                   <button onClick={() => setQrCode(null)} className="text-red-500 font-bold">Fechar</button>
               </div>
           </div>
       )}

       <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Visão Geral</h1>
            <p className="text-gray-500 mt-1 text-sm">Acompanhe métricas e performance em tempo real.</p>
          </div>
          <div className="hidden sm:block">
            <span className="text-[10px] text-purple-400 bg-purple-50 border border-purple-100 px-2 py-1 rounded-md">Versão: {DASHBOARD_VERSION}</span>
          </div>
       </header>

       {/* Connection Status Card */}
       <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
             <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${whatsappStatus === 'connected' ? 'bg-purple-100' : 'bg-red-100'}`}>
                 {whatsappStatus === 'connected' ? <CheckCircle className="w-6 h-6 text-purple-600" /> : <Power className="w-6 h-6 text-red-500" />}
             </div>
             <div>
                 <h2 className="text-base font-bold text-gray-900">Conexão WhatsApp</h2>
                 <p className="text-sm text-gray-500 flex items-center gap-1">
                     Estado atual: <span className={`font-bold ${whatsappStatus === 'connected' ? 'text-purple-600' : 'text-red-500'}`}>{whatsappStatus === 'connected' ? 'ONLINE' : 'OFFLINE'}</span>
                 </p>
                 {whatsappName && <p className="text-xs text-gray-400 mt-0.5">{whatsappName}</p>}
             </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
             {whatsappStatus === 'connected' && (
                 <button 
                    onClick={toggleIAGlobal} 
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${
                        iaGlobalmentePausada 
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                        : 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'
                    }`}
                 >
                     {iaGlobalmentePausada ? <PlayCircle size={16} /> : <PauseCircle size={16} />} 
                     {iaGlobalmentePausada ? 'Ativar IA' : 'Pausar IA'}
                 </button>
             )}
             
             {whatsappStatus === 'connected' ? (
                <>
                    <button 
                        onClick={handleDisconnect}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-red-200 bg-white text-red-600 hover:bg-red-50 transition"
                    >
                        Desconectar
                    </button>
                    <div className="px-5 py-2 rounded-lg text-sm font-medium bg-purple-200 text-purple-800 shadow-inner">
                        Status: Conectado
                    </div>
                </>
             ) : (
                <button onClick={handleConnect} className="px-6 py-2 rounded-lg text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-md transition">
                    Conectar Agora
                </button>
             )}
          </div>
       </div>

       {/* Banner Status do Atendimento */}
       <div className="w-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg mb-8 relative overflow-hidden">
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                        <Users className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Status do Atendimento</h2>
                        <p className="text-blue-100 text-sm opacity-90">Monitoramento da fila em tempo real</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    {/* Agente IA */}
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 min-w-[200px] flex items-center gap-4 border border-white/10">
                        <div className="bg-white/20 p-2.5 rounded-lg">
                            <Bot className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wide">Agente IA</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold">{listaOficialIA.length}</span>
                                <span className="text-xs text-blue-100">conversas</span>
                            </div>
                            <div className="text-[10px] text-white/80 mt-1 bg-black/20 px-1.5 py-0.5 rounded inline-block">
                                Tempo médio: 10s
                            </div>
                        </div>
                    </div>

                    {/* Equipe Humana */}
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 min-w-[200px] flex items-center gap-4 border border-white/10">
                        <div className="bg-white/20 p-2.5 rounded-lg">
                            <Laptop className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wide">Equipe Humana</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold">{listaOficialHumano.length}</span>
                                <span className="text-xs text-indigo-100">conversas</span>
                            </div>
                            <div className="text-[10px] text-white/80 mt-1 bg-black/20 px-1.5 py-0.5 rounded inline-block">
                                Tempo médio: {stats.tempoMedioResposta}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
       </div>

       {/* Grid de Métricas */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <MetricCard 
                title="Total de Conversas" 
                value={stats.conversasTotal} 
                icon={Users} iconColor="text-blue-500" iconBg="bg-blue-50" info 
            />
            <MetricCard 
                title="Conversas Hoje" 
                value={stats.conversasHoje} 
                icon={Calendar} iconColor="text-red-500" iconBg="bg-red-50" info 
            />
            <MetricCard 
                title="Total Mensagens" 
                value={stats.totalMsgs} 
                icon={MessageSquare} iconColor="text-blue-400" iconBg="bg-blue-50" info 
            />
            <MetricCard 
                title="Taxa Automação" 
                value={`${stats.taxaAutomacao}%`} 
                icon={Bot} iconColor="text-purple-500" iconBg="bg-purple-50" info 
            />
            <MetricCard 
                title="Tempo Economizado" 
                value={stats.tempoEconomizado} 
                icon={Hourglass} iconColor="text-yellow-600" iconBg="bg-yellow-50" info 
            />
            <MetricCard 
                title="Atend. Fora Horário" 
                value={stats.foraHorario} 
                icon={Moon} iconColor="text-indigo-500" iconBg="bg-indigo-50" info 
            />
       </div>

       {/* Gráficos */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           {/* Gráfico de Volume */}
           <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
               <h3 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
                   <Activity size={18} className="text-purple-500"/> Volume de Mensagens (7 dias)
               </h3>
               <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={chartData}>
                           <defs>
                               <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                                   <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                                   <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                               </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} dy={10} />
                           <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                           <Tooltip 
                                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} 
                                cursor={{stroke: '#8b5cf6', strokeWidth: 1}}
                           />
                           <Area type="monotone" dataKey="msgs" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorMsgs)" />
                       </AreaChart>
                   </ResponsiveContainer>
               </div>
           </div>

           {/* Gráfico de Pico */}
           <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
               <h3 className="text-base font-bold text-gray-800 mb-6 flex items-center gap-2">
                   <Clock size={18} className="text-purple-500"/> Horários de Pico (24h)
               </h3>
               <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={volumeData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} interval={2} />
                           <YAxis hide />
                           <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none'}} />
                           <Bar dataKey="value" fill="#a855f7" radius={[4, 4, 4, 4]} barSize={8} />
                       </BarChart>
                   </ResponsiveContainer>
               </div>
           </div>
       </div>

       {/* Rodapé: Dúvidas e Conversas Recentes */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Principais Dúvidas */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
               <h3 className="text-base font-bold text-gray-800 mb-4">Principais Dúvidas</h3>
               <div className="space-y-3">
                   {stats.topDuvidas.map((d, i) => (
                       <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                           <div className="flex items-center gap-3">
                               <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center">{i+1}</span>
                               <span className="text-sm text-gray-700 font-medium">{d.nome}</span>
                           </div>
                           <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded">{d.percentual}%</span>
                       </div>
                   ))}
                   {stats.topDuvidas.length === 0 && (
                       <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-60">
                           <div className="flex items-center gap-3">
                               <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center">1</span>
                               <span className="text-sm text-gray-700 font-medium">Preço/Orçamento</span>
                           </div>
                           <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded">100%</span>
                       </div>
                   )}
               </div>
            </div>

            {/* Conversas Recentes */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
               <div className="flex justify-between items-center mb-4">
                   <h3 className="text-base font-bold text-gray-800">Conversas Recentes</h3>
                   <button onClick={() => navigate('/chat')} className="text-xs text-purple-600 font-semibold hover:underline flex items-center gap-1">
                       Ver todas <ChevronRight size={12}/>
                   </button>
               </div>
               
               <div className="overflow-x-auto">
                   <table className="w-full text-left">
                       <thead>
                           <tr className="text-[10px] text-gray-400 uppercase border-b border-gray-100">
                               <th className="pb-2 font-semibold">Cliente</th>
                               <th className="pb-2 font-semibold">Última Interação</th>
                               <th className="pb-2 font-semibold text-center">Msgs</th>
                               <th className="pb-2 font-semibold text-right">Ação</th>
                           </tr>
                       </thead>
                       <tbody className="text-sm">
                           {recentConversations.map((c, i) => (
                               <tr key={c.id} className="group hover:bg-gray-50 transition-colors">
                                   <td className="py-3 pr-2">
                                       <div className="flex items-center gap-2">
                                           <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-[10px] flex items-center justify-center font-bold">
                                               {i+1}
                                           </div>
                                           <span className="font-medium text-gray-700 truncate max-w-[120px]">{c.name}</span>
                                       </div>
                                   </td>
                                   <td className="py-3 pr-2">
                                       <div className="text-xs text-gray-800 font-medium">{c.lastTime},</div>
                                       <div className="text-[10px] text-gray-400 truncate max-w-[150px]">{c.lastText}</div>
                                   </td>
                                   <td className="py-3 text-center">
                                       <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.count}</span>
                                   </td>
                                   <td className="py-3 text-right">
                                       <button 
                                            onClick={() => handleOpenChat(c.id)}
                                            className="text-xs font-semibold text-purple-600 hover:bg-purple-50 px-2 py-1 rounded transition"
                                        >
                                           Ver Chat
                                       </button>
                                   </td>
                               </tr>
                           ))}
                           {recentConversations.length === 0 && (
                               <tr><td colSpan={4} className="py-4 text-center text-xs text-gray-400 italic">Nenhuma conversa recente</td></tr>
                           )}
                       </tbody>
                   </table>
               </div>
            </div>
       </div>
    </div>
  );
};