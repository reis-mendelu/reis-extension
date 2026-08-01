import { describe, it, expect } from 'vitest';
import { localizedCourseName, localizedRoom } from '../localizedLesson';
import { makeLesson as lesson } from '../../test/fixtures/lesson';

describe('localizedCourseName', () => {
  it('CZ mode: prefers courseNameCs over the base field', () => {
    const l = lesson({ courseName: 'base', courseNameCs: 'cz-name', courseNameEn: 'en-name' });
    expect(localizedCourseName(l, 'cz')).toBe('cz-name');
  });

  it('EN mode: prefers courseNameEn when present', () => {
    const l = lesson({ courseName: 'base', courseNameCs: 'cz-name', courseNameEn: 'en-name' });
    expect(localizedCourseName(l, 'en')).toBe('en-name');
  });

  it('EN mode: falls back to courseNameCs when courseNameEn is missing (the AgendaEvent bug this replaces)', () => {
    const l = lesson({ courseName: 'base', courseNameCs: 'cz-name', courseNameEn: undefined });
    expect(localizedCourseName(l, 'en')).toBe('cz-name');
  });

  it('EN mode: falls back to courseNameCs when courseNameEn is an empty string', () => {
    const l = lesson({ courseName: 'base', courseNameCs: 'cz-name', courseNameEn: '' });
    expect(localizedCourseName(l, 'en')).toBe('cz-name');
  });

  it('falls back to the base field when neither localized variant is present', () => {
    const l = lesson({ courseName: 'base', courseNameCs: undefined, courseNameEn: undefined });
    expect(localizedCourseName(l, 'en')).toBe('base');
    expect(localizedCourseName(l, 'cz')).toBe('base');
  });

  it('falls back to the base field when courseNameCs is an empty string', () => {
    const l = lesson({ courseName: 'base', courseNameCs: '' });
    expect(localizedCourseName(l, 'cz')).toBe('base');
  });
});

describe('localizedRoom', () => {
  it('CZ mode: prefers roomCs over the base field', () => {
    const l = lesson({ room: 'base', roomCs: 'cz-room', roomEn: 'en-room' });
    expect(localizedRoom(l, 'cz')).toBe('cz-room');
  });

  it('EN mode: prefers roomEn when present', () => {
    const l = lesson({ room: 'base', roomCs: 'cz-room', roomEn: 'en-room' });
    expect(localizedRoom(l, 'en')).toBe('en-room');
  });

  it('EN mode: falls back to roomCs when roomEn is missing', () => {
    const l = lesson({ room: 'base', roomCs: 'cz-room', roomEn: undefined });
    expect(localizedRoom(l, 'en')).toBe('cz-room');
  });

  it('falls back to the base field when neither localized variant is present', () => {
    const l = lesson({ room: 'base', roomCs: undefined, roomEn: undefined });
    expect(localizedRoom(l, 'en')).toBe('base');
  });
});
