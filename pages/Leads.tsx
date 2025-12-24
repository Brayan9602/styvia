import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatarData, getMsgRole, extrairTexto } from '../services/utils';
import * as XLSX from 'xlsx';
import { Download, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Leads: React.FC = () => {
    const { clientes, msgs, getCRMData, listaOficialIA, listaOficialHumano, setConversaSelecionada } = useApp();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const filteredLeads = clientes.filter(id => {
        if (search && !id.includes(search) && !getCRMData(id).nome?.includes(search)) return false;
        
        const lastMsg = msgs.find(m => m.remotejid === id);
        if (!lastMsg) return false;
        const ts = new Date(lastMsg.timestamp).getTime();

        if (startDate && ts < new Date(startDate).setHours(0,0,0,0)) return false;
        if (endDate && ts > new Date(endDate).setHours(23,59,59,999)) return false;
        return true;
    }).map(id => {
        const myMsgs = msgs.filter(m => m.remotejid === id);
        const last = myMsgs[0]; // Assuming sorted
        return {
            id,
            name: getCRMData(id).nome || id.replace('@s.whatsapp.net', ''),
            lastInteraction: last ? formatarData(last.timestamp) : '-',
            totalMsgs: myMsgs.length,
            status: listaOficialIA.includes(id) ? 'IA' : (listaOficialHumano.includes(id) ? 'Humano' : 'Indefinido')
        };
    });

    const exportExcel = () => {
        const data = filteredLeads.map(l => ({
            "ID": l.id.replace('@s.whatsapp.net', ''),
            "Nome": l.name,
            "Última Interação": l.lastInteraction,
            "Total Mensagens": l.totalMsgs,
            "Status": l.status
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leads");
        XLSX.writeFile(wb, "leads_radar_ia.xlsx");
    };

    const handleOpenChat = (id: string) => {
        setConversaSelecionada(id);
        navigate('/chat');
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 p-6 animate-fade-in">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestão de Leads</h1>
                    <p className="text-sm text-gray-500">Exporte dados e filtre clientes</p>
                </div>
                <button onClick={exportExcel} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow hover:bg-emerald-700">
                    <Download size={16}/> Excel
                </button>
            </header>

            <div className="bg-white p-4 rounded-xl shadow-sm mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="date" className="border rounded-lg p-2" onChange={e => setStartDate(e.target.value)} />
                <input type="date" className="border rounded-lg p-2" onChange={e => setEndDate(e.target.value)} />
                <input type="text" placeholder="Buscar..." className="border rounded-lg p-2" onChange={e => setSearch(e.target.value)} />
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Interação</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Msgs</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredLeads.map(l => (
                            <tr key={l.id} className="hover:bg-purple-50 transition">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">{l.name.substring(0,2)}</div>
                                        <div className="ml-4 text-sm font-medium text-gray-900">{l.name}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">{l.lastInteraction}</td>
                                <td className="px-6 py-4 text-center text-sm">{l.totalMsgs}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${l.status === 'IA' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                                        {l.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handleOpenChat(l.id)} className="text-purple-600 hover:text-purple-900"><Eye size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
