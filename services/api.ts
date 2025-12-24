import { WEBHOOK_URL } from '../constants';
import { Message, Stats, User } from '../types';
import { getTimestampMs, getMsgRole, extrairTexto } from './utils';

export async function buscarDados(action: string, params: any = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, params: params }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text.trim() === 'continua') return 'continua';
    try { return JSON.parse(text); } catch { return text; }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Erro buscarDados:", error);
    throw error;
  }
}

// Helper to deep search IDs
function deepSearchIds(obj: any, foundIA: string[], foundHumano: string[], namesMap: Record<string, string>) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
        obj.forEach(item => deepSearchIds(item, foundIA, foundHumano, namesMap));
        return;
    }
    if (obj.nome_lead) {
        const id = obj.IA || obj.remotejid_ia || obj.Atendente || obj.remotejid_atendente;
        if (id) {
            const clean = String(id).replace(/['"\[\]\s]/g, '').trim();
            if (clean.includes('@')) namesMap[clean] = obj.nome_lead;
        }
    }
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            const lowerKey = key.toLowerCase();
            if (lowerKey === 'ia' || lowerKey.includes('remotejid_ia')) {
                processIdValue(val, foundIA);
            } else if (lowerKey === 'atendente' || lowerKey.includes('remotejid_atendente')) {
                processIdValue(val, foundHumano);
            } else if (typeof val === 'object') {
                deepSearchIds(val, foundIA, foundHumano, namesMap);
            }
        }
    }
}

