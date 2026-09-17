/**
 * Replicator Chrome Extension - Background Service Worker (Manifest V3)
 * Handles long-running background extraction polling, notifications, and storage persistence.
 */

// Initialize permanent Device ID and default configuration
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['deviceId', 'apiUrl']);
  const updates = {};

  if (!data.deviceId) {
    updates.deviceId = crypto.randomUUID();
  }

  if (!data.apiUrl) {
    updates.apiUrl = 'https://replicator.inventkid.com';
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
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

  const endpoint = `${apiUrl.replace(/\/$/, '')}/api/extract`;

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
    previewUrl: `${apiUrl.replace(/\/$/, '')}/api/jobs/${jobId}/preview`,
    downloadUrl: `${apiUrl.replace(/\/$/, '')}/api/jobs/${jobId}/download`,
  };

  await chrome.storage.local.set({ activeJob: initialJob });

  // Update badge
  chrome.action.setBadgeText({ text: '0%' });
  chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });

  // Start background polling that persists across tab changes / popup closes
  startPolling(jobId, apiUrl, apiKey, deviceId);

  return { success: true, jobId, activeJob: initialJob };
}

/**
 * Resilient background polling loop
 */
function startPolling(jobId, apiUrl, apiKey, deviceId) {
  stopPolling();

  pollingInterval = setInterval(async () => {
    try {
      const endpoint = `${apiUrl.replace(/\/$/, '')}/api/jobs/${jobId}`;
      const resp = await fetch(endpoint);

      if (!resp.ok) return;

      const jobData = await resp.json();

      const updatedJob = {
        id: jobId,
        url: jobData.url,
        status: jobData.status,
        progress: jobData.progress || 0,
        currentStep: jobData.currentStep || 'Processing...',
        previewUrl: `${apiUrl.replace(/\/$/, '')}/api/jobs/${jobId}/preview`,
        downloadUrl: `${apiUrl.replace(/\/$/, '')}/api/jobs/${jobId}/download`,
        sectionCount: jobData.sections ? jobData.sections.length : 0,
        error: jobData.error,
        completedAt: jobData.completedAt,
      };

      await chrome.storage.local.set({ activeJob: updatedJob });

      // Update badge progress
      if (jobData.status === 'crawling' || jobData.status === 'packaging' || jobData.status === 'transforming') {
        chrome.action.setBadgeText({ text: `${jobData.progress}%` });
        chrome.action.setBadgeBackgroundColor({ color: '#4F46E5' });
      }

      // Check for completion
      if (jobData.status === 'completed') {
        stopPolling();
        chrome.action.setBadgeText({ text: 'DONE' });
        chrome.action.setBadgeBackgroundColor({ color: '#10B981' });

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
  }, 1500);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
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
    const endpoint = `${apiUrl.replace(/\/$/, '')}/api/keys/balance`;
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
