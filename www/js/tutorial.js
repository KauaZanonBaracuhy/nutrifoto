import { getChaveLocal } from "./storage.js";
import { $, $$ } from "./base.js";
// ============ ONBOARDING ============
export const ONBOARDING_KEY = 'nutrifoto.onboardingCompleto';

export function tutorialConcluido() {
  return localStorage.getItem(getChaveLocal(ONBOARDING_KEY)) === '1';
}

export function concluirTutorial() {
  localStorage.setItem(getChaveLocal(ONBOARDING_KEY), '1');
  ocultarTutorial();
}

export function mostrarTutorial() {
  const overlay = $('#screen-onboarding');
  if (!overlay) return;
  overlay.style.display = 'flex';
  definirPassoTutorial(1);
  if (window.lucide) lucide.createIcons();
}

export function ocultarTutorial() {
  const overlay = $('#screen-onboarding');
  if (!overlay) return;
  overlay.style.display = 'none';
}

export function definirPassoTutorial(step) {
  $$('.onboarding-step').forEach(el => el.classList.remove('active'));
  $$('.onboarding-dot').forEach(el => el.classList.remove('active'));
  const stepEl = $(`#onboarding-step-${step}`);
  const dotEl = $(`.onboarding-dot[data-step="${step}"]`);
  if (stepEl) stepEl.classList.add('active');
  if (dotEl) dotEl.classList.add('active');
}

export function avancarTutorial() {
  const current = document.querySelector('.onboarding-step.active');
  if (!current) return;
  const step = Number(current.id.split('-').pop());
  if (step < 3) definirPassoTutorial(step + 1);
}

export function voltarTutorial() {
  const current = document.querySelector('.onboarding-step.active');
  if (!current) return;
  const step = Number(current.id.split('-').pop());
  if (step > 1) definirPassoTutorial(step - 1);
}

export function reabrirTutorial() {
  mostrarTutorial();
}

// Touch/swipe support for onboarding
export let onboardingTouchStartX = 0;
export function vincularGestosTutorial() {
  const content = $('.onboarding-content');
  if (!content) return;
  content.addEventListener('touchstart', e => {
    onboardingTouchStartX = e.touches[0].clientX;
  }, { passive: true });
  content.addEventListener('touchend', e => {
    const endX = e.changedTouches[0].clientX;
    const diff = endX - onboardingTouchStartX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) voltarTutorial();
      else avancarTutorial();
    }
  }, { passive: true });
}

// ============ INIT ============
