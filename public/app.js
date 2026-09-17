let currentJobId = null;
let currentSections = [];
let activeSectionId = null;
let pollInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('extract-form');
  const targetUrlInput = document.getElementById('target-url');
  const submitBtn = document.getElementById('submit-btn');
  const progressCard = document.getElementById('progress-card');
  const resultsContainer = document.getElementById('results-container');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressPercentage = document.getElementById('progress-percentage');
  const currentStepLabel = document.getElementById('current-step-label');

  loadJobHistory();

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const tabName = btn.getAttribute('data-tab');
      const panel = document.getElementById(`tab-${tabName}`);
      if (panel) panel.classList.add('active');
    });
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = targetUrlInput.value.trim();
    if (!url) return;

    const options = {
      renameClasses: document.getElementById('opt-rename').checked,
      purgeCss: document.getElementById('opt-purge').checked,
      rewriteLinks: document.getElementById('opt-links').checked,
      localizeAssets: document.getElementById('opt-assets').checked,
      mobile: document.getElementById('opt-mobile').checked,
    };

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = 'Extracting...';
    progressCard.hidden = false;
    resultsContainer.hidden = true;
    updateProgress(5, 'Submitting extraction job to server...');

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start extraction job');
      }

      currentJobId = data.jobId;
      startPolling(currentJobId);
    } catch (err) {
      alert(`Error: ${err.message}`);
      resetForm();
    }
  });
});

function startPolling(jobId) {
  if (pollInterval) clearInterval(pollInterval);

  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;

      const job = await res.json();
      updateProgress(job.progress, job.currentStep);

      if (job.status === 'completed') {
        clearInterval(pollInterval);
        onJobCompleted(job);
      } else if (job.status === 'failed') {
        clearInterval(pollInterval);
        alert(`Job failed: ${job.error || 'Unknown error'}`);
        resetForm();
      }
    } catch {
      // transient network error, keep polling
    }
  }, 1000);
}

function updateProgress(percent, label) {
  const progressBarFill = document.getElementById('progress-bar-fill');
  const progressPercentage = document.getElementById('progress-percentage');
  const currentStepLabel = document.getElementById('current-step-label');

  progressBarFill.style.width = `${percent}%`;
  progressPercentage.textContent = `${percent}%`;
  currentStepLabel.textContent = label;
}

function onJobCompleted(job) {
  resetForm();
  document.getElementById('progress-card').hidden = true;
  document.getElementById('results-container').hidden = false;

  document.getElementById('result-url-display').textContent = job.url;
  document.getElementById('preview-btn').href = `/api/jobs/${job.id}/preview`;
  document.getElementById('download-zip-btn').href = `/api/jobs/${job.id}/download`;

  // Stats
  document.getElementById('stat-sections').textContent = job.stats?.sectionCount || job.sections.length;
  const origCss = job.stats?.originalCssBytes || 1;
  const minCss = job.stats?.minifiedCssBytes || 0;
  const reduction = Math.round((1 - minCss / origCss) * 100);
  document.getElementById('stat-css-reduction').textContent = `${reduction > 0 ? reduction : 0}%`;
  document.getElementById('stat-assets').textContent = job.stats?.assetCount || 0;
  const htmlKb = Math.round((job.stats?.transformedHtmlBytes || 0) / 1024);
  document.getElementById('stat-html-size').textContent = `${htmlKb} KB`;

  // Populate sections
  currentSections = job.sections;
  renderSectionsList(currentSections);

  if (currentSections.length > 0) {
    selectSection(currentSections[0].id);
  }

  loadJobHistory();
}

function renderSectionsList(sections) {
  const container = document.getElementById('sections-list');
  container.innerHTML = '';

  sections.forEach((sec) => {
    const item = document.createElement('div');
    item.className = `section-item ${sec.id === activeSectionId ? 'active' : ''}`;
    item.dataset.id = sec.id;
    item.innerHTML = `
      <div>
        <span class="section-badge">${sec.id} &bull; ${sec.archetype}</span>
        <div class="section-item-name">${capitalize(sec.archetype)} Section</div>
      </div>
      <div class="confidence-pill">${Math.round(sec.confidence * 100)}% Match</div>
    `;

    item.addEventListener('click', () => selectSection(sec.id));
    container.appendChild(item);
  });
}

async function selectSection(sectionId) {
  activeSectionId = sectionId;

  document.querySelectorAll('.section-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === sectionId);
  });

  const secMeta = currentSections.find((s) => s.id === sectionId);
  if (!secMeta) return;

  document.getElementById('inspector-badge').textContent = `${secMeta.id} &bull; ${secMeta.archetype}`;
  document.getElementById('inspector-name').textContent = `${capitalize(secMeta.archetype)} (${secMeta.tagName.toUpperCase()})`;

  // Fetch section data
  try {
    const res = await fetch(`/api/jobs/${currentJobId}/sections/${sectionId}`);
    if (!res.ok) return;
    const data = await res.json();

    // Populate tabs
    document.getElementById('section-iframe').src = data.previewUrl;
    document.getElementById('code-html').textContent = data.html;
    document.getElementById('code-css').textContent = data.css;
    document.getElementById('code-min-css').textContent = data.minifiedCss;
    document.getElementById('code-js').textContent = data.js || '/* No specific scripts captured for this section */';
    document.getElementById('code-meta').textContent = JSON.stringify(data.meta, null, 2);
  } catch (err) {
    console.error('Failed to load section:', err);
  }
}

async function loadJobHistory() {
  try {
    const res = await fetch('/api/jobs');
    if (!res.ok) return;
    const data = await res.json();

    const list = document.getElementById('history-list');
    if (!data.jobs || data.jobs.length === 0) {
      list.innerHTML = '<p class="empty-state">No jobs executed yet. Enter a URL above to start.</p>';
      return;
    }

    list.innerHTML = data.jobs
      .slice(-5)
      .reverse()
      .map(
        (j) => `
        <div class="history-item">
          <div>
            <strong>${j.url}</strong>
            <div style="font-size: 12px; color: #94a3b8;">${j.sectionCount} sections &bull; Status: ${j.status}</div>
          </div>
          <div>
            ${
              j.status === 'completed'
                ? `<a href="/api/jobs/${j.id}/preview" target="_blank" style="margin-right: 12px;">Preview</a>
                   <a href="/api/jobs/${j.id}/download">Download ZIP</a>`
                : `<span style="color: #f59e0b;">${j.currentStep}</span>`
            }
          </div>
        </div>
      `
      )
      .join('');
  } catch {
    // ignore
  }
}

function resetForm() {
  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = false;
  submitBtn.querySelector('.btn-text').textContent = 'Deconstruct & Extract';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
