/**
 * Replicator Chrome Extension - Options Page Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const inputApiKey = document.getElementById('input-api-key');
  const btnToggleKey = document.getElementById('btn-toggle-key-visibility');
  const btnSaveLicense = document.getElementById('btn-save-license');
  const btnUnlinkKey = document.getElementById('btn-unlink-key');

  const statBalance = document.getElementById('stat-balance');
  const statDeviceId = document.getElementById('stat-device-id');

  const selectServer = document.getElementById('select-server-preset');
  const inputApiUrl = document.getElementById('input-api-url');
  const customServerGroup = document.getElementById('custom-server-group');
  const btnSaveServer = document.getElementById('btn-save-server');
  const statusMsg = document.getElementById('status-message');

  // Load existing storage
  const store = await chrome.storage.local.get([
    'apiKey',
    'deviceId',
    'balance',
    'apiUrl',
  ]);

  if (store.apiKey) {
    inputApiKey.value = store.apiKey;
  }

  statBalance.textContent = store.balance !== undefined ? `${store.balance} tokens` : '--';
  statDeviceId.textContent = store.deviceId || 'Not generated yet';

  const activeUrl = store.apiUrl || 'https://replicator.inventkid.com';
  inputApiUrl.value = activeUrl;

  if (activeUrl === 'https://replicator.inventkid.com' || activeUrl === 'http://localhost:3000') {
    selectServer.value = activeUrl;
    customServerGroup.style.display = 'none';
  } else {
    selectServer.value = 'custom';
    customServerGroup.style.display = 'flex';
  }

  // Toggle custom server input
  selectServer.addEventListener('change', () => {
    if (selectServer.value === 'custom') {
      customServerGroup.style.display = 'flex';
    } else {
      customServerGroup.style.display = 'none';
      inputApiUrl.value = selectServer.value;
    }
  });

  // Toggle API key password reveal
  btnToggleKey.addEventListener('click', () => {
    if (inputApiKey.type === 'password') {
      inputApiKey.type = 'text';
      btnToggleKey.textContent = 'Hide';
    } else {
      inputApiKey.type = 'password';
      btnToggleKey.textContent = 'Reveal';
    }
  });

  // Save License
  btnSaveLicense.addEventListener('click', async () => {
    const key = inputApiKey.value.trim();
    if (!key) {
      showMessage('Please enter a license key.', 'error');
      return;
    }

    btnSaveLicense.disabled = true;
    btnSaveLicense.textContent = 'Verifying with server...';

    try {
      const { deviceId, apiUrl } = await chrome.storage.local.get(['deviceId', 'apiUrl']);
      const currentApi = apiUrl || 'https://replicator.inventkid.com';

      const resp = await fetch(`${currentApi.replace(/\/$/, '')}/api/keys/verify`, {
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

        statBalance.textContent = `${data.balance} tokens`;
        showMessage('License verified and successfully bound to this device!', 'success');
      } else {
        showMessage(data.message || data.error || 'Failed to verify license key.', 'error');
      }
    } catch (err) {
      showMessage(`Network error: ${err.message}`, 'error');
    } finally {
      btnSaveLicense.disabled = false;
      btnSaveLicense.textContent = 'Save & Verify License';
    }
  });

  // Unlink Key
  btnUnlinkKey.addEventListener('click', async () => {
    if (confirm('Are you sure you want to remove this license key from this browser?')) {
      await chrome.storage.local.remove(['apiKey', 'balance', 'customerEmail', 'activeJob']);
      inputApiKey.value = '';
      statBalance.textContent = '--';
      chrome.action.setBadgeText({ text: '' });
      showMessage('License key unlinked from this extension.', 'success');
    }
  });

  // Save Server URL
  btnSaveServer.addEventListener('click', async () => {
    const targetUrl = (selectServer.value === 'custom' ? inputApiUrl.value : selectServer.value).trim();

    try {
      new URL(targetUrl);
    } catch {
      showMessage('Invalid server URL format. Please include http:// or https://', 'error');
      return;
    }

    await chrome.storage.local.set({ apiUrl: targetUrl });
    showMessage(`API Server URL updated to: ${targetUrl}`, 'success');
  });

  function showMessage(msg, type = 'success') {
    statusMsg.textContent = msg;
    statusMsg.className = `message-banner ${type}`;
    statusMsg.classList.remove('hidden');
    setTimeout(() => {
      statusMsg.classList.add('hidden');
    }, 4000);
  }
});