function processIdValue(value: any, targetArray: string[]) {
    if (!value) return;
    const strVal = String(value);
    const parts = strVal.split(/[,;]+/);
    parts.forEach(p => {
        const clean = p.replace(/['"\[\]\s]/g, '').trim();
        if (clean.includes('@')) { targetArray.push(clean); }
    });
}

export function extrairDadosDoJSON(data: any, currentState: any) {
    let msgs: Message[] = [];
    let status = 'disconnected';
    let idsIA: string[] = [];
    let idsHumano: string[] = [];
    let iaPausada = currentState.iaGlobalmentePausada;
    let abaAtendimentos = currentState.abaAtendimentosVisivel;
    let abaLeads = currentState.abaLeadsVisivel;
    let etiquetasMap: Record<string, string> = {};
    let availableTags: string[] = [];
    let chatTagsMap: Record<string, string[]> = {};
    let namesMap: Record<string, string> = {};
    let anotacoesMap: Record<string, string> = {};
    let whatsappName = '';
    let treinoHistory: any[] = [];
    let webhookTeste = currentState.webhookTeste;

    const normalizarMsg = (m: any): Message => {
        const ts = m.timestamp || m.timestemp || null;
        let isIA = m.msg_da_IA;
        if (typeof isIA === 'string') isIA = isIA.toLowerCase() === 'true';
        if (typeof isIA === 'number') isIA = isIA === 1;
        return { ...m, timestamp: ts, msg_da_IA: isIA, nao_mostrar: m.nao_mostrar };
    };
    const toBoolean = (value: any) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return false;
    };

    const dataArray = Array.isArray(data) ? data : (data && typeof data === 'object' ? [data] : []);

    // Pass 1: Metadata
    dataArray.forEach(item => {
        if (item.webhook_teste) webhookTeste = item.webhook_teste;
        if (item.nome_whatsapp) whatsappName = item.nome_whatsapp;

        if (item.identificao_etiquetas) {
            try {
                const raw = typeof item.identificao_etiquetas === 'string' ? JSON.parse(item.identificao_etiquetas) : item.identificao_etiquetas;
                if(Array.isArray(raw)) {
                    raw.forEach(tStr => {
                        try {
                            const t = typeof tStr === 'string' ? JSON.parse(tStr) : tStr;
                            if(t.id && t.name) {
                                etiquetasMap[t.id] = t.name;
                                if(!availableTags.includes(t.name)) availableTags.push(t.name);
                            }
                        } catch {}
                    });
                }
            } catch {}
        }

        // Anotacoes
        if (item.status_de_atendimento || item.anotacoes) {
            const raw = item.status_de_atendimento || item.anotacoes;
            try {
                 const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                 if (Array.isArray(parsed)) {
                     parsed.forEach((obj: any) => {
                         let id = obj.remotejid || obj.id || obj.chat_id || obj.Atendente || obj.IA;
                         if (id && typeof id === 'string' && id.includes('@')) {
                             const note = obj.anotacao || obj.text || obj.note || obj.content || obj.anotacoes;
                             anotacoesMap[id] = (note === undefined || note === null) ? "" : String(note);
                         }
                     });
                 }
            } catch {}
        }
        
        // Treino History
        if (item.chat_treinamento) {
            try {
                let rawHist = item.chat_treinamento;
                if (typeof rawHist === 'string') rawHist = JSON.parse(rawHist);
                if (Array.isArray(rawHist)) {
                    treinoHistory = rawHist.map((h: any) => {
                        let content = '';
                        let role = h.role;
                        let ch = h.conversation_history;
                        if(typeof ch === 'string') try { ch = JSON.parse(ch); } catch {}
                        if(ch && typeof ch === 'object') {
                             if (ch.role) role = ch.role;
                             if(ch.parts && Array.isArray(ch.parts) && ch.parts.length > 0) content = ch.parts[0].text;
                             else if(ch.text) content = ch.text;
                             else if (ch.content) content = ch.content;
                        }
                        if (!content) content = h.text || h.content || h.message?.conversation;
                        if (!role && h.msg_da_IA === true) role = 'assistant';
                        if (h.fromMe) role = 'assistant';
                        if (!role) role = 'unknown';
                        const isUser = (role === 'user' || role === 'human');
                        return {
                            text: content,
                            sender: isUser ? 'user' : 'bot',
                            time: new Date().toLocaleTimeString(),
                            timestamp: h.timestamp || h.messageTimestamp,
                            status: 'read'
                        };
                    }).filter(m => m.text && m.text !== 'Sem texto');
                }
            } catch {}
        }
    });

    // Pass 2: Data
    dataArray.forEach(item => {
        if (item.conversas && Array.isArray(item.conversas)) {
            msgs = [...msgs, ...item.conversas.map(normalizarMsg)];
        }
        const currentStatus = item.status_da_coneccao || item.status;
        if (currentStatus && typeof currentStatus === 'string' && !currentStatus.trim().startsWith('[')) {
            status = (currentStatus.toLowerCase() === 'open' || currentStatus.toLowerCase() === 'connected') ? 'connected' : currentStatus.toLowerCase();
        }
        if (Object.prototype.hasOwnProperty.call(item, 'pausar_ia_total')) iaPausada = toBoolean(item.pausar_ia_total);
        if (Object.prototype.hasOwnProperty.call(item, 'aba_atendimentos')) abaAtendimentos = toBoolean(item.aba_atendimentos);
        if (Object.prototype.hasOwnProperty.call(item, 'aba_leads')) abaLeads = toBoolean(item.aba_leads);

        if (item.numero_e_etiquetas) {
             try {
                const raw = Array.isArray(item.numero_e_etiquetas) ? item.numero_e_etiquetas : [];
                raw.forEach((entry: any) => {
                    let chat: string | null = null;
                    let tagId: string | null = null;
                    if(typeof entry === 'object') {
                         Object.keys(entry).forEach(k => {
                            if(k.endsWith('.wa_label')) tagId = entry[k];
                            if(k.endsWith('.wa_chatid')) chat = entry[k];
                         });
                    }
                    if (chat && tagId && etiquetasMap[tagId]) {
                        if (!chatTagsMap[chat]) chatTagsMap[chat] = [];
                        const tagName = etiquetasMap[tagId];
                        if (!chatTagsMap[chat].includes(tagName)) chatTagsMap[chat].push(tagName);
                    }
                });
             } catch {}
        }
        deepSearchIds(item, idsIA, idsHumano, namesMap);
    });

    // Tag ID Map
    const tagIdMap: Record<string, string> = {};
    Object.entries(etiquetasMap).forEach(([id, name]) => {
        tagIdMap[name] = id;
    });

    return {
        msgs, status, idsIA, idsHumano, iaPausada, abaAtendimentos, abaLeads,
        availableTags, chatTagsMap, namesMap, anotacoesMap, whatsappName, treinoHistory,
        webhookTeste, tagIdMap
    };
}
