import { getChaveLocal } from "./storage.js";
import { localDate } from "./db.js";
import { atualizarRota } from "./navegacao.js";
import { atualizarConta } from "./conta.js";
// app.js — v2 layout: hero donut, macro bars, mini chart, FAB, timeline, receipt
export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

export const CREDITO_DESENVOLVEDOR = 'ZanonApps';

export const TEMA_PADRAO = 'azul';

export const TEMAS = [
  { id: 'azul',           label: 'Azul',           swatch: ['#0B1E3F', '#2563EB', '#60A5FA'] },
  { id: 'vibrante',       label: 'Vibrante',       swatch: ['#00D68F', '#3B82F6', '#FF6B6B'] },
  { id: 'caveira',        label: 'Caveira',        swatch: ['#0A0A0A', '#8B0000', '#FF1F1F'] },
  { id: 'vulcao',         label: 'Vulcão',         swatch: ['#1A0F0A', '#F97316', '#DC2626'] },
  { id: 'gelo',           label: 'Gelo',           swatch: ['#F0F8FF', '#BAE6FD', '#94A3B8'] },
  { id: 'arcoiris',       label: 'Arco-íris',      swatch: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#A855F7'] },
  { id: 'oceano',         label: 'Oceano',         swatch: ['#0C2A47', '#0E7490', '#22D3EE'] },
  { id: 'porDoSol',       label: 'Pôr do Sol',     swatch: ['#7C2D12', '#F97316', '#EC4899', '#7C3AED'] },
  { id: 'floresta',       label: 'Floresta',       swatch: ['#1B2A1A', '#166534', '#92400E'] },
  { id: 'minimalista',    label: 'Minimalista',    swatch: ['#FFFFFF', '#E5E7EB', '#111827'] },
];

export const estado = {
  currentImage: null,
  currentAnalysis: null,
  imagemDaAnalise: null,
  chartsExpanded: false,
  captureMode: 'photo', // 'photo' | 'text'
};

// ============ BOWL LOADER TEXT ROTATION ============
export const MENSAGENS_ANALISE = [
  'Analisando sua refeicao...',
  'Identificando os alimentos...',
  'Calculando os macros...',
  'Quase pronto...',
];
export const MENSAGENS_PLANO = [
  'Gerando seu plano...',
  'Calculando suas calorias...',
  'Montando as refeicoes...',
  'Quase pronto...',
];
export const _bowlTimers = [];

export function iniciarMensagemProcessamento(textElId, messages) {
  encerrarMensagemProcessamento();
  const el = $(textElId);
  if (!el) return;
  let idx = 0;
  el.textContent = messages[0];
  el.classList.remove('fade');
  const tid = setInterval(() => {
    el.classList.add('fade');
    setTimeout(() => {
      idx = (idx + 1) % messages.length;
      el.textContent = messages[idx];
      el.classList.remove('fade');
    }, 300);
  }, 1500);
  _bowlTimers.push(tid);
}

export function encerrarMensagemProcessamento() {
  _bowlTimers.forEach(id => clearInterval(id));
  _bowlTimers.length = 0;
}

// ============ THEME ============
export function temaValido(id) { return TEMAS.some(t => t.id === id); }
export function obterTema() {
  const saved = localStorage.getItem(getChaveLocal('nutrifoto.theme'));
  return temaValido(saved) ? saved : TEMA_PADRAO;
}
export function definirTema(t) {
  if (!temaValido(t)) t = TEMA_PADRAO;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(getChaveLocal('nutrifoto.theme'), t);
}
export function alternarTema() {
  const indice=TEMAS.findIndex(tema=>tema.id===obterTema());definirTema(TEMAS[(indice+1)%TEMAS.length].id);
  document.dispatchEvent(new Event('nutrifoto:atualizar'));
}

// ============ NAVIGATION ============
export function mostrarTela(name) {
  if (name === 'conta' || name === 'assinatura') name = 'ativacao';
  atualizarRota(name);
  if (name === 'conta' || name === 'privacidade') atualizarConta();
  $$('.screen').forEach(s => s.classList.remove('active'));
  const screen = $(`#screen-${name}`);
  if (screen) screen.classList.add('active');
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));

  const nav = $('.nav');
  const fab = $('.fab');
  const isOverlay = name === 'capture' || name === 'results';
  nav.style.display = isOverlay ? 'none' : 'flex';
  if (fab) fab.style.display = name === 'dashboard' ? 'flex' : 'none';
  document.querySelector('#water-modal-overlay').style.display='none';

  document.dispatchEvent(new CustomEvent('nutrifoto:tela',{detail:name}));
  if (window.lucide) lucide.createIcons();
}

// ============ TOAST ============
export function avisar(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ============ CONFIRMATION ============
export function mostrarConfirmacao() {
  const o = $('#confirm-overlay');
  o.style.display = 'flex';
  setTimeout(() => { o.style.display = 'none'; }, 1400);
}

// ============ HELPERS ============
export function formatarHorario(iso) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
export function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
export function escaparHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function obterDiaAtual() {
  return localDate();
}

export const CHAVE_LEMBRETES = 'nutrifoto.notify';
export const VERSAO_APLICATIVO = '0.3.4';

// PLACEHOLDER: secao futura "Comunidade / Social"
// Quando for implementada, adicionar um novo <div class="settings-card">
// nesta posicao do array de cards em screen-settings (entre "Tema visual"
// e "Sobre o app", ou onde fizer mais sentido no produto).
// Sugestoes de UI para essa secao:
//   - Feed de refeicoes publicas de outros usuarios
//   - Compartilhar refeicao com foto + macros
//   - Seguir amigos / ver streaks deles
//   - Desafios semanais (ex: 7 dias semanais completos)
//   - Reacoes/comentarios
// Por enquanto NAO adicionar nenhum elemento visivel aqui — apenas
// manter este comentario para marcar o local de insercao futura.

export const LEMBRETES_PADRAO = {
  meals: [],
  streakEnabled: false,
  streakTime: '20:00',
};

export function lerLembretes() {
  try {
    const raw = localStorage.getItem(getChaveLocal(CHAVE_LEMBRETES));
    if (!raw) return { ...LEMBRETES_PADRAO };
    return { ...LEMBRETES_PADRAO, ...JSON.parse(raw) };
  } catch {
    return { ...LEMBRETES_PADRAO };
  }
}

export function salvarLembretes(prefs) {
  localStorage.setItem(getChaveLocal(CHAVE_LEMBRETES), JSON.stringify(prefs));
}

