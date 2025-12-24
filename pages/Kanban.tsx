import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatarData, extrairTexto } from '../services/utils';
import { Bot, User as UserIcon, MoreHorizontal, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Kanban: React.FC = () => {
    const { clientes, msgs, getCRMData, saveCRMData, etiquetasDisponiveis, listaOficialIA, listaOficialHumano, setConversaSelecionada, chatTagsMap } = useApp();
    const navigate = useNavigate();

    // Organizar colunas
    const columns = useMemo<Record<string, string[]>>(() => {
        // Coluna padrão para leads sem etiqueta
        const cols: Record<string, string[]> = { "Sem Etiqueta": [] };
        
        // Criar colunas para todas as etiquetas disponíveis
        etiquetasDisponiveis.forEach(tag => {
            cols[tag] = [];
        });

        // Distribuir os leads nas colunas
        clientes.forEach(id => {
            const crm = getCRMData(id);
            // Prioridade: Etiquetas locais do CRM > Etiquetas vindas do webhook (chatTagsMap)
            const tags = crm.tags && crm.tags.length > 0 ? crm.tags : (chatTagsMap[id] || []);
            
            // Se tiver tags, coloca na primeira tag encontrada que seja válida (uma coluna existente)
            const validTag = tags.find(t => etiquetasDisponiveis.includes(t));
            
            if (validTag) {
                if (!cols[validTag]) cols[validTag] = []; // Safety check
                cols[validTag].push(id);
            } else {
                cols["Sem Etiqueta"].push(id);
            }
        });

        return cols;
    }, [clientes, etiquetasDisponiveis, getCRMData, chatTagsMap]);

    // Handlers de Drag & Drop
    const handleDragStart = (e: React.DragEvent, id: string, sourceTag: string) => {
        e.dataTransfer.setData("leadId", id);
        e.dataTransfer.setData("sourceTag", sourceTag);
    };

    const handleDrop = (e: React.DragEvent, targetTag: string) => {
        e.preventDefault();
        const leadId = e.dataTransfer.getData("leadId");
        const sourceTag = e.dataTransfer.getData("sourceTag");

        if (!leadId || sourceTag === targetTag) return;

        const crm = getCRMData(leadId);
        const currentTags = crm.tags || [];

        // Lógica: Remover a tag antiga (se não for "Sem Etiqueta") e adicionar a nova (se não for "Sem Etiqueta")
        let newTags = [...currentTags];

        // Remove a tag de origem se ela existir na lista
        if (sourceTag !== "Sem Etiqueta") {
            newTags = newTags.filter(t => t !== sourceTag);
        }

        // Adiciona a tag de destino se não for "Sem Etiqueta" e se ainda não estiver lá
        if (targetTag !== "Sem Etiqueta" && !newTags.includes(targetTag)) {
            newTags.push(targetTag);
        }

        // Salvar via API/Context
        saveCRMData(leadId, 'tags', newTags);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessário para permitir o Drop
    };

    const handleCardClick = (id: string) => {
        setConversaSelecionada(id);
        navigate('/chat');
    };

    return (
        <div className="h-full flex flex-col bg-[#fbfaff] overflow-hidden">
            <header className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white shadow-sm z-10">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Kanban CRM</h1>
                    <p className="text-sm text-gray-500 mt-1">Gerencie o fluxo de atendimento arrastando os cards entre as colunas.</p>
                </div>
            </header>

            <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
                <div className="flex h-full gap-6 min-w-max">
                    {Object.entries(columns).map(([tag, leadIds]) => (
                        <div 
                            key={tag} 
                            className="w-80 flex flex-col bg-gray-100/50 rounded-xl border border-gray-200/60 max-h-full"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, tag)}
                        >
                            {/* Header da Coluna */}
                            <div className="p-4 flex items-center justify-between border-b border-gray-100 bg-white/50 backdrop-blur-sm rounded-t-xl sticky top-0">
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${tag === "Sem Etiqueta" ? "bg-gray-400" : "bg-purple-500"}`}></div>
                                    <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide truncate max-w-[180px]" title={tag}>
                                        {tag}
                                    </h3>
                                    <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md text-xs font-bold">
                                        {leadIds.length}
                                    </span>
                                </div>
                                <button className="text-gray-400 hover:text-purple-600 transition"><MoreHorizontal size={16}/></button>
                            </div>

                            {/* Área de Cards */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                {leadIds.map(id => {
                                    const crm = getCRMData(id);
                                    const lastMsg = msgs.find(m => m.remotejid === id); // Assume msgs sorted/available
                                    const isIA = listaOficialIA.includes(id);
                                    const isHumano = listaOficialHumano.includes(id);
                                    
                                    return (
                                        <div
                                            key={id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, id, tag)}
                                            onClick={() => handleCardClick(id)}
                                            className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-purple-200 transition group relative"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                                                        {crm.nome ? crm.nome.substring(0,2).toUpperCase() : id.substring(0,2)}
                                                    </div>
                                                    <span className="font-semibold text-gray-800 text-sm truncate">{crm.nome || id.split('@')[0]}</span>
                                                </div>
                                                {/* Badge de Status */}
                                                {isIA && (
                                                    <div className="bg-emerald-100 text-emerald-700 p-1 rounded-md" title="Atendido por IA">
                                                        <Bot size={14} />
                                                    </div>
                                                )}
                                                {isHumano && (
                                                    <div className="bg-purple-100 text-purple-700 p-1 rounded-md" title="Atendido por Humano">
                                                        <UserIcon size={14} />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="text-xs text-gray-500 line-clamp-2 mb-3 h-8">
                                                {lastMsg ? extrairTexto(lastMsg.conversation_history || lastMsg.text) : <span className="italic text-gray-300">Sem mensagens...</span>}
                                            </div>

                                            <div className="flex justify-between items-center pt-2 border-t border-gray-50 mt-2">
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    {lastMsg ? formatarData(lastMsg.timestamp) : '-'}
                                                </span>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button className="text-purple-600 hover:bg-purple-50 p-1 rounded">
                                                        <MessageSquare size={14}/>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {leadIds.length === 0 && (
                                    <div className="h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs italic">
                                        Arraste leads para cá
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};