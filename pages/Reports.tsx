import React from 'react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download } from 'lucide-react';
import { extrairTexto, getMsgRole } from '../services/utils';

export const Reports: React.FC = () => {
    const { msgs, stats, listaOficialIA, listaOficialHumano } = useApp();

    // Prepare Data for Charts
    
    // 1. Messages per Day (Last 7 Days)
    const getDailyVolume = () => {
        const days = 7;
        const data = [];
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('pt-BR');
            // Filter messages for this day
            const count = msgs.filter(m => new Date(m.timestamp).toLocaleDateString('pt-BR') === dateStr).length;
            data.push({ name: dateStr.slice(0, 5), msg: count });
        }
        return data;
    };
    const dailyData = getDailyVolume();

    // 2. IA vs Human Distribution (Active Chats)
    const pieData = [
        { name: 'IA', value: listaOficialIA.length },
        { name: 'Humano', value: listaOficialHumano.length },
    ];
    const COLORS = ['#10b981', '#8b5cf6'];

    // 3. Automation Rate (Derived from Messages)
    const calculateMsgDistribution = () => {
        let ia = 0;
        let human = 0;
        msgs.forEach(m => {
            if(m.msg_da_IA) ia++;
            else if(getMsgRole(m) !== 'user') human++;
        });
        return [
            { name: 'Respostas IA', value: ia },
            { name: 'Respostas Humanas', value: human }
        ];
    };
    const msgDistData = calculateMsgDistribution();

    return (
        <div className="h-full overflow-y-auto p-6 bg-gray-50/50">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Relatórios Detalhados</h1>
                    <p className="text-gray-500 text-sm">Análise profunda do atendimento e performance.</p>
                </div>
                <button className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition">
                    <Download size={16} /> Exportar PDF
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Volume Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-50">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Volume de Mensagens (7 dias)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                                <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
                                <Bar dataKey="msg" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Automation Pie Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-50">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Distribuição de Atendimento (Chats Ativos)</h3>
                    <div className="h-72 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Metrics Cards */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-50 flex flex-col justify-center items-center text-center">
                    <h4 className="text-gray-500 font-medium text-sm uppercase">Taxa de Resposta IA</h4>
                    <div className="text-4xl font-bold text-emerald-500 my-2">
                        {msgDistData[0].value + msgDistData[1].value > 0 
                            ? ((msgDistData[0].value / (msgDistData[0].value + msgDistData[1].value)) * 100).toFixed(1) 
                            : 0}%
                    </div>
                    <p className="text-xs text-gray-400">Das mensagens enviadas</p>
                 </div>

                 <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-50 flex flex-col justify-center items-center text-center">
                    <h4 className="text-gray-500 font-medium text-sm uppercase">Atendimentos Hoje</h4>
                    <div className="text-4xl font-bold text-purple-600 my-2">{stats.conversasHoje}</div>
                    <p className="text-xs text-gray-400">Conversas ativas</p>
                 </div>

                 <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-50 flex flex-col justify-center items-center text-center">
                    <h4 className="text-gray-500 font-medium text-sm uppercase">Economia Estimada</h4>
                    <div className="text-4xl font-bold text-blue-600 my-2">{stats.tempoEconomizado}</div>
                    <p className="text-xs text-gray-400">Tempo de digitação poupado</p>
                 </div>
            </div>

            <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-purple-50">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Status da Base</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="p-4 bg-gray-50 rounded-lg">
                         <span className="block text-2xl font-bold text-gray-800">{stats.conversasTotal}</span>
                         <span className="text-xs text-gray-500 uppercase font-bold">Total Leads</span>
                     </div>
                     <div className="p-4 bg-gray-50 rounded-lg">
                         <span className="block text-2xl font-bold text-gray-800">{listaOficialIA.length}</span>
                         <span className="text-xs text-emerald-600 uppercase font-bold">Com Robô</span>
                     </div>
                     <div className="p-4 bg-gray-50 rounded-lg">
                         <span className="block text-2xl font-bold text-gray-800">{listaOficialHumano.length}</span>
                         <span className="text-xs text-purple-600 uppercase font-bold">Com Humano</span>
                     </div>
                     <div className="p-4 bg-gray-50 rounded-lg">
                         <span className="block text-2xl font-bold text-gray-800">{stats.foraHorario}</span>
                         <span className="text-xs text-orange-500 uppercase font-bold">Fora de Horário</span>
                     </div>
                </div>
            </div>
        </div>
    );
};
