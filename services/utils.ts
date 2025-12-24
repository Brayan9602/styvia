import { Message } from '../types';

export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) { console.error("Erro ao tocar som", e); }
}

export function getTimestampMs(ts: any): number {
  if (!ts) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'string' && /^\d+$/.test(ts)) {
    ts = parseInt(ts, 10);
  }
  if (typeof ts === 'number') {
    if (ts < 10000000000) return ts * 1000;
    return ts;
  }
  const d = new Date(ts);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

export function formatarData(ts: any): string {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(ts);
  }
}

export function extrairTexto(hist: any): string {
  if (!hist) return 'Sem texto';
  let data = hist;
  if (typeof hist === 'string') { try { data = JSON.parse(hist); } catch { return hist; } }
  if (data.parts && Array.isArray(data.parts) && data.parts[0] && data.parts[0].text) { return data.parts[0].text; }
  if (data.text) return data.text;
  if (data.content) return data.content;
  return 'Formato desconhecido';
}

export function getMsgRole(m: Message): string {
  if (m.msg_da_IA === true || String(m.msg_da_IA).toLowerCase() === 'true') {
    return 'assistant';
  }
  let role = '';
  if (typeof m.conversation_history === 'object' && m.conversation_history !== null) {
    role = m.conversation_history.role;
  } else if (typeof m.conversation_history === 'string') {
    try { role = JSON.parse(m.conversation_history).role; } catch {}
  }
  if (!role && m.role) role = m.role;
  if (!role && m.msg_da_IA === false) role = 'user';
  return role || 'unknown';
}

export function fragmentarTextoPorPontuacao(texto: string): string[] {
  if (!texto) return [texto];
  const regex = /([.!?\n]+)(\s*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}]+)*/gu;
  const partes: string[] = [];
  let cursor = 0;
  let puncCount = 0;
  let match;

  while ((match = regex.exec(texto)) !== null) {
    puncCount++;
    if (puncCount % 2 === 0) {
      const end = match.index + match[0].length;
      const frase = texto.substring(cursor, end).trim();
      if (frase) partes.push(frase);
      cursor = end;
    }
  }
  const resto = texto.substring(cursor).trim();
  if (resto) partes.push(resto);
  return partes.length > 0 ? partes : [texto];
}

export function processarPartesDaMensagem(texto: any): { type: string, html: string }[] {
    if (!texto || typeof texto !== 'string') return [{ type: 'text', html: '<p class="italic text-gray-400">Conteúdo vazio</p>' }];

    let cleanText = texto;
    cleanText = cleanText.replace(/<thoughtSignature>[\s\S]*?<\/thoughtSignature>/gi, '')
    .replace(/<functionCall>[\s\S]*?<\/functionCall>/gi, '')
    .replace(/<functionResponse>[\s\S]*?<\/functionResponse>/gi, '');
    cleanText = cleanText.replace(/referencia:[\s\S]*?(\n|$)/gi, '').trim();
    if (!cleanText && texto.length < 50) cleanText = texto.replace(/referencia:|mensagem:/gi, '').trim();
    if (!cleanText) return [{ type: 'text', html: '' }];

    const base64AudioRegex = /^base64:\s*([A-Za-z0-9+/=]+)/;
    const isBase64 = cleanText.startsWith('base64:');
    if (isBase64) {
        const base64Match = cleanText.match(base64AudioRegex);
        if (base64Match && base64Match[1]) {
            const dataUrl = `data:audio/webm;base64,${base64Match[1]}`;
            return [{ type: 'audio', html: dataUrl }];
        }
    }

    const driveAudioRegex = /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)(\/view)?/i;
    const driveMatch = cleanText.match(driveAudioRegex);
    if (driveMatch && driveMatch[1]) {
        const directUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
        return [{ type: 'audio', html: directUrl }];
    }

    const partes: any[] = [];
    const complexRegex = /<(video|audio|image)(?:[^>]*)>(.*?)<\/\1>|<template_de_resposta>([\s\S]*?)<\/template_de_resposta>/gi;
    let lastIndex = 0;
    let match;

    const formatarConteudo = (t: string) => {
        let finalTxt = t.replace(/\n/g, '<br>');
        // Links to images
        finalTxt = finalTxt.replace(/(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|bmp|tiff))(?![^<]*>)/gi, '<!--IMG:$1-->');
        // Links to videos
        finalTxt = finalTxt.replace(/(https?:\/\/\S+\.(?:mp4|webm|ogg|mov))(?![^<]*>)/gi, '<!--VID:$1-->');
         // Links to audio
        finalTxt = finalTxt.replace(/(https?:\/\/\S+\.(?:mp3|wav|mpeg|m4a|aac|oga))(?![^<]*>)/gi, '<!--AUD:$1-->');
        return finalTxt;
    };

    while ((match = complexRegex.exec(cleanText)) !== null) {
        const textBefore = cleanText.substring(lastIndex, match.index).trim();
        if (textBefore) partes.push({ type: 'text', html: formatarConteudo(textBefore) });

        if (match[3] !== undefined) {
             partes.push({ type: 'text', html: formatarConteudo(match[3]) });
        } else {
            const type = match[1].toLowerCase();
            const src = match[2].trim();
            partes.push({ type, html: src });
        }
        lastIndex = complexRegex.lastIndex;
    }

    const textAfter = cleanText.substring(lastIndex).trim();
    if (textAfter) partes.push({ type: 'text', html: formatarConteudo(textAfter) });

    return partes.length > 0 ? partes : [{ type: 'text', html: formatarConteudo(cleanText) }];
}
