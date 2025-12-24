import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Send, Trash2, Edit3, Terminal, ArrowRight, Info, Sparkles } from 'lucide-react';
import { fragmentarTextoPorPontuacao, processarPartesDaMensagem } from '../services/utils';
import { WEBHOOK_URL } from '../constants';

export const Training: React.FC = () => {
    const { treinamentoMsgs, sendTrainingMessage, clearTraining, webhookTeste, user } = useApp();
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showAdjustments, setShowAdjustments] = useState(true);
    const [adjustmentRequest, setAdjustmentRequest] = useState("");
    const [sendingRequest, setSendingRequest] = useState(false);

    useEffect(() => {
        if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [treinamentoMsgs]);

    const handleSendAdjustment = async () => {
        if(!adjustmentRequest.trim()) return;
        setSendingRequest(true);
        try {
            const payload = {
                action: 'solicitar_ajuste',
                email: user?.email,
                solicitacao: adjustmentRequest,
                timestamp: Date.now()
            };
            const url = webhookTeste && webhookTeste !== "undefined" ? webhookTeste : WEBHOOK_URL;
            await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
            alert("Solicitação enviada com sucesso! Nossa equipe analisará em breve.");
            setAdjustmentRequest("");
        } catch(e) {
            alert("Erro ao enviar solicitação.");
        } finally {
            setSendingRequest(false);
        }
    };

    // Fragmented Bubble Component (Local)
    const TrainingBubble: React.FC<{ m: any }> = ({ m }) => {
        const isUser = m.sender === 'user';
        const fragments = isUser ? [m.text] : fragmentarTextoPorPontuacao(m.text);

        return (
            <div className={`flex flex-col w-full mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
                {fragments.map((frag, idx) => {
                    const parts = processarPartesDaMensagem(frag);
                    return (
                        <div key={idx} className={`max-w-[80%] mb-1 last:mb-0`}>
                            {parts.map((p, i) => (
                                <div key={i} className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
                                    isUser 
                                    ? 'bg-purple-600 text-white rounded-tr-none' 
                                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                                }`}>
                                    {p.type === 'text' && <div dangerouslySetInnerHTML={{__html: p.html}} />}
                                </div>
                            ))}
                        </div>
                    );
                })}
                <div className="text-[9px] opacity-50 mt-1 mx-2">{m.time}</div>
            </div>
        );
    };

    return (
        <div className="h-full flex bg-gray-100">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="bg-white p-4 shadow-sm flex justify-between items-center z-10 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-xs shadow-inner">IA</div>
                        <div>
                            <h1 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                Estúdio de Teste <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            </h1>
                            <p className="text-xs text-gray-400">Simulador de WhatsApp</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={clearTraining} 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition shadow-sm"
                        >
                            <Trash2 size={14}/> Limpar Conversa
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 bg-chat-pattern" ref={scrollRef}>
                    {treinamentoMsgs.length === 0 && (
                         <div className="h-full flex flex-col items-center justify-center opacity-40">
                             <div className="bg-gray-200 p-6 rounded-full mb-4 shadow-inner"><Terminal size={32} className="text-gray-500"/></div>
                             <p className="text-sm font-medium">Inicie uma conversa para testar o fluxo.</p>
                         </div>
                    )}
                    {treinamentoMsgs.map((m, i) => <TrainingBubble key={i} m={m} />)}
                </div>

                <div className="bg-white p-4 border-t border-gray-200">
                    <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-2xl border border-gray-200 focus-within:ring-2 focus-within:ring-purple-100 transition shadow-sm">
                        <input 
                            className="flex-1 bg-transparent px-4 py-1 focus:outline-none text-sm text-gray-700 placeholder-gray-400"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if(e.key === 'Enter') { sendTrainingMessage(input); setInput(''); }}}
                            placeholder="Digite uma mensagem..."
                        />
                        <button 
                            onClick={() => { sendTrainingMessage(input); setInput(''); }} 
                            disabled={!input.trim()}
                            className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 shadow-md transform hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Adjustments Sidebar */}
            {showAdjustments && (
                <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl z-20">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-1">
                            <Edit3 size={20} className="text-purple-600"/> Solicitar Ajustes
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Encontrou algo para melhorar no comportamento do robô? Descreva abaixo.
                        </p>
                    </div>
                    
                    <div className="p-6 flex-1 overflow-y-auto bg-gray-50/30">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
                            <div className="flex gap-2 items-start">
                                <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0"/>
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    <span className="font-bold">Importante:</span> Solicitações de ajuste são enviadas diretamente para nossa equipe técnica.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Descrição Detalhada</label>
                            <textarea 
                                className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm h-64 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition shadow-sm text-gray-700 placeholder-gray-300"
                                value={adjustmentRequest}
                                onChange={(e) => setAdjustmentRequest(e.target.value)}
                                placeholder="Ex: Gostaria que o robô respondesse mais rápido sobre preços..."
                            />
                        </div>
                    </div>

                    <div className="p-6 border-t border-gray-100 bg-white">
                        <button 
                            onClick={handleSendAdjustment}
                            disabled={sendingRequest || !adjustmentRequest.trim()}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-purple-200 transform hover:-translate-y-0.5"
                        >
                            {sendingRequest ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Enviando...
                                </>
                            ) : (
                                <>Enviar para Análise <Sparkles size={16}/></>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};