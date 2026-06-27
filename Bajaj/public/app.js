const submitButton = document.getElementById('submitBtn');
const dataInput = document.getElementById('dataInput');
const responseRoot = document.getElementById('responseRoot');
const statusBadge = document.getElementById('statusBadge');
const errorBox = document.getElementById('errorBox');

function setStatus(label) {
  statusBadge.textContent = label;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

function createSummaryCard(label, value) {
  const card = document.createElement('div');
  card.className = 'summary-card';
  card.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
  return card;
}

function createMetaCard(label, value) {
  const card = document.createElement('div');
  card.className = 'meta-card';
  card.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
  return card;
}

function renderTree(nodeKey, branch) {
  const item = document.createElement('li');
  item.className = 'tree-node';

  const label = document.createElement('div');
  label.className = 'tree-label';
  label.textContent = nodeKey;
  item.appendChild(label);

  const children = Object.entries(branch || {});
  if (children.length === 0) {
    return item;
  }

  const list = document.createElement('ul');
  list.className = 'tree-children';
  for (const [childKey, childBranch] of children) {
    list.appendChild(renderTree(childKey, childBranch));
  }

  item.appendChild(list);
  return item;
}

function renderResponse(payload) {
  responseRoot.innerHTML = '';

  const summaryGrid = document.createElement('div');
  summaryGrid.className = 'summary-grid';
  summaryGrid.appendChild(createSummaryCard('Total trees', payload.summary.total_trees));
  summaryGrid.appendChild(createSummaryCard('Total cycles', payload.summary.total_cycles));
  summaryGrid.appendChild(createSummaryCard('Largest tree root', payload.summary.largest_tree_root || 'None'));
  responseRoot.appendChild(summaryGrid);

  const metaGrid = document.createElement('div');
  metaGrid.className = 'meta-grid';
  metaGrid.appendChild(createMetaCard('User ID', payload.user_id));
  metaGrid.appendChild(createMetaCard('Email', payload.email_id));
  metaGrid.appendChild(createMetaCard('Roll number', payload.college_roll_number));
  responseRoot.appendChild(metaGrid);

  const hierarchiesSection = document.createElement('section');
  hierarchiesSection.className = 'section-stack';
  hierarchiesSection.innerHTML = '<div class="section-title">Hierarchies</div>';

  if (payload.hierarchies.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No valid hierarchies were produced from the supplied input.';
    hierarchiesSection.appendChild(empty);
  } else {
    for (const hierarchy of payload.hierarchies) {
      const card = document.createElement('article');
      card.className = 'tree-card';
      const title = document.createElement('h3');
      title.textContent = `${hierarchy.root}${hierarchy.has_cycle ? ' · cycle detected' : ` · depth ${hierarchy.depth}`}`;
      card.appendChild(title);

      if (hierarchy.has_cycle) {
        const cycleCopy = document.createElement('p');
        cycleCopy.style.color = 'var(--muted)';
        cycleCopy.textContent = 'This connected group contains a cycle, so the tree is omitted.';
        card.appendChild(cycleCopy);
      } else {
        const treeRoot = Object.entries(hierarchy.tree)[0];
        const treeView = document.createElement('ul');
        treeView.className = 'tree-view';
        if (treeRoot) {
          treeView.appendChild(renderTree(treeRoot[0], treeRoot[1]));
        }
        card.appendChild(treeView);
      }

      hierarchiesSection.appendChild(card);
    }
  }

  responseRoot.appendChild(hierarchiesSection);

  const listsSection = document.createElement('section');
  listsSection.className = 'section-stack';

  const invalidCard = document.createElement('article');
  invalidCard.className = 'list-card';
  invalidCard.innerHTML = '<div class="label">Invalid entries</div><h3>Rejected inputs</h3>';
  const invalidWrap = document.createElement('div');
  invalidWrap.className = 'chip-row';
  if (payload.invalid_entries.length === 0) {
    const chip = document.createElement('span');
    chip.className = 'chip ghost';
    chip.textContent = 'None';
    invalidWrap.appendChild(chip);
  } else {
    payload.invalid_entries.forEach((item) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = item;
      invalidWrap.appendChild(chip);
    });
  }
  invalidCard.appendChild(invalidWrap);
  listsSection.appendChild(invalidCard);

  const duplicateCard = document.createElement('article');
  duplicateCard.className = 'list-card';
  duplicateCard.innerHTML = '<div class="label">Duplicate edges</div><h3>Repeated pairs</h3>';
  const duplicateWrap = document.createElement('div');
  duplicateWrap.className = 'chip-row';
  if (payload.duplicate_edges.length === 0) {
    const chip = document.createElement('span');
    chip.className = 'chip ghost';
    chip.textContent = 'None';
    duplicateWrap.appendChild(chip);
  } else {
    payload.duplicate_edges.forEach((item) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = item;
      duplicateWrap.appendChild(chip);
    });
  }
  duplicateCard.appendChild(duplicateWrap);
  listsSection.appendChild(duplicateCard);

  responseRoot.appendChild(listsSection);
}

async function submitRequest() {
  clearError();
  setStatus('Working');
  submitButton.disabled = true;

  try {
    const payload = JSON.parse(dataInput.value);
    const response = await fetch('/bfhl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const fallback = await response.text();
      throw new Error(fallback || `Request failed with status ${response.status}`);
    }

    const result = await response.json();
    renderResponse(result);
    setStatus('Done');
  } catch (error) {
    setStatus('Failed');
    showError(error.message || 'Unable to submit request.');
  } finally {
    submitButton.disabled = false;
  }
}

submitButton.addEventListener('click', submitRequest);