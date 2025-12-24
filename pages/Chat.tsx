import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { processarPartesDaMensagem, extrairTexto, getMsgRole, formatarData, fragmentarTextoPorPontuacao } from '../services/utils';
import { WEBHOOK_URL } from '../constants';
import { Send, Mic, StopCircle, Trash2, X, Plus, Tag, Filter, Paperclip, Bot, Power, PanelRightOpen, PanelRightClose, Image as ImageIcon } from 'lucide-react';

// Subcomponent to handle fragmentation
const ChatBubbleGroup: React.FC<{ msg: any }> = ({ msg }) => {
    const isUser = getMsgRole(msg) === 'user';
    const isIA = msg.msg_da_IA === true;
    
    // Bubble Styles
    let bubbleClass = isUser ? 'bg-white text-gray-800 rounded-tl-none border-gray-100 shadow-sm border' : 
                      isIA ? 'bg-gradient-to-br from-emerald-50 to-teal-50 text-gray-800 rounded-tr-none border-emerald-100 shadow-sm border' : 
                      'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-tr-none shadow-md';

    const rawText = extrairTexto(msg.conversation_history || msg.text);
    const time = formatarData(msg.timestamp).split(' ')[1];
    
    // Fracionamento: Se for texto puro (sem tags especiais de midia manuais), tenta fragmentar
    // Caso contrário, processa normalmente.
    let fragments = [rawText];
    if (!rawText.includes('<video') && !rawText.includes('<image') && !rawText.includes('<audio')) {
        fragments = fragmentarTextoPorPontuacao(rawText);
    }

    return (
        <div className={`flex flex-col w-full mt-3 animate-fade-in ${isUser ? 'items-start' : 'items-end'}`}>
            {!isUser && (
                <span className={`text-[10px] font-bold uppercase mb-1 opacity-50 ${isIA ? 'text-emerald-600' : 'text-purple-600'}`}>
                    {isIA ? 'Robô' : 'Atendente'}
                </span>
            )}
            
            {fragments.map((frag, idx) => {
                const parts = processarPartesDaMensagem(frag);
                return (
                    <div key={idx} className={`max-w-[85%] md:max-w-[70%] mb-1 last:mb-0`}>
                        {parts.map((p, i) => (
                            <div key={i} className={`px-4 py-2 relative rounded-2xl ${bubbleClass} text-sm`}>
                                {p.type === 'text' && <div dangerouslySetInnerHTML={{__html: p.html}} />}
                                {p.type === 'image' && <img src={p.html} className="rounded max-w-xs cursor-pointer shadow-sm border border-black/10" onClick={() => window.open(p.html)} />}
                                {p.type === 'video' && <video src={p.html} controls className="rounded max-w-xs shadow-sm" />}
                                {p.type === 'audio' && <audio controls src={p.html} className="mt-1 h-8 max-w-[200px]" />}
                                {idx === fragments.length - 1 && i === parts.length - 1 && (
                                    <div className={`text-[9px] text-right mt-1 opacity-70`}>{time}</div>
                                )}
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

export const Chat: React.FC = () => {
    const { msgs, clientes, listaOficialIA, listaOficialHumano, getCRMData, saveCRMData, etiquetasDisponiveis, chatTagsMap, user, toggleIA, refreshData, setConversaSelecionada, markAsRead } = useApp();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [crmOpen, setCrmOpen] = useState(true);
    const [inputText, setInputText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('todos'); // todos, ia, humano
    const [filterTag, setFilterTag] = useState('');
    const [uploading, setUploading] = useState(false);

    // Filter Logic
    const filteredChats = clientes.filter(id => {
        // Search Text
        const crm = getCRMData(id);
        const name = crm.nome || '';
        const matchesSearch = id.toLowerCase().includes(searchTerm.toLowerCase()) || name.toLowerCase().includes(searchTerm.toLowerCase());
        if(!matchesSearch) return false;

        // Type Filter
        if(filterType === 'ia' && !listaOficialIA.includes(id)) return false;
        if(filterType === 'humano' && !listaOficialHumano.includes(id)) return false;

        // Tag Filter
        if(filterTag) {
            const chatTags = chatTagsMap[id] || crm.tags || [];
            if (!chatTags.includes(filterTag)) return false;
        }

        return true;
    }).sort((a,b) => {
        const lastA = msgs.find(m => m.remotejid === a)?.timestamp || 0;
        const lastB = msgs.find(m => m.remotejid === b)?.timestamp || 0;
        return new Date(lastB).getTime() - new Date(lastA).getTime();
    });

    const currentMsgs = selectedId ? msgs.filter(m => m.remotejid === selectedId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : [];
    const crmData = selectedId ? getCRMData(selectedId) : null;
    const isHandledByIA = selectedId ? listaOficialIA.includes(selectedId) : false;

    useEffect(() => {
        if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [currentMsgs, selectedId]);

    const handleSelectChat = (id: string) => {
        setSelectedId(id);
        setConversaSelecionada(id);
        markAsRead(id);
    };

    const handleSend = async () => {
        if(!inputText.trim() || !selectedId) return;
        const txt = inputText;
        setInputText('');
        try {
            await fetch(WEBHOOK_URL, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'responder_lead', email: user?.email, remotejid: selectedId, msg: txt, type: 'text' })
            });
            refreshData();
        } catch(e) { console.error(e); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedId) return;
        setUploading(true);

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
             const base64 = (reader.result as string).split(',')[1];
             const mimeType = file.type;
             const type = mimeType.startsWith('image') ? 'image' : (mimeType.startsWith('video') ? 'video' : 'document');
             
             try {
                await fetch(WEBHOOK_URL, {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        action: 'responder_lead', 
                        email: user?.email, 
                        remotejid: selectedId, 
                        nome: file.name, 
                        base64, 
                        mimeType, 
                        type 
                    })
                });
                refreshData();
             } catch(err) {
                 alert("Erro ao enviar arquivo.");
             } finally {
                 setUploading(false);
                 if(fileInputRef.current) fileInputRef.current.value = '';
             }
        };
    };

    const startRecording = async () => {
        if (!navigator.mediaDevices) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => audioChunksRef.current.push(event.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64 = (reader.result as string).split(',')[1];
                    if(selectedId) {
                        await fetch(WEBHOOK_URL, {
                            method: 'POST', headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ action: 'responder_lead', email: user?.email, remotejid: selectedId, nome: 'audio.webm', base64, mimeType: 'audio/webm', type: 'audio' })
                        });
                        refreshData();
                    }
                };
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            setIsRecording(true);
        } catch (e) {
            alert("Erro ao acessar microfone. Verifique as permissões.");
        }
    };

    const stopRecording = () => {
        if(mediaRecorderRef.current) mediaRecorderRef.current.stop();
        setIsRecording(false);
    };

    return (
        <div className="flex h-full bg-white">
            {/* Sidebar List */}
            <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
                <div className="p-4 border-b border-gray-100 space-y-3">
                    <input 
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none" 
                        placeholder="Buscar cliente..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    
                    {/* Filtros */}
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <select 
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-md text-xs py-1.5 px-2 outline-none"
                            value={filterTag}
                            onChange={e => setFilterTag(e.target.value)}
                        >
                            <option value="">Todas Etiquetas</option>
                            {etiquetasDisponiveis.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        {['todos', 'ia', 'humano'].map(t => (
                            <button key={t} onClick={() => setFilterType(t)} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded-md transition ${filterType === t ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredChats.map(id => {
                        const lastMsg = msgs.find(m => m.remotejid === id);
                        const crm = getCRMData(id);
                        const isIA = listaOficialIA.includes(id);
                        return (
                            <div key={id} onClick={() => handleSelectChat(id)} className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-purple-50 transition ${selectedId === id ? 'bg-purple-50 border-l-4 border-l-purple-600' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <h3 className="text-sm font-semibold truncate w-32">{crm.nome || id.split('@')[0]}</h3>
                                    <span className="text-[10px] text-gray-400">{lastMsg ? formatarData(lastMsg.timestamp).split(' ')[1] : ''}</span>
                                </div>
                                <p className="text-xs text-gray-500 truncate mt-1">{lastMsg ? extrairTexto(lastMsg.conversation_history || lastMsg.text) : ''}</p>
                                <div className="flex gap-1 mt-2 items-center">
                                    {isIA ? <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">IA</span> : <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700">HUMANO</span>}
                                    {(chatTagsMap[id] || crm.tags || []).slice(0, 2).map((t, i) => (
                                        <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-gray-200 text-gray-600 truncate max-w-[60px]">{t}</span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {filteredChats.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">Nenhuma conversa encontrada.</div>}
                </div>
            </div>

            {/* Chat Area */}
            {selectedId ? (
                <div className="flex-1 flex flex-col min-w-0 bg-chat-pattern relative">
                    <header className="bg-white/95 backdrop-blur p-4 border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-100 to-indigo-100 flex items-center justify-center font-bold text-purple-600 shadow-inner">
                                {crmData?.nome ? crmData.nome.substring(0,2).toUpperCase() : <Users size={20}/>}
                            </div>
                            <div>
                                <h2 className="font-bold text-gray-800 leading-tight">{crmData?.nome || selectedId}</h2>
                                {crmData?.nome && <p className="text-xs text-gray-500 font-mono">{selectedId.split('@')[0]}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                             <div className="flex items-center bg-gray-100 rounded-lg p-1">
                                 <button 
                                    onClick={() => toggleIA(isHandledByIA ? 'pausar_IA' : 'ativar_IA', selectedId)} 
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all shadow-sm ${isHandledByIA ? 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
                                 >
                                    {isHandledByIA ? <Bot size={14} className="text-emerald-500" /> : <Power size={14} />}
                                    {isHandledByIA ? 'IA Ativa' : 'IA Inativa'}
                                 </button>
                             </div>
                             <button 
                                onClick={() => setCrmOpen(!crmOpen)} 
                                className={`p-2 rounded-lg transition ${crmOpen ? 'bg-purple-100 text-purple-600' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                title={crmOpen ? "Fechar CRM" : "Abrir CRM"}
                             >
                                 {crmOpen ? <PanelRightClose size={20}/> : <PanelRightOpen size={20}/>}
                             </button>
                        </div>
                    </header>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 scroll-smooth">
                        {currentMsgs.map((m, i) => <ChatBubbleGroup key={i} msg={m} />)}
                        {uploading && (
                            <div className="flex justify-end mt-2 animate-fade-in">
                                <div className="bg-purple-50 text-purple-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full border-2 border-purple-600 border-t-transparent animate-spin"></div>
                                    Enviando arquivo...
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-4 border-t border-gray-200">
                        {isRecording ? (
                            <div className="flex items-center justify-between bg-red-50 p-3 rounded-xl text-red-600 animate-pulse border border-red-100">
                                <span className="font-mono text-sm font-bold flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-600"></div> Gravando áudio...</span>
                                <button onClick={stopRecording} className="bg-white p-2 rounded-full shadow-sm hover:scale-110 transition"><StopCircle size={20}/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:ring-2 focus-within:ring-purple-100 transition-shadow">
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    onChange={handleFileUpload} 
                                    accept="image/*,video/*,application/pdf"
                                />
                                <button 
                                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Anexar arquivo"
                                >
                                    <Paperclip size={20}/>
                                </button>
                                
                                <input 
                                    className="flex-1 bg-transparent px-2 py-2 text-sm focus:outline-none text-gray-700 placeholder-gray-400"
                                    placeholder="Digite sua mensagem..."
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                />
                                
                                <button 
                                    onClick={startRecording} 
                                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                                    title="Gravar áudio"
                                >
                                    <Mic size={20}/>
                                </button>
                                
                                <button 
                                    onClick={handleSend} 
                                    disabled={!inputText.trim()}
                                    className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 shadow-md transform hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                    <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                        <MessageSquare size={40} className="text-purple-300" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-600">Nenhuma conversa selecionada</h3>
                    <p className="text-sm mt-1">Selecione um cliente ao lado para iniciar o atendimento.</p>
                </div>
            )}

            {/* CRM Sidebar */}
            {selectedId && crmOpen && (
                <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-xl z-20">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Users size={18}/> Detalhes do Lead</h3>
                    </div>
                    <div className="p-5 overflow-y-auto flex-1 space-y-6">
                        <div className="group">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block group-focus-within:text-purple-600 transition">Nome</label>
                            <input 
                                className="w-full bg-gray-50 border-b-2 border-gray-200 focus:border-purple-500 px-2 py-2 text-sm outline-none transition" 
                                value={crmData?.nome || ''} 
                                onChange={e => saveCRMData(selectedId, 'nome', e.target.value)}
                                placeholder="Nome do cliente"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block flex justify-between">
                                Etiquetas <Tag size={12}/>
                            </label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {crmData?.tags.map(t => (
                                    <span key={t} className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1 border border-purple-100">
                                        {t} <button onClick={() => saveCRMData(selectedId, 'tags', crmData.tags.filter(tag => tag !== t))} className="hover:text-red-500"><X size={12}/></button>
                                    </span>
                                ))}
                            </div>
                            <select 
                                className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-purple-100"
                                onChange={e => {
                                    if(e.target.value && !crmData?.tags.includes(e.target.value)) {
                                        saveCRMData(selectedId, 'tags', [...(crmData?.tags || []), e.target.value]);
                                    }
                                    e.target.value = '';
                                }}
                            >
                                <option value="">+ Adicionar Etiqueta</option>
                                {etiquetasDisponiveis.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="group">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block group-focus-within:text-purple-600 transition">Anotações Internas</label>
                            <textarea 
                                className="w-full bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm h-40 resize-none outline-none focus:ring-2 focus:ring-yellow-200 transition text-gray-700 leading-relaxed"
                                value={crmData?.notes || ''}
                                onChange={e => saveCRMData(selectedId, 'notes', e.target.value)}
                                placeholder="Escreva observações importantes sobre este cliente..."
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper components
const UsersIcon = () => <Users size={20} />;
const MessageSquareIcon = () => <MessageSquare size={20} />;
import { Users, MessageSquare } from 'lucide-react';