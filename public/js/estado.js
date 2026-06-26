const estado = {
  token: localStorage.getItem('mei_token') || '',
  usuario: null, empresa: null, assinatura: null, notificacoes: [], legal: null,
  aba: localStorage.getItem('mei_aba') || 'dashboard',
  modoAutenticacao: 'login', modal: null, carregando: false, midiaModal: null, perfilModal: null, notificacaoAberta: false,
  filtroChamados: localStorage.getItem('mei_filtro_chamados') || 'todos',
  subAbaSuporte: localStorage.getItem('mei_suba_suporte') || 'fila',
  dashboard: null, lancamentos: [], obrigacoes: [], chamados: [], chamadoAtual: null, mensagens: [], infoFila: null,
  metricas: null, usuarios: [], editandoUsuario: null, avaliacoes: [], ranking: [],
  chatEquipeAberto: false, usuariosEquipe: [], conversasEquipe: [], mensagensEquipe: [], conversaEquipeAtual: null,
  barraRecolhida: localStorage.getItem('mei_barra') === 'recolhida',
  flutuanteAberto: false,
  usuarioDetalhe: null, sinalizacoesUsuario: [],
  notificarModalAberto: false, notificarUsuarioId: null
};
