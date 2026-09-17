/**
 * Replicator Chrome Extension - Popup Controller
 * Connects with background.js to ensure progress persists across tab switching and window minimizing.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const viewLicense = document.getElementById('view-license');
  const viewReady = document.getElementById('view-ready');
  const viewProgress = document.getElementById('view-progress');
  const viewCompleted = document.getElementById('view-completed');

  const balanceCount = document.getElementById('balance-count');
  const targetUrlEl = document.getElementById('target-url');
  const alertBanner = document.getElementById('alert-banner');
  const serverUrlDisplay = document.getElementById('server-url-display');

  const inputApiKey = document.getElementById('input-api-key');
  const btnActivateKey = document.getElementById('btn-activate-key');
  const btnStartExtract = document.getElementById('btn-start-extract');
  const btnRechargeTokens = document.getElementById('btn-recharge-tokens');
  const btnCancelProgress = document.getElementById('btn-cancel-progress');
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');

  const progressFill = document.getElementById('progress-bar-fill');
  const progressPercentText = document.getElementById('progress-percent-text');
  const progressStepText = document.getElementById('progress-step-text');

  const btnOpenPreview = document.getElementById('btn-open-preview');
  const btnDownloadZip = document.getElementById('btn-download-zip');
  const btnDismissCompleted = document.getElementById('btn-dismiss-completed');

  let currentTabUrl = '';

  // 1. Detect Active Tab URL
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0] && tabs[0].url) {
      currentTabUrl = tabs[0].url;
      targetUrlEl.textContent = currentTabUrl;
      targetUrlEl.title = currentTabUrl;
    }
  } catch (err) {
    targetUrlEl.textContent = 'Unable to detect active tab';
  }

  // 2. Load Stored Data
  const store = await chrome.storage.local.get([
    'apiKey',
    'deviceId',
    'balance',
    'apiUrl',
    'activeJob',
  ]);

  const apiUrl = store.apiUrl || 'https://replicator.inventkid.com';
  serverUrlDisplay.textContent = `Server: ${apiUrl.replace(/^https?:\/\//, '')}`;

  // Check if API key is present
  if (!store.apiKey) {
    showView('license');
  } else {
    if (store.balance !== undefined) {
      updateBalanceDisplay(store.balance);
    }

    // Direct live balance fetch to ensure badge is always 100% up-to-date
    fetch(`${apiUrl.replace(/\/$/, '')}/api/keys/balance`, {
      headers: {
        'X-API-Key': store.apiKey,
        'X-Device-Id': store.deviceId || 'DEV_UNKNOWN',
      },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.balance !== undefined) {
          chrome.storage.local.set({ balance: data.balance });
          updateBalanceDisplay(data.balance);
        }
      })
      .catch(() => {});

    // Check if there is an active or recently completed job
    if (store.activeJob) {
      renderJobState(store.activeJob);
    } else {
      showView('ready');
    }
  }

  // 3. Listen to Storage Changes (Live background sync)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.balance) {
      updateBalanceDisplay(changes.balance.newValue);
    }
    if (changes.activeJob) {
      renderJobState(changes.activeJob.newValue);
    }
  });

  // --- EVENT HANDLERS ---

  // Activate Key Button
  btnActivateKey.addEventListener('click', async () => {
    const key = inputApiKey.value.trim();
    if (!key) {
      showAlert('Please enter a valid License Key.', 'error');
      return;
    }

    btnActivateKey.disabled = true;
    btnActivateKey.textContent = 'Verifying...';
    hideAlert();

    try {
      const { deviceId } = await chrome.storage.local.get(['deviceId']);
      const verifyEndpoint = `${apiUrl.replace(/\/$/, '')}/api/keys/verify`;

      const resp = await fetch(verifyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: key,
          deviceId: deviceId || 'DEV_UNKNOWN',
          deviceName: 'Chrome Browser Extension',
        }),
      });

      const data = await resp.json();

      if (resp.ok && data.success) {
        await chrome.storage.local.set({
          apiKey: key,
          balance: data.balance,
          customerEmail: data.email,
          isFreeTrial: data.isFreeTrial,
        });

        updateBalanceDisplay(data.balance);
        showAlert('License activated successfully!', 'info');
        setTimeout(() => {
          hideAlert();
          showView('ready');
        }, 1200);
      } else {
        showAlert(data.message || data.error || 'Failed to activate key.', 'error');
      }
    } catch (err) {
      showAlert(`Network error: ${err.message}`, 'error');
    } finally {
      btnActivateKey.disabled = false;
      btnActivateKey.textContent = 'Activate License';
    }
  });

  // Start Replication Button
  btnStartExtract.addEventListener('click', async () => {
    if (!currentTabUrl || currentTabUrl.startsWith('chrome://') || currentTabUrl.startsWith('edge://')) {
      showAlert('Cannot replicate browser internal pages. Please navigate to a standard website.', 'error');
      return;
    }

    const { balance } = await chrome.storage.local.get(['balance']);
    if (balance !== undefined && balance < 1) {
      showAlert('You have 0 tokens remaining. Please purchase more tokens on inventkid.com to continue.', 'error');
      return;
    }

    const options = {
      localizeAssets: document.getElementById('opt-localize').checked,
      mobile: document.getElementById('opt-mobile').checked,
      purgeCss: document.getElementById('opt-purge').checked,
      renameClasses: document.getElementById('opt-rename').checked,
    };

    btnStartExtract.disabled = true;
    hideAlert();

    // Delegate execution to background.js so it continues if popup closes
    chrome.runtime.sendMessage(
      {
        action: 'START_EXTRACTION',
        payload: { url: currentTabUrl, options },
      },
      (res) => {
        btnStartExtract.disabled = false;
        if (res && res.success) {
          renderJobState(res.activeJob);
        } else {
          showAlert(res ? res.error : 'Failed to start replication', 'error');
        }
      }
    );
  });

  // Open Options Page
  btnSettingsToggle.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Preview Button
  btnOpenPreview.addEventListener('click', async () => {
    const { activeJob } = await chrome.storage.local.get(['activeJob']);
    if (activeJob && activeJob.previewUrl) {
      chrome.tabs.create({ url: activeJob.previewUrl });
    }
  });

  // Download ZIP Button
  btnDownloadZip.addEventListener('click', async () => {
    const { activeJob } = await chrome.storage.local.get(['activeJob']);
    if (activeJob && activeJob.downloadUrl) {
      chrome.downloads.download({
        url: activeJob.downloadUrl,
        filename: `cloned-site-${activeJob.id}.zip`,
        saveAs: true,
      });
    }
  });

  // Dismiss / Replicate Another Page
  btnDismissCompleted.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'DISMISS_JOB' }, () => {
      showView('ready');
    });
  });

  // Cancel In-Progress Replication
  btnCancelProgress?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'DISMISS_JOB' }, () => {
      showView('ready');
    });
  });

  // Recharge Free Dev Tokens
  btnRechargeTokens?.addEventListener('click', async () => {
    const { apiKey, apiUrl } = await chrome.storage.local.get(['apiKey', 'apiUrl']);
    if (!apiKey) return;

    btnRechargeTokens.disabled = true;
    btnRechargeTokens.textContent = 'Crediting tokens...';

    try {
      const endpoint = `${(apiUrl || 'https://replicator.inventkid.com').replace(/\/$/, '')}/api/keys/recharge-trial`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, count: 10 }),
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        await chrome.storage.local.set({ balance: data.balance });
        updateBalanceDisplay(data.balance);
        showAlert('🎉 Credited +10 Free Tokens! Ready to replicate.', 'info');
        setTimeout(() => hideAlert(), 3500);
      } else {
        showAlert(data.message || data.error || 'Failed to recharge tokens.', 'error');
      }
    } catch (err) {
      showAlert(`Network error: ${err.message}`, 'error');
    } finally {
      btnRechargeTokens.disabled = false;
      btnRechargeTokens.innerHTML = '<span>🎁 Add 10 Free Dev Tokens</span>';
    }
  });

  // --- HELPER FUNCTIONS ---

  function showView(name) {
    viewLicense.classList.add('hidden');
    viewReady.classList.add('hidden');
    viewProgress.classList.add('hidden');
    viewCompleted.classList.add('hidden');

    if (name === 'license') viewLicense.classList.remove('hidden');
    if (name === 'ready') viewReady.classList.remove('hidden');
    if (name === 'progress') viewProgress.classList.remove('hidden');
    if (name === 'completed') viewCompleted.classList.remove('hidden');
  }

  function renderJobState(job) {
    if (!job) {
      showView('ready');
      return;
    }

    if (job.status === 'completed') {
      showView('completed');
      return;
    }

    if (job.status === 'failed') {
      showView('ready');
      showAlert(`Extraction failed: ${job.error || 'Unknown error'}`, 'error');
      chrome.storage.local.remove(['activeJob']);
      setTimeout(() => hideAlert(), 5000);
      return;
    }

    // In Progress State
    showView('progress');
    const pct = job.progress || 0;
    progressFill.style.width = `${pct}%`;
    progressPercentText.textContent = `${pct}%`;
    progressStepText.textContent = job.currentStep || 'Processing...';
  }

  function updateBalanceDisplay(count) {
    balanceCount.textContent = count !== undefined ? `${count}` : '--';
    if (count !== undefined && count < 1) {
      btnRechargeTokens?.classList.remove('hidden');
    } else {
      btnRechargeTokens?.classList.add('hidden');
    }
  }

  function showAlert(msg, type = 'info') {
    alertBanner.textContent = msg;
    alertBanner.className = `banner ${type}`;
    alertBanner.classList.remove('hidden');
  }

  function hideAlert() {
    alertBanner.classList.add('hidden');
  }
});
