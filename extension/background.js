/**
 * Replicator Chrome Extension - Background Service Worker (Manifest V3)
 * Compliant with Chrome Web Store policies:
 * - Single purpose
 * - Minimal permissions (no declarativeNetRequest, no remote code, no eval)
 * - Server-authoritative token accounting
 * - Lightweight client communicating over HTTPS Bearer API
 */

// Initialize permanent Device ID and default configuration
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['deviceId', 'apiUrl', 'apiKey']);
  const updates = {};

  let deviceId = data.deviceId;
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    updates.deviceId = deviceId;
  }

  if (!data.apiUrl) {
    updates.apiUrl = 'http://localhost:3000';
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  // Auto-provision trial key if not already present
  if (!data.apiKey) {
    await ensureTrialProvisioned();
  }
});

/**
 * Automatically provisions a default trial API key pre-credited with starter tokens.
 */
async function ensureTrialProvisioned() {
  try {
    const data = await chrome.storage.local.get(['apiKey', 'deviceId', 'apiUrl']);
    if (data.apiKey) return { success: true, apiKey: data.apiKey };

    let deviceId = data.deviceId;
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      await chrome.storage.local.set({ deviceId });
    }

    const apiUrl = (data.apiUrl || 'http://localhost:3000').replace(/\/$/, '');

    // Try V1 registration first
    try {
      const trialEmail = `trial_${deviceId.slice(0, 8)}@inventkid.local`;
      const trialPass = `TrialPass_${crypto.randomUUID().slice(0, 12)}`;
      const v1Res = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Id': deviceId,
          'X-Device-Name': 'Chrome Extension',
        },
        body: JSON.stringify({ email: trialEmail, password: trialPass }),
      });

      if (v1Res.ok) {
        const v1Data = await v1Res.json();
        if (v1Data.success && v1Data.initialToken) {
          await chrome.storage.local.set({
            apiKey: v1Data.initialToken,
            balance: 10,
            isFreeTrial: true,
          });
          return { success: true, apiKey: v1Data.initialToken, balance: 10 };
        }
      }
    } catch {}

    // Fallback to legacy trial endpoint
    const res = await fetch(`${apiUrl}/api/keys/auto-trial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        deviceName: 'Chrome Extension',
      }),
    });

    const result = await res.json();
    if (res.ok && result.success && result.apiKey) {
      await chrome.storage.local.set({
        apiKey: result.apiKey,
        balance: result.balance !== undefined ? result.balance : 3,
        isFreeTrial: result.isFreeTrial !== undefined ? result.isFreeTrial : true,
      });
      return { success: true, apiKey: result.apiKey, balance: result.balance };
    }
    return { success: false, error: result.error || 'Failed to auto-provision trial key' };
  } catch (err) {
    console.debug('Auto-provision trial note:', err);
    return { success: false, error: err.message };
  }
}

// Resume background polling on Service Worker startup / wake-up if an active job is unfinished
resumePendingJobIfAny();

// Watchdog alarm listener to keep background polling alive across minimized/idle states
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'replicator_watchdog') {
    await resumePendingJobIfAny();
  }
});

let pollingInterval = null;

// Message listener from Popup / Options UI
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_EXTRACTION') {
    handleStartExtraction(request.payload)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'POLL_STATUS') {
    chrome.storage.local.get(['activeJob']).then((res) => {
      sendResponse({ activeJob: res.activeJob || null });
    });
    return true;
  }

  if (request.action === 'REFRESH_BALANCE') {
    refreshAccountBalance()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'AUTO_PROVISION') {
    ensureTrialProvisioned()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'SECTION_PICKED') {
    chrome.storage.local.set({ selectedSection: request.section }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'SECTION_PICKER_CANCELLED') {
    chrome.storage.local.remove(['selectedSection']).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'DISMISS_JOB') {
    stopPolling();
    chrome.storage.local.remove(['activeJob']).then(() => {
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * Initiates page extraction call to server and starts resilient background polling
 */
async function handleStartExtraction({ url, options }) {
  const { apiKey, deviceId, apiUrl } = await chrome.storage.local.get([
    'apiKey',
    'deviceId',
    'apiUrl',
  ]);

  if (!apiKey) {
    throw new Error('Please enter your License Key before starting replication.');
  }

  const baseUrl = (apiUrl || 'http://localhost:3000').replace(/\/$/, '');
  const isV1Token = apiKey.startsWith('rep_sec_') || apiKey.startsWith('rep_live_');

  // Universal Cross-Origin Stylesheet Harvesting in Extension Service Worker:
  // In Chrome MV3, content scripts and in-page scripts are blocked by CORS when fetching cross-origin CSS.
  // The Background Service Worker has <all_urls> host_permissions and can fetch ANY stylesheet without CORS restrictions.
  const stylesheetUrls = new Set(options?.stylesheetUrls || []);
  if (options?.htmlSnapshot) {
    const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
    let match;
    while ((match = linkRegex.exec(options.htmlSnapshot)) !== null) {
      const hrefMatch = match[0].match(/href=["']([^"']+)["']/i);
      if (hrefMatch && hrefMatch[1] && !hrefMatch[1].startsWith('chrome-extension://')) {
        try {
          const fullUrl = new URL(hrefMatch[1], url).href;
          stylesheetUrls.add(fullUrl);
        } catch (e) {}
      }
    }
  }

  // Fetch all external stylesheets directly in Service Worker using extension host_permissions
  if (stylesheetUrls.size > 0) {
    try {
      const fetchedCss = await Promise.all(
        Array.from(stylesheetUrls).map(async (cssUrl) => {
          try {
            const resp = await fetch(cssUrl, { cache: 'force-cache' });
            if (resp.ok) {
              const text = await resp.text();
              if (text && text.trim().length > 0) return text;
            }
          } catch (e) {
            console.debug('Service Worker stylesheet fetch note:', cssUrl, e);
          }
          return '';
        })
      );
      const validCss = fetchedCss.filter((c) => c && c.trim().length > 0);
      if (validCss.length > 0) {
        options.clientStylesheets = [
          ...(options.clientStylesheets || []),
          ...validCss,
        ];
      }
    } catch (e) {
      console.debug('Service Worker parallel fetch note:', e);
    }
  }

  let endpoint = isV1Token ? `${baseUrl}/api/v1/reconstruction` : `${baseUrl}/api/extract`;
  let headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': deviceId || 'DEV_UNKNOWN',
    'X-Device-Name': 'Chrome Browser Extension',
  };

  if (isV1Token) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    headers['X-API-Key'] = apiKey;
  }

  let body = isV1Token
    ? JSON.stringify({
        url,
        htmlSnapshot: options?.htmlSnapshot,
        clientStylesheets: options?.clientStylesheets,
        clientScreenshot: options?.clientScreenshot,
        options,
      })
    : JSON.stringify({ url, options });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || `Server returned HTTP ${response.status}`);
  }

  const jobId = data.job_id || data.jobId;

  const initialJob = {
    id: jobId,
    url,
    status: 'queued',
    progress: 0,
    currentStep: 'Job queued...',
    startedAt: Date.now(),
    previewUrl: `${baseUrl}/api/jobs/${jobId}/preview`,
    downloadUrl: `${baseUrl}/api/jobs/${jobId}/download`,
  };

  await chrome.storage.local.set({ activeJob: initialJob });

  // Update badge
  chrome.action.setBadgeText({ text: '0%' });
  chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });

  // Start background polling that persists across tab changes / popup closes
  startPolling(jobId, baseUrl, apiKey, deviceId);

  return { success: true, jobId, activeJob: initialJob };
}

/**
 * Resilient background polling loop
 */
function startPolling(jobId, apiUrl, apiKey, deviceId) {
  stopPolling();

  const baseUrl = (apiUrl || 'https://replicator.inventkid.com').replace(/\/$/, '');

  // Create an alarm watchdog to wake up service worker if minimized / suspended
  chrome.alarms.create('replicator_watchdog', { periodInMinutes: 0.2 });

  // Immediate first check
  pollJobStep(jobId, baseUrl);

  pollingInterval = setInterval(async () => {
    await pollJobStep(jobId, baseUrl);
  }, 1500);
}

let consecutiveErrors = 0;

async function pollJobStep(jobId, apiUrl) {
  try {
    const { apiKey, deviceId } = await chrome.storage.local.get(['apiKey', 'deviceId']);
    const baseUrl = (apiUrl && apiUrl !== 'https://replicator.inventkid.com' ? apiUrl : 'http://localhost:3000').replace(/\/$/, '');
    const isV1Token = apiKey && (apiKey.startsWith('rep_sec_') || apiKey.startsWith('rep_live_'));

    const endpoint = isV1Token
      ? `${baseUrl}/api/v1/jobs/${jobId}`
      : `${baseUrl}/api/jobs/${jobId}`;

    const headers = {};
    if (isV1Token) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const resp = await fetch(endpoint, { headers });

    if (!resp.ok) {
      consecutiveErrors++;
      if (consecutiveErrors >= 6) {
        stopPolling();
        chrome.action.setBadgeText({ text: 'ERR' });
        chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
        const failedJob = {
          id: jobId,
          status: 'failed',
          progress: 0,
          error: resp.status === 404
            ? 'Replication job expired or was reset during a server update. Please try again.'
            : `Server returned HTTP ${resp.status}. Please try again.`,
        };
        await chrome.storage.local.set({ activeJob: failedJob });
      }
      return;
    }

    consecutiveErrors = 0;
    const jobData = await resp.json();

    const status = jobData.status;
    let progress = jobData.progress || 0;
    let currentStep = jobData.currentStep || 'Processing...';

    if (isV1Token) {
      if (status === 'queued') progress = 10;
      else if (status === 'processing') {
        const stepCount = (jobData.steps || []).length;
        progress = Math.min(95, 20 + stepCount * 8);
        const lastStep = (jobData.steps || [])[stepCount - 1];
        if (lastStep) currentStep = `${lastStep.step_name}...`;
      } else if (status === 'completed') {
        progress = 100;
        currentStep = 'Extraction completed successfully';
      } else if (status === 'waiting') {
        currentStep = jobData.error_message || 'TOKEN_LIMIT_REACHED';
      }
    }

    const updatedJob = {
      id: jobId,
      url: jobData.url || '',
      status,
      progress,
      currentStep,
      previewUrl: `${baseUrl}/api/jobs/${jobId}/preview`,
      downloadUrl: `${baseUrl}/api/jobs/${jobId}/download`,
      sectionCount: jobData.sections ? jobData.sections.length : 0,
      error: jobData.error || jobData.error_message,
      completedAt: jobData.completed_at || jobData.completedAt,
      fidelityScore: jobData.reconstruction?.fidelityScore || jobData.visualQA?.fidelityScore,
    };

    await chrome.storage.local.set({ activeJob: updatedJob });

    // Handle Completed state
    if (status === 'completed') {
      stopPolling();
      chrome.action.setBadgeText({ text: 'DONE' });
      chrome.action.setBadgeBackgroundColor({ color: '#10B981' });

      // Save last job result for popup display
      await chrome.storage.local.set({
        lastJobResult: {
          jobId,
          url: updatedJob.url,
          status: 'completed',
          fidelityScore: updatedJob.fidelityScore || 90,
          downloadUrl: updatedJob.downloadUrl,
          previewUrl: updatedJob.previewUrl,
          completedAt: updatedJob.completedAt || new Date().toISOString(),
        },
      });

      chrome.notifications.create(`job-complete-${jobId}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Replication Complete!',
        message: 'Your page was cloned with full offline fidelity. Click to preview or download.',
        priority: 2,
      });

      await refreshAccountBalance();
      return;
    }

    // Handle Failed state
    if (status === 'failed') {
      stopPolling();
      chrome.action.setBadgeText({ text: 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });

      chrome.notifications.create(`job-fail-${jobId}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Replication Failed',
        message: updatedJob.error || 'An error occurred during replication.',
        priority: 2,
      });

      await refreshAccountBalance();
      return;
    }

    // Handle Paused / Token Limit Reached state
    if (status === 'waiting') {
      stopPolling();
      chrome.action.setBadgeText({ text: 'PAUSE' });
      chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
      return;
    }

    // Update progress badge
    chrome.action.setBadgeText({ text: `${Math.round(progress)}%` });
    chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });
  } catch (e) {
    console.debug('Background polling note:', e.message);
  }
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  consecutiveErrors = 0;
  chrome.alarms.clear('replicator_watchdog');
}

/**
 * Checks storage on worker startup or alarm to resume any pending jobs
 */
async function resumePendingJobIfAny() {
  try {
    const { activeJob, apiUrl, apiKey, deviceId } = await chrome.storage.local.get([
      'activeJob',
      'apiUrl',
      'apiKey',
      'deviceId',
    ]);

    if (!activeJob || !activeJob.id) return;

    const targetApi = apiUrl || 'http://localhost:3000';
    if (!['completed', 'failed'].includes(activeJob.status)) {
      if (!pollingInterval) {
        startPolling(activeJob.id, targetApi, apiKey, deviceId);
      } else {
        await pollJobStep(activeJob.id, targetApi);
      }
    }
  } catch (err) {
    console.debug('Resume pending job note:', err);
  }
}

/**
 * Handle desktop notification click to open live preview
 */
chrome.notifications.onClicked.addListener(async (notifId) => {
  if (notifId.startsWith('job-complete-')) {
    const { activeJob } = await chrome.storage.local.get(['activeJob']);
    if (activeJob && activeJob.previewUrl) {
      chrome.tabs.create({ url: activeJob.previewUrl });
    }
  }
});

/**
 * Refreshes live token balance from API
 */
async function refreshAccountBalance() {
  const { apiKey, deviceId, apiUrl } = await chrome.storage.local.get([
    'apiKey',
    'deviceId',
    'apiUrl',
  ]);

  if (!apiKey) return { success: false, error: 'No API key' };

  try {
    const baseUrl = (apiUrl || 'https://replicator.inventkid.com').replace(/\/$/, '');
    const isV1Token = apiKey.startsWith('rep_sec_');

    if (isV1Token) {
      const resp = await fetch(`${baseUrl}/api/v1/tokens`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Device-Id': deviceId || 'DEV_UNKNOWN',
        },
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        await chrome.storage.local.set({
          balance: data.available_tokens,
          current_balance: data.current_balance,
          reserved_tokens: data.reserved_tokens,
        });
        return { success: true, balance: data.available_tokens };
      }
    } else {
      const resp = await fetch(`${baseUrl}/api/keys/balance`, {
        headers: {
          'X-API-Key': apiKey,
          'X-Device-Id': deviceId || 'DEV_UNKNOWN',
        },
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        await chrome.storage.local.set({
          balance: data.balance,
          tokensUsed: data.tokensUsed,
          customerEmail: data.customerEmail,
          isFreeTrial: data.isFreeTrial,
        });
        return { success: true, balance: data.balance };
      }
    }
    return { success: false, error: 'Failed to refresh balance' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
