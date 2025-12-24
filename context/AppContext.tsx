import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { GlobalState, User, Message, Stats, CRMData } from '../types';
import { INITIAL_STATS, WEBHOOK_URL } from '../constants';
import { buscarDados, extrairDadosDoJSON } from '../services/api';
import { getTimestampMs, playNotificationSound, getMsgRole, extrairTexto } from '../services/utils';

interface AppContextProps extends GlobalState {
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  setFiltroStatus: (status: string) => void;
  setFiltroEtiqueta: (tag: string) => void;
  setFiltroConversa: (val: string) => void;
  markAsRead: (id: string) => void;
  saveCRMData: (id: string, field: keyof CRMData, value: any) => void;
  getCRMData: (id: string) => CRMData;
  toggleIA: (action: string, id: string) => Promise<void>;
  toggleIAGlobal: () => Promise<void>;
  sendTrainingMessage: (text: string) => void;
  clearTraining: () => void;
  updateLocalState: (updates: Partial<GlobalState>) => void;
  refreshData: () => Promise<void>;
  setConversaSelecionada: (id: string | null) => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GlobalState>({
    logado: false, user: null, msgs: [], clientes: [], pendingMsgs: [],
    listaOficialHumano: [], listaOficialIA: [], etiquetasDisponiveis: [], tagIdMap: {}, chatTagsMap: {},
    leadNames: {}, recentNameEdits: {}, recentlyDeleted: {}, whatsappName: '',
    whatsappStatus: 'disconnected', stats: INITIAL_STATS, atualizando: false,
    iaGlobalmentePausada: false, abaAtendimentosVisivel: true, abaLeadsVisivel: true,
    treinamentoMsgs: [], webhookTeste: null, toggleProcessing: {}
  });

