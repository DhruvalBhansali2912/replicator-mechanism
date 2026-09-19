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
  const btnAutoProvisionFallback = document.getElementById('btn-auto-provision-fallback');
  const btnStartExtract = document.getElementById('btn-start-extract');
  const btnRechargeTokens = document.getElementById('btn-recharge-tokens');
  const btnCancelProgress = document.getElementById('btn-cancel-progress');
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');

  const displayApiKey = document.getElementById('display-api-key');
  const btnCopyKey = document.getElementById('btn-copy-key');
  const btnCopyIcon = document.getElementById('btn-copy-icon');
  const btnCopyLabel = document.getElementById('btn-copy-label');
  const trialBadge = document.getElementById('trial-badge');
  const exhaustedCard = document.getElementById('exhausted-card');

  const progressFill = document.getElementById('progress-bar-fill');
  const progressPercentText = document.getElementById('progress-percent-text');
  const progressStepText = document.getElementById('progress-step-text');

  const btnOpenPreview = document.getElementById('btn-open-preview');
  const btnDownloadZip = document.getElementById('btn-download-zip');
  const btnDismissCompleted = document.getElementById('btn-dismiss-completed');

  const recentListEl = document.getElementById('recent-list');
  const recentCountBadge = document.getElementById('recent-count-badge');

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
  let store = await chrome.storage.local.get([
    'apiKey',
    'deviceId',
    'balance',
    'apiUrl',
    'activeJob',
    'isFreeTrial',
  ]);

  const apiUrl = store.apiUrl || 'https://replicator.inventkid.com';
  serverUrlDisplay.textContent = `Server: ${apiUrl.replace(/^https?:\/\//, '')}`;

  // If no API key is present, auto-provision default 3-token trial key immediately
  if (!store.apiKey) {
    try {
      const provRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'AUTO_PROVISION' }, resolve);
      });
      if (provRes && provRes.success && provRes.apiKey) {
        store.apiKey = provRes.apiKey;
        store.balance = provRes.balance !== undefined ? provRes.balance : 3;
        store.isFreeTrial = provRes.isFreeTrial !== undefined ? provRes.isFreeTrial : true;
      }
    } catch (e) {
      console.warn('Auto-provision during popup load failed:', e);
    }
  }

  // Check if API key is present after auto-provision attempt
  if (!store.apiKey) {
    showView('license');
  } else {
    // Populate display key
    if (displayApiKey) {
      displayApiKey.value = store.apiKey;
    }

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
      if (store.activeJob.status === 'failed') {
        await chrome.storage.local.remove(['activeJob']);
        showView('ready');
      } else {
        renderJobState(store.activeJob);
      }
    } else {
      showView('ready');
    }

    // Load Last 3 Replicated Pages
    loadRecentReplications();
  }

  // 3. Listen to Storage Changes (Live background sync)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.balance) {
      updateBalanceDisplay(changes.balance.newValue);
    }
    if (changes.activeJob) {
      renderJobState(changes.activeJob.newValue);
    }
    if (changes.recentReplications) {
      renderRecentList((changes.recentReplications.newValue || []).slice(0, 3));
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
        if (displayApiKey) {
          displayApiKey.value = key;
        }
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

  // Fallback Auto-Provision Button
  btnAutoProvisionFallback?.addEventListener('click', async () => {
    btnAutoProvisionFallback.disabled = true;
    btnAutoProvisionFallback.textContent = 'Generating Key...';

    try {
      const provRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'AUTO_PROVISION' }, resolve);
      });

      if (provRes && provRes.success && provRes.apiKey) {
        store.apiKey = provRes.apiKey;
        store.balance = provRes.balance !== undefined ? provRes.balance : 3;
        if (displayApiKey) {
          displayApiKey.value = provRes.apiKey;
        }
        updateBalanceDisplay(store.balance);
        showAlert('🎉 3 Free Trial Tokens credited!', 'info');
        setTimeout(() => {
          hideAlert();
          showView('ready');
        }, 1000);
      } else {
        showAlert(provRes?.error || 'Failed to generate trial key', 'error');
      }
    } catch (e) {
      showAlert(`Error: ${e.message}`, 'error');
    } finally {
      btnAutoProvisionFallback.disabled = false;
      btnAutoProvisionFallback.textContent = '⚡ Get 3 Free Trial Tokens (Instant)';
    }
  });

  // 1-Click Copy API Key Handler
  async function copyApiKeyToClipboard() {
    const keyToCopy = (displayApiKey && displayApiKey.value) || store.apiKey;
    if (!keyToCopy) return;

    try {
      await navigator.clipboard.writeText(keyToCopy);
      if (btnCopyKey) {
        btnCopyKey.classList.add('copied');
        if (btnCopyIcon) btnCopyIcon.textContent = '✓';
        if (btnCopyLabel) btnCopyLabel.textContent = 'Copied!';
        setTimeout(() => {
          btnCopyKey.classList.remove('copied');
          if (btnCopyIcon) btnCopyIcon.textContent = '📋';
          if (btnCopyLabel) btnCopyLabel.textContent = 'Copy';
        }, 2000);
      }
      showAlert('✓ API Key copied! Paste it at checkout on inventkid.com to add tokens.', 'info');
      setTimeout(() => hideAlert(), 4500);
    } catch (err) {
      if (displayApiKey) {
        displayApiKey.select();
        document.execCommand('copy');
      }
      showAlert('API Key copied to clipboard!', 'info');
      setTimeout(() => hideAlert(), 3000);
    }
  }

  btnCopyKey?.addEventListener('click', copyApiKeyToClipboard);
  displayApiKey?.addEventListener('click', copyApiKeyToClipboard);

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

    btnStartExtract.disabled = true;
    btnStartExtract.textContent = 'Preparing Page...';
    hideAlert();

    // Capture client DOM snapshot and stylesheets as anti-bot / Cloudflare bypass fallback
    let htmlSnapshot = '';
    let clientStylesheets = [];
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async () => {
            // 1. Scroll page smoothly to trigger any lazy loaders & intersection observers in tab
            const scrollHeight = document.body.scrollHeight;
            const vh = window.innerHeight;
            for (let y = 0; y < scrollHeight; y += vh) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 60));
            }
            window.scrollTo(0, 0);
            await new Promise((r) => setTimeout(r, 400));

            // 2. Wait up to 2.5s for skeletons if present
            const start = Date.now();
            while (Date.now() - start < 2500) {
              const skeletons = document.querySelectorAll(
                '.animate-pulse, [class*="skeleton"], .exclusive-offers-empty, [class*="loading-placeholder"]'
              );
              if (skeletons.length === 0) break;
              await new Promise((r) => setTimeout(r, 300));
            }

            // 3. Extract loaded CSS rules directly from document.styleSheets and <link rel="stylesheet">
            const stylesheets = [];
            const fetchedHrefs = new Set();

            for (let i = 0; i < document.styleSheets.length; i++) {
              const sheet = document.styleSheets[i];
              let css = '';
              try {
                if (sheet.cssRules && sheet.cssRules.length > 0) {
                  for (let j = 0; j < sheet.cssRules.length; j++) {
                    css += sheet.cssRules[j].cssText + '\n';
                  }
                }
              } catch (e) {
                // Cross-origin CSS rule security restriction
              }

              // If sheet could not be read via cssRules (cross-origin/CDN), fetch it directly inside the tab context!
              if (!css.trim() && sheet.href && !sheet.href.startsWith('chrome-extension://')) {
                try {
                  fetchedHrefs.add(sheet.href);
                  const resp = await fetch(sheet.href);
                  if (resp.ok) {
                    css = await resp.text();
                  }
                } catch (fetchErr) {}
              }

              if (css.trim()) {
                stylesheets.push(css);
              }
            }

            // Also check all <link rel="stylesheet"> tags in the document to ensure no external CDN styles were missed
            const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
            for (const link of links) {
              const href = link.href;
              if (href && !href.startsWith('chrome-extension://') && !fetchedHrefs.has(href)) {
                try {
                  fetchedHrefs.add(href);
                  const resp = await fetch(href);
                  if (resp.ok) {
                    const text = await resp.text();
                    if (text.trim()) {
                      stylesheets.push(text);
                    }
                  }
                } catch (e) {}
              }
            }

            return {
              html: document.documentElement.outerHTML,
              stylesheets: stylesheets,
            };
          },
        });

        if (results && results[0] && results[0].result) {
          htmlSnapshot = results[0].result.html;
          clientStylesheets = results[0].result.stylesheets || [];
        }
      }
    } catch (e) {
      console.warn('Could not grab active tab DOM snapshot:', e);
    }

    const options = {
      localizeAssets: document.getElementById('opt-localize').checked,
      mobile: document.getElementById('opt-mobile').checked,
      purgeCss: document.getElementById('opt-purge').checked,
      renameClasses: document.getElementById('opt-rename').checked,
      htmlSnapshot: htmlSnapshot || undefined,
      clientStylesheets: clientStylesheets.length > 0 ? clientStylesheets : undefined,
    };

    // Delegate execution to background.js so it continues if popup closes
    chrome.runtime.sendMessage(
      {
        action: 'START_EXTRACTION',
        payload: { url: currentTabUrl, options },
      },
      (res) => {
        btnStartExtract.disabled = false;
        btnStartExtract.textContent = 'Replicate Current Page';
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
      loadRecentReplications();
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
      exhaustedCard?.classList.remove('hidden');
      btnStartExtract.disabled = true;
      btnStartExtract.innerHTML = '<span class="btn-icon">⚠️</span> <span class="btn-text">Tokens Depleted (0 Remaining)</span>';
      btnRechargeTokens?.classList.remove('hidden');
    } else {
      exhaustedCard?.classList.add('hidden');
      btnStartExtract.disabled = false;
      btnStartExtract.innerHTML = '<span class="btn-icon">⚡</span> <span class="btn-text">Replicate Page (-1 Token)</span>';
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

  // --- RECENT REPLICATIONS (LAST 3) ---

  async function loadRecentReplications() {
    if (!recentListEl) return;

    try {
      const { recentReplications = [], apiKey, apiUrl } = await chrome.storage.local.get([
        'recentReplications',
        'apiKey',
        'apiUrl',
      ]);

      // 1. Render immediately from local storage for zero latency
      renderRecentList(recentReplications.slice(0, 3));

      // 2. Synchronize with server if API key is available
      if (apiKey) {
        const baseUrl = (apiUrl || 'https://replicator.inventkid.com').replace(/\/$/, '');
        const resp = await fetch(`${baseUrl}/api/jobs/recent?limit=3`, {
          headers: {
            'X-API-Key': apiKey,
          },
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data && data.success && Array.isArray(data.jobs)) {
            // Merge server jobs with local cache
            const serverJobs = data.jobs.map((j) => ({
              id: j.id,
              url: j.url,
              completedAt: j.completedAt,
              previewUrl: j.previewUrl.startsWith('http') ? j.previewUrl : `${baseUrl}${j.previewUrl}`,
              downloadUrl: j.downloadUrl.startsWith('http') ? j.downloadUrl : `${baseUrl}${j.downloadUrl}`,
              sectionCount: j.sectionCount || 0,
            }));

            // Merge avoiding duplicates
            const jobMap = new Map();
            for (const item of serverJobs) {
              jobMap.set(item.id, item);
            }
            for (const item of recentReplications) {
              if (!jobMap.has(item.id)) {
                jobMap.set(item.id, item);
              }
            }

            const merged = Array.from(jobMap.values())
              .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
              .slice(0, 10);

            await chrome.storage.local.set({ recentReplications: merged });
            renderRecentList(merged.slice(0, 3));
          }
        }
      }
    } catch (err) {
      console.warn('Could not load recent replications:', err);
    }
  }

  function renderRecentList(items) {
    if (!recentListEl) return;

    if (!items || items.length === 0) {
      if (recentCountBadge) recentCountBadge.textContent = '0/3';
      recentListEl.innerHTML = '<div class="recent-empty">No replicated pages yet. Click Replicate Page above to clone a website.</div>';
      return;
    }

    const displayItems = items.slice(0, 3);
    if (recentCountBadge) {
      recentCountBadge.textContent = `${displayItems.length}/3`;
    }

    recentListEl.innerHTML = '';

    displayItems.forEach((job) => {
      let hostname = '';
      let pathname = '';
      try {
        const u = new URL(job.url);
        hostname = u.hostname.replace(/^www\./, '');
        pathname = u.pathname !== '/' ? u.pathname : '';
      } catch {
        hostname = job.url || 'Unknown page';
      }

      const displayUrl = `${hostname}${pathname}`;
      const timeAgo = formatRelativeTime(job.completedAt);
      const sectionText = job.sectionCount ? `${job.sectionCount} sections` : 'Full Page';

      const itemEl = document.createElement('div');
      itemEl.className = 'recent-item';
      itemEl.innerHTML = `
        <div class="recent-item-top">
          <div class="recent-url-wrap" title="${escapeHtml(job.url)}">
            <span class="recent-url-icon">🌐</span>
            <span class="recent-url-text">${escapeHtml(displayUrl)}</span>
          </div>
          <div class="recent-item-meta">
            <span>${timeAgo}</span>
            <span class="recent-meta-pill">${sectionText}</span>
          </div>
        </div>
        <div class="recent-item-actions">
          <button class="btn-recent-action btn-recent-preview" data-preview-url="${escapeHtml(job.previewUrl)}">
            👁️ Live Preview
          </button>
          <button class="btn-recent-action btn-recent-download" data-download-url="${escapeHtml(job.downloadUrl)}" data-job-id="${escapeHtml(job.id)}">
            📦 Download ZIP
          </button>
        </div>
      `;

      // Preview click
      itemEl.querySelector('.btn-recent-preview')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = (e.currentTarget).getAttribute('data-preview-url');
        if (url) {
          chrome.tabs.create({ url });
        }
      });

      // Download click
      itemEl.querySelector('.btn-recent-download')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = (e.currentTarget).getAttribute('data-download-url');
        const id = (e.currentTarget).getAttribute('data-job-id') || 'site';
        if (url) {
          chrome.downloads.download({
            url,
            filename: `cloned-site-${id}.zip`,
            saveAs: true,
          });
        }
      });

      recentListEl.appendChild(itemEl);
    });
  }

  function formatRelativeTime(dateString) {
    if (!dateString) return 'Recently';
    const past = new Date(dateString).getTime();
    if (isNaN(past)) return 'Recently';
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - past) / 1000));

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
