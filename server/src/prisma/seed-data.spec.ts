import { describe, expect, it } from 'vitest';
import {
  SEED_CATEGORIES,
  SEED_MENU_ITEMS,
  SEED_RESTAURANT,
  SEED_TABLES,
  SEED_USERS,
} from './seed-data.js';

describe('SEED_RESTAURANT', () => {
  it('matches the approved restaurant settings', () => {
    expect(SEED_RESTAURANT.slug).toBe('restodash');
    expect(SEED_RESTAURANT.taxRateBps).toBe(800);
    expect(SEED_RESTAURANT.currency).toBe('VND');
    expect(SEED_RESTAURANT.timezone).toBe('Asia/Ho_Chi_Minh');
  });
});

describe('SEED_CATEGORIES', () => {
  it('seeds six categories', () => {
    expect(SEED_CATEGORIES).toHaveLength(6);
  });

  it('has unique names', () => {
    const names = SEED_CATEGORIES.map((category) => category.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('SEED_MENU_ITEMS', () => {
  it('copies all 16 menu items from the frontend', () => {
    expect(SEED_MENU_ITEMS).toHaveLength(16);
  });

  it('uses unique legacy ids', () => {
    const ids = SEED_MENU_ITEMS.map((item) => item.legacyId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every item at a real category', () => {
    const categoryNames = new Set(
      SEED_CATEGORIES.map((category) => category.name),
    );
    for (const item of SEED_MENU_ITEMS) {
      expect(categoryNames.has(item.category)).toBe(true);
    }
  });

  it('gives every item a positive integer price and an image key', () => {
    for (const item of SEED_MENU_ITEMS) {
      expect(Number.isInteger(item.price)).toBe(true);
      expect(item.price).toBeGreaterThan(0);
      expect(item.imageKey.length).toBeGreaterThan(0);
    }
  });

  it('keeps the grilled chicken price in sync with the frontend', () => {
    const item = SEED_MENU_ITEMS.find((entry) => entry.legacyId === 'ga-nuong');
    expect(item).toMatchObject({
      name: 'Gà nướng',
      price: 109000,
      category: 'mains',
    });
  });
});

describe('SEED_TABLES', () => {
  it('copies all 12 tables from the frontend', () => {
    expect(SEED_TABLES).toHaveLength(12);
  });

  it('uses unique legacy ids and positive seat counts', () => {
    const ids = SEED_TABLES.map((table) => table.legacyId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const table of SEED_TABLES) {
      expect(Number.isInteger(table.seats)).toBe(true);
      expect(table.seats).toBeGreaterThan(0);
    }
  });

  it('includes ban-1', () => {
    expect(SEED_TABLES.some((table) => table.legacyId === 'ban-1')).toBe(true);
  });
});

describe('SEED_USERS', () => {
  it('seeds exactly one owner, one manager and one cashier', () => {
    const roles = SEED_USERS.map((user) => user.role).sort();
    expect(roles).toEqual(['CASHIER', 'MANAGER', 'OWNER']);
  });

  it('uses unique emails and 4-digit pins', () => {
    const emails = SEED_USERS.map((user) => user.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const user of SEED_USERS) {
      expect(user.pin).toMatch(/^\d{4}$/);
    }
  });
});
