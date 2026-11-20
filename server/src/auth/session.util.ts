import type { SessionWithData } from './session.types.js';

export function persistSession(session: SessionWithData): Promise<void> {
  return new Promise((resolve, reject) => {
    session.save((error?: unknown) => (error ? reject(error) : resolve()));
  });
}

export function regenerateSession(session: SessionWithData): Promise<void> {
  return new Promise((resolve, reject) => {
    session.regenerate((error?: unknown) =>
      error ? reject(error) : resolve(),
    );
  });
}

export function destroySession(session: SessionWithData): Promise<void> {
  return new Promise((resolve) => {
    session.destroy(() => resolve());
  });
}
