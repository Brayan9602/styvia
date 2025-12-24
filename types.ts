export interface User {
  nome: string;
  email: string;
  webhook_teste?: string;
}

export interface Message {
  remotejid: string;
  text?: string;
  conversation_history?: any;
  timestamp: number | string;
  msg_da_IA?: boolean | string | number;
  role?: string;
  type?: 'text' | 'image' | 'video' | 'audio';
  nao_mostrar?: boolean;
  pending?: boolean;
  id?: string;
  sender?: string;
  status?: 'sent' | 'delivered' | 'read';
  time?: string;
}

export interface CRMData {
  stage: string;
  tags: string[];
  notes: string;
  email: string;
  nome: string;
}

export interface ConversationSummary {
  id: string;
  last: Message;
  count: number;
  unread: number;
}

export interface Stats {
  conversasTotal: number;
  conversasHoje: number;
  conversasSemana: number;
  conversasMes: number;
  totalMsgs: number;
  taxaAutomacao: number;
  tempoEconomizado: string;
  inicioPeriodo: string;
  foraHorario: number;
  tempoMedioResposta: string;
  volumePorHora: number[];
  topDuvidas: { nome: string; percentual: number }[];
}

export interface GlobalState {
  logado: boolean;
  user: User | null;
  msgs: Message[];
  clientes: string[];
  pendingMsgs: Message[];
  listaOficialHumano: string[];
  listaOficialIA: string[];
  etiquetasDisponiveis: string[];
  tagIdMap: Record<string, string>;
  chatTagsMap: Record<string, string[]>;
  leadNames: Record<string, string>;
  recentNameEdits: Record<string, number>;
  recentlyDeleted: Record<string, number>;
  whatsappName: string;
  whatsappStatus: string;
  stats: Stats;
  atualizando: boolean;
  iaGlobalmentePausada: boolean;
  abaAtendimentosVisivel: boolean;
  abaLeadsVisivel: boolean;
  treinamentoMsgs: Message[];
  webhookTeste: string | null;
  toggleProcessing: Record<string, { targetIA?: boolean; targetPaused?: boolean; timestamp: number }>;
}