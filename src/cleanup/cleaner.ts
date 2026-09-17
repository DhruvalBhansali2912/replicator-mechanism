import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { JobState } from '../types.js';

export interface CleanupResult {
  jobsPruned: number;
  bytesFreed: number;
  mbFreed: string;
}

/**
 * Recursively calculates the size of a directory in bytes
 */
export function getDirectorySize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let totalBytes = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalBytes += getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        totalBytes += stat.size;
      }
    }
  } catch {
    // Ignore transient file lock / read errors
  }
  return totalBytes;
}

/**
 * Deletes jobs and zip packages older than maxAgeHours (defaults to CONFIG.jobRetentionHours)
 */
export function cleanExpiredJobs(
  jobsMap?: Map<string, JobState>,
  maxAgeHours: number = CONFIG.jobRetentionHours
): CleanupResult {
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const now = Date.now();
  let jobsPruned = 0;
  let bytesFreed = 0;

  if (!fs.existsSync(CONFIG.jobsDir)) {
    return { jobsPruned: 0, bytesFreed: 0, mbFreed: '0.00' };
  }

  try {
    const entries = fs.readdirSync(CONFIG.jobsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const jobId = entry.name;
      const jobPath = path.join(CONFIG.jobsDir, jobId);

      let shouldDelete = false;

      // 1. Check in-memory job state if available
      if (jobsMap && jobsMap.has(jobId)) {
        const job = jobsMap.get(jobId)!;
        const jobTime = job.completedAt
          ? new Date(job.completedAt).getTime()
          : new Date(job.createdAt).getTime();
        if (now - jobTime > maxAgeMs) {
          shouldDelete = true;
        }
      } else {
        // 2. Check directory modification / creation time on disk
        try {
          const stat = fs.statSync(jobPath);
          const dirTime = Math.max(stat.mtimeMs, stat.ctimeMs);
          if (now - dirTime > maxAgeMs) {
            shouldDelete = true;
          }
        } catch {
          // If stat fails, skip
        }
      }

      if (shouldDelete) {
        const size = getDirectorySize(jobPath);
        try {
          fs.rmSync(jobPath, { recursive: true, force: true });
          bytesFreed += size;
          jobsPruned++;

          if (jobsMap && jobsMap.has(jobId)) {
            jobsMap.delete(jobId);
          }
        } catch (err: any) {
          console.error(`[Cleaner] Failed to delete expired job ${jobId}:`, err.message);
        }
      }
    }
  } catch (err: any) {
    console.error('[Cleaner] Error scanning jobs directory:', err.message);
  }

  const mbFreed = (bytesFreed / (1024 * 1024)).toFixed(2);
  if (jobsPruned > 0) {
    console.log(`🧹 [Cleaner] Pruned ${jobsPruned} expired jobs older than ${maxAgeHours}h. Freed ${mbFreed} MB of disk space.`);
  }

  return { jobsPruned, bytesFreed, mbFreed };
}

/**
 * Returns total storage metrics for all jobs
 */
export function getStorageStats(jobsMap?: Map<string, JobState>) {
  const totalBytes = getDirectorySize(CONFIG.jobsDir);
  let jobCount = 0;

  if (fs.existsSync(CONFIG.jobsDir)) {
    try {
      jobCount = fs.readdirSync(CONFIG.jobsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
    } catch {
      jobCount = 0;
    }
  }

  return {
    totalBytes,
    totalMb: (totalBytes / (1024 * 1024)).toFixed(2),
    totalJobsOnDisk: jobCount,
    activeJobsInMemory: jobsMap ? jobsMap.size : 0,
    retentionHours: CONFIG.jobRetentionHours,
    cleanupIntervalMinutes: CONFIG.cleanupIntervalMinutes,
    storagePath: CONFIG.jobsDir,
  };
}

/**
 * Starts automatic background cleanup interval
 */
export function startPeriodicCleanup(
  jobsMap: Map<string, JobState>,
  intervalMinutes: number = CONFIG.cleanupIntervalMinutes,
  maxAgeHours: number = CONFIG.jobRetentionHours
): NodeJS.Timeout {
  console.log(`🧹 [Cleaner] Initialized: Pruning jobs older than ${maxAgeHours}h every ${intervalMinutes}m`);

  // Run initial cleanup once on boot
  cleanExpiredJobs(jobsMap, maxAgeHours);

  // Schedule recurring interval
  return setInterval(() => {
    cleanExpiredJobs(jobsMap, maxAgeHours);
  }, intervalMinutes * 60 * 1000);
}