  const [filtroStatus, setFiltroStatusState] = useState('todos');
  const [filtroEtiqueta, setFiltroEtiquetaState] = useState('');
  const [filtroConversa, setFiltroConversa] = useState('');
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);
  const [readState, setReadState] = useState<Record<string, number>>({});

  const stateRef = useRef(state); // Ref for interval access
  stateRef.current = state;

  // Local Storage for CRM
  const getCRMData = (id: string): CRMData => {
    const store = localStorage.getItem('crm_data');
    const data = store ? JSON.parse(store) : {};
    return data[id] || { stage: 'Novo Lead', tags: [], notes: '', email: '', nome: '' };
  };

  const saveCRMData = (id: string, field: keyof CRMData, value: any) => {
    const store = localStorage.getItem('crm_data');
    let data = store ? JSON.parse(store) : {};
    if (!data[id]) data[id] = { stage: 'Novo Lead', tags: [], notes: '', email: '', nome: '' };
    data[id][field] = value;
    localStorage.setItem('crm_data', JSON.stringify(data));
    setState(prev => ({ ...prev })); // Force update
  };

  const markAsRead = (id: string) => {
    if (!id) return;
    const newState = { ...readState, [id]: Date.now() };
    setReadState(newState);
    localStorage.setItem('chat_read_state', JSON.stringify(newState));
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedRead = localStorage.getItem('chat_read_state');
    const savedWebhook = localStorage.getItem('webhook_teste');
    if (savedRead) setReadState(JSON.parse(savedRead));
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setState(prev => ({ ...prev, user, logado: true, webhookTeste: savedWebhook || null }));
      refreshData();
    }
  }, []);

  const login = async (email: string, senha: string) => {
    const r = await buscarDados('login', { email, senha });
    let userData: User | null = null;
    if (Array.isArray(r) && r.length > 0 && r[0].email === email && r[0].senha === senha) userData = r[0];
    else if (r && !Array.isArray(r) && r.email === email && r.senha === senha) userData = r;

    if (userData) {
      localStorage.setItem('user', JSON.stringify({ nome: userData.nome, email }));
      if (userData.webhook_teste) {
          localStorage.setItem('webhook_teste', userData.webhook_teste);
      }
      setState(prev => ({ ...prev, logado: true, user: { nome: userData!.nome, email, webhookTeste: userData!.webhook_teste }, webhookTeste: userData!.webhook_teste || null }));
      await refreshData();
    } else {
      throw new Error('Credenciais inválidas.');
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('webhook_teste');
    setState(prev => ({ ...prev, logado: false, user: null }));
  };

  const calculateStats = (msgs: Message[]) => {
      // Basic Stats Calculation Implementation
      const uniqueIds = [...new Set(msgs.map(msg => msg.remotejid))];
      const countIA = state.listaOficialIA.length;
      const countHumano = state.listaOficialHumano.length;
      
      let countMsgIA = 0, countMsgHuman = 0;
      let fora = 0;
      const vol = Array(24).fill(0);

      msgs.forEach(m => {
          const role = getMsgRole(m);
          if (role !== 'user') {
              if (m.msg_da_IA) countMsgIA++; else countMsgHuman++;
          }
          if (m.timestamp) {
              const d = new Date(m.timestamp);
              const hr = d.getHours();
              const dy = d.getDay();
              if (hr >= 0 && hr < 24) vol[hr]++;
              if (dy === 0 || dy === 6 || hr < 8 || hr >= 18) fora++;
          }
      });
      const totalRespostas = countMsgIA + countMsgHuman;
      const taxaAutomacao = totalRespostas > 0 ? Math.round((countMsgIA / totalRespostas) * 100) : 0;
      const minutosTotal = msgs.filter(m => m.msg_da_IA).length * 2;
      const tempoEconomizado = minutosTotal < 60 ? `${minutosTotal} min` : `${Math.floor(minutosTotal/60)}h ${minutosTotal%60}m`;

      return {
          ...INITIAL_STATS,
          conversasTotal: uniqueIds.length,
          totalMsgs: msgs.length,
          taxaAutomacao,
          tempoEconomizado,
          foraHorario: fora,
          volumePorHora: vol
      };
  };

  const refreshData = async () => {
    if (!stateRef.current.logado || stateRef.current.atualizando) return;
    setState(prev => ({ ...prev, atualizando: true }));
    try {
      const resp = await buscarDados('login', { email: stateRef.current.user?.email });
      if (resp === 'continua') { setState(prev => ({ ...prev, atualizando: false })); return; }
      
      const extracted = extrairDadosDoJSON(resp, stateRef.current);
      
      // Filter out deleted
      const validMsgs = extracted.msgs.filter(m => !stateRef.current.recentlyDeleted[m.remotejid]);

      // Sync Names
      Object.entries(extracted.namesMap).forEach(([id, name]) => {
          if (stateRef.current.recentNameEdits[id] && Date.now() - stateRef.current.recentNameEdits[id] < 30000) return;
          const current = getCRMData(id);
          if (name !== current.nome) saveCRMData(id, 'nome', name);
      });

      // Sync Notes
      Object.entries(extracted.anotacoesMap).forEach(([id, note]) => {
         const current = getCRMData(id);
         if (current.notes !== note) saveCRMData(id, 'notes', note);
      });

      // Sync Tags
      Object.entries(extracted.chatTagsMap).forEach(([id, tags]) => {
          const current = getCRMData(id);
          const sortedCurrent = [...current.tags].sort();
          const sortedNew = [...tags].sort();
          if (JSON.stringify(sortedCurrent) !== JSON.stringify(sortedNew)) saveCRMData(id, 'tags', tags);
      });

      const newStats = calculateStats(validMsgs);

      // Check Notifications
      const lastMax = Math.max(...stateRef.current.msgs.map(m => getTimestampMs(m.timestamp)));
      const newMax = Math.max(...validMsgs.map(m => getTimestampMs(m.timestamp)));
      if (newMax > lastMax) {
          const hasNewUser = validMsgs.some(m => getMsgRole(m) === 'user' && getTimestampMs(m.timestamp) > lastMax);
          if(hasNewUser) playNotificationSound();
      }

      setState(prev => ({
          ...prev,
          msgs: validMsgs,
          clientes: [...new Set(validMsgs.map(m => m.remotejid))],
          listaOficialHumano: extracted.idsHumano,
          listaOficialIA: extracted.idsIA,
          whatsappStatus: extracted.status,
          iaGlobalmentePausada: extracted.iaPausada,
          abaAtendimentosVisivel: extracted.abaAtendimentos,
          abaLeadsVisivel: extracted.abaLeads,
          etiquetasDisponiveis: extracted.availableTags,
          tagIdMap: extracted.tagIdMap,
          chatTagsMap: extracted.chatTagsMap,
          stats: newStats,
          atualizando: false,
          treinamentoMsgs: extracted.treinoHistory && extracted.treinoHistory.length > 0 ? extracted.treinoHistory : prev.treinamentoMsgs
      }));

    } catch (e) {
      console.error(e);
      setState(prev => ({ ...prev, atualizando: false }));
    }
  };

  useEffect(() => {
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleIA = async (action: string, id: string) => {
    // Optimistic Update handled by component logic visually
    try {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action, remotejid: id, email: state.user?.email })
        });
        await refreshData();
    } catch(e) { console.error(e); }
  };

  const toggleIAGlobal = async () => {
    const action = state.iaGlobalmentePausada ? 'ativar_ia_total' : 'pausar_ia_total';
    // Optimistic toggle
    setState(prev => ({ ...prev, toggleProcessing: { ...prev.toggleProcessing, 'GLOBAL': { targetPaused: !state.iaGlobalmentePausada, timestamp: Date.now() }} }));
    try {
        await buscarDados(action, { email: state.user?.email });
        await refreshData();
    } catch(e) { console.error(e); }
  };

  const sendTrainingMessage = async (text: string) => {
      // Optimistic add
      const msg: Message = { 
        text, 
        sender: 'user', 
        timestamp: Date.now(), 
        time: new Date().toLocaleTimeString(), 
        status: 'sent',
        remotejid: state.user?.email || 'test-user'
      };
      setState(prev => ({ ...prev, treinamentoMsgs: [...prev.treinamentoMsgs, msg] }));
      
      const payload = {
        "BaseUrl": "https://training.radar.ia", "EventType": "messages",
        "chat": { "id": state.user?.email, "owner": state.user?.email, "wa_contactName": "User", "wa_name": "User" },
        "message": { "chatid": state.user?.email, "content": text, "fromMe": false, "id": 'TR-'+Date.now(), "messageTimestamp": Date.now(), "text": text, "type": "text", "sender": state.user?.email },
        "owner": state.user?.email, "is_test": true, "action": "chat_treinamento", "email": state.user?.email
      };

      const url = state.webhookTeste && state.webhookTeste !== "undefined" ? state.webhookTeste : WEBHOOK_URL;
      fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
  };

  const clearTraining = async () => {
      setState(prev => ({ ...prev, treinamentoMsgs: [] }));
      const email = state.user?.email;
      const payload = { "action": "limpar_conversa", "email": email, "is_test": true, "owner": email };
      const url = state.webhookTeste && state.webhookTeste !== "undefined" ? state.webhookTeste : WEBHOOK_URL;
      fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
  };

  const updateLocalState = (updates: Partial<GlobalState>) => {
      setState(prev => ({ ...prev, ...updates }));
  };

  return (
    <AppContext.Provider value={{
      ...state, login, logout, setFiltroStatus: setFiltroStatusState,
      setFiltroEtiqueta: setFiltroEtiquetaState, setFiltroConversa, markAsRead,
      saveCRMData, getCRMData, toggleIA, toggleIAGlobal, sendTrainingMessage, clearTraining, updateLocalState, refreshData,
      setConversaSelecionada
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};