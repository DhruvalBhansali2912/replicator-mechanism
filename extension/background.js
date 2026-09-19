/**
 * Replicator Chrome Extension - Background Service Worker (Manifest V3)
 * Handles long-running background extraction polling, notifications, and storage persistence.
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
    updates.apiUrl = 'https://replicator.inventkid.com';
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  await registerUserAgentRule();

  // Auto-provision trial key with 3 free tokens if not already present
  if (!data.apiKey) {
    await ensureTrialProvisioned();
  }
});

/**
 * Automatically provisions a default trial API key pre-credited with 3 tokens.
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

    const apiUrl = (data.apiUrl || 'https://replicator.inventkid.com').replace(/\/$/, '');
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
    console.warn('Auto-provision trial failed:', err);
    return { success: false, error: err.message };
  }
}

// Ensure outgoing requests carry custom User-Agent to bypass corporate proxies/Zscaler CBI
async function registerUserAgentRule() {
  if (!chrome.declarativeNetRequest) return;
  try {
    const { apiUrl } = await chrome.storage.local.get(['apiUrl']);
    let targetHost = 'replicator.inventkid.com';
    if (apiUrl) {
      try {
        targetHost = new URL(apiUrl).hostname;
      } catch {}
    }
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1001],
      addRules: [
        {
          id: 1001,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [
              {
                header: 'User-Agent',
                operation: 'set',
                value: 'InventKid-Extension/1.0',
              },
            ],
          },
          condition: {
            urlFilter: `||${targetHost}`,
            resourceTypes: ['xmlhttprequest', 'other'],
          },
        },
      ],
    });
  } catch (err) {
    console.warn('Failed to register User-Agent header rule:', err);
  }
}

registerUserAgentRule();

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

  const baseUrl = (apiUrl || 'https://replicator.inventkid.com').replace(/\/$/, '');
  const endpoint = `${baseUrl}/api/extract`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'X-Device-Id': deviceId || 'DEV_UNKNOWN',
      'X-Device-Name': 'Chrome Browser Extension',
    },
    body: JSON.stringify({ url, options }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || data.error || `Server returned HTTP ${response.status}`);
  }

  const jobId = data.jobId;

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
    const baseUrl = (apiUrl || 'https://replicator.inventkid.com').replace(/\/$/, '');
    const endpoint = `${baseUrl}/api/jobs/${jobId}`;
    const resp = await fetch(endpoint);

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

    const updatedJob = {
      id: jobId,
      url: jobData.url,
      status: jobData.status,
      progress: jobData.progress || 0,
      currentStep: jobData.currentStep || 'Processing...',
      previewUrl: `${baseUrl}/api/jobs/${jobId}/preview`,
      downloadUrl: `${baseUrl}/api/jobs/${jobId}/download`,
      sectionCount: jobData.sections ? jobData.sections.length : 0,
      error: jobData.error,
      completedAt: jobData.completedAt,
    };

    await chrome.storage.local.set({ activeJob: updatedJob });

    // Check if job is stuck in queued for too long (> 40s)
    if (jobData.status === 'queued') {
      const { activeJob } = await chrome.storage.local.get(['activeJob']);
      if (activeJob && activeJob.startedAt && Date.now() - activeJob.startedAt > 40000) {
        stopPolling();
        chrome.action.setBadgeText({ text: 'ERR' });
        chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
        await chrome.storage.local.set({
          activeJob: {
            ...updatedJob,
            status: 'failed',
            error: 'Server crawler timed out during initialization. Please try again.',
          },
        });
        return;
      }
    }

    // Update badge progress
    if (jobData.status === 'crawling' || jobData.status === 'packaging' || jobData.status === 'transforming' || jobData.status === 'queued') {
      chrome.action.setBadgeText({ text: `${jobData.progress || 0}%` });
      chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });
    }

    // Check for completion
    if (jobData.status === 'completed') {
      stopPolling();
      chrome.action.setBadgeText({ text: 'DONE' });
      chrome.action.setBadgeBackgroundColor({ color: '#10B981' });

      // Save to recent replications (stored locally for 7 days)
      try {
        const { recentReplications = [] } = await chrome.storage.local.get(['recentReplications']);
        const updatedList = recentReplications.filter((j) => j.id !== jobId);
        updatedList.unshift({
          id: jobId,
          url: jobData.url,
          completedAt: jobData.completedAt || new Date().toISOString(),
          previewUrl: `${baseUrl}/api/jobs/${jobId}/preview`,
          downloadUrl: `${baseUrl}/api/jobs/${jobId}/download`,
          sectionCount: jobData.sections ? jobData.sections.length : 0,
        });
        await chrome.storage.local.set({ recentReplications: updatedList.slice(0, 10) });
      } catch (saveErr) {
        console.warn('Could not save to recentReplications:', saveErr);
      }

      // Trigger desktop system notification
      chrome.notifications.create(`job-complete-${jobId}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Page Replication Complete!',
        message: `Finished cloning: ${jobData.url}. Click to open preview.`,
        priority: 2,
      });

      // Refresh token balance
      await refreshAccountBalance();
    } else if (jobData.status === 'failed') {
      stopPolling();
      chrome.action.setBadgeText({ text: 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });

      chrome.notifications.create(`job-fail-${jobId}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Replication Failed',
        message: jobData.error || 'An error occurred during replication.',
        priority: 2,
      });
    }
  } catch (e) {
    console.warn('Background polling check failed:', e.message);
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

    if (!['completed', 'failed'].includes(activeJob.status)) {
      if (!pollingInterval) {
        startPolling(activeJob.id, apiUrl || 'https://replicator.inventkid.com', apiKey, deviceId);
      } else {
        await pollJobStep(activeJob.id, apiUrl || 'https://replicator.inventkid.com');
      }
    }
  } catch (err) {
    console.warn('Failed to resume pending job:', err);
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
    const endpoint = `${baseUrl}/api/keys/balance`;
    const resp = await fetch(endpoint, {
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
    return { success: false, error: data.message };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
