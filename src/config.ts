import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  storageDir: path.resolve(__dirname, '../storage'),
  jobsDir: path.resolve(__dirname, '../storage/jobs'),
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '2', 10),
  masterSecret: process.env.REPLICATOR_MASTER_SECRET || 'repl_sec_dev_key_2026',
  crawler: {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    defaultViewport: { width: 1440, height: 900 },
    mobileViewport: { width: 390, height: 844 },
    defaultTimeoutMs: 60000,
    scrollWaitMs: 800,
    settleWaitMs: 1500,
  },
  classification: {
    minSectionHeight: 60,
    confidenceThreshold: 0.35,
  }
};
