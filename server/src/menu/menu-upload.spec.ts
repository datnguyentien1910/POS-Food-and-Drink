import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { menuUploadDir, uploadRootDir } from './menu-upload.js';

const ORIGINAL = process.env.UPLOAD_DIR;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.UPLOAD_DIR;
  } else {
    process.env.UPLOAD_DIR = ORIGINAL;
  }
});

describe('uploadRootDir', () => {
  it('defaults to <cwd>/uploads when UPLOAD_DIR is unset', () => {
    delete process.env.UPLOAD_DIR;

    expect(uploadRootDir()).toBe(path.join(process.cwd(), 'uploads'));
  });

  it('uses a configured UPLOAD_DIR', () => {
    process.env.UPLOAD_DIR = '/tmp/restodash-uploads';

    expect(uploadRootDir()).toBe('/tmp/restodash-uploads');
    expect(menuUploadDir()).toBe(path.join('/tmp/restodash-uploads', 'menu'));
  });

  it('treats a blank UPLOAD_DIR as unset', () => {
    process.env.UPLOAD_DIR = '   ';

    expect(uploadRootDir()).toBe(path.join(process.cwd(), 'uploads'));
  });
});
