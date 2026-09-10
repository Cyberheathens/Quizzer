import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { nanoid } from 'nanoid';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRoomCode(): string {
  return nanoid(6).toUpperCase().replace(/[^A-Z0-9]/g, '0').slice(0, 6);
}

export function generateSessionId(): string {
  return `sess_${nanoid(24)}`;
}

export function getSessionId(): string {
  const key = 'engage_session_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateSessionId();
    localStorage.setItem(key, id);
  }
  return id;
}

export function getDisplayName(): string {
  return localStorage.getItem('engage_display_name') || '';
}

export function setDisplayName(name: string) {
  localStorage.setItem('engage_display_name', name);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
