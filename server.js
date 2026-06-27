const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const identity = {
  user_id: process.env.BFHL_USER_ID || 'Sehaj Khurana',
  email_id: process.env.BFHL_EMAIL_ID || 'sehaj2364.be23@chitkara.edu.in',
  college_roll_number: process.env.BFHL_COLLEGE_ROLL_NUMBER || '2310992364'
};

function isValidNodeEntry(rawValue) {
  const value = String(rawValue).trim();
  if (!value) return { valid: false, value };
  const match = value.match(/^([A-Z])->([A-Z])$/);
  if (!match) return { valid: false, value };
  if (match[1] === match[2]) return { valid: false, value };
  return {
    valid: true,
    value,
    parent: match[1],
    child: match[2]
  };
}

function buildHierarchyResponse(data) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const duplicateEdgeSet = new Set();
  const seenEdges = new Set();
  const parentByChild = new Map();
  const chosenEdges = [];

  for (const entry of data) {
    const parsed = isValidNodeEntry(entry);
    if (!parsed.valid) {
      invalidEntries.push(parsed.value);
      continue;
    }

    const edgeKey = `${parsed.parent}->${parsed.child}`;
    if (seenEdges.has(edgeKey)) {
      if (!duplicateEdgeSet.has(edgeKey)) {
        duplicateEdgeSet.add(edgeKey);
        duplicateEdges.push(edgeKey);
      }
      continue;
    }

    seenEdges.add(edgeKey);

    if (parentByChild.has(parsed.child)) {
      continue;
    }

    parentByChild.set(parsed.child, parsed.parent);
    chosenEdges.push(parsed);
  }

  const nodes = new Set();
  const adjacency = new Map();
  const undirected = new Map();

  function addUndirectedEdge(a, b) {
    if (!undirected.has(a)) undirected.set(a, new Set());
    if (!undirected.has(b)) undirected.set(b, new Set());
    undirected.get(a).add(b);
    undirected.get(b).add(a);
  }

  function addDirectedEdge(parent, child) {
    if (!adjacency.has(parent)) adjacency.set(parent, []);
    adjacency.get(parent).push(child);
    nodes.add(parent);
    nodes.add(child);
    addUndirectedEdge(parent, child);
  }

  for (const edge of chosenEdges) {
    addDirectedEdge(edge.parent, edge.child);
  }

  const visited = new Set();
  const hierarchies = [];

  function collectComponent(startNode) {
    const stack = [startNode];
    const component = [];
    visited.add(startNode);

    while (stack.length > 0) {
      const node = stack.pop();
      component.push(node);
      const neighbors = undirected.get(node);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }

    return component;
  }

  function buildNestedTree(node) {
    const children = adjacency.get(node) || [];
    const branch = {};
    for (const child of children) {
      branch[child] = buildNestedTree(child);
    }
    return branch;
  }

  function measureDepth(node) {
    const children = adjacency.get(node) || [];
    if (children.length === 0) return 1;
    let maxDepth = 0;
    for (const child of children) {
      maxDepth = Math.max(maxDepth, measureDepth(child));
    }
    return maxDepth + 1;
  }

  function findSmallestNode(componentNodes) {
    return componentNodes.reduce((smallest, current) => (current < smallest ? current : smallest));
  }

  const nodeList = Array.from(nodes);
  nodeList.sort();

  for (const node of nodeList) {
    if (visited.has(node)) continue;
    const componentNodes = collectComponent(node);
    const componentSet = new Set(componentNodes);
    const roots = componentNodes.filter((candidate) => !parentByChild.has(candidate) || !componentSet.has(parentByChild.get(candidate)));

    if (roots.length === 0) {
      const root = findSmallestNode(componentNodes);
      hierarchies.push({
        root,
        tree: {},
        has_cycle: true
      });
      continue;
    }

    const root = roots.sort()[0];
    const tree = { [root]: buildNestedTree(root) };
    const depth = measureDepth(root);

    hierarchies.push({
      root,
      tree,
      depth
    });
  }

  let largestTreeRoot = '';
  let largestTreeDepth = -1;
  let totalTrees = 0;
  let totalCycles = 0;

  for (const hierarchy of hierarchies) {
    if (hierarchy.has_cycle) {
      totalCycles += 1;
      continue;
    }

    totalTrees += 1;
    if (
      hierarchy.depth > largestTreeDepth ||
      (hierarchy.depth === largestTreeDepth && hierarchy.root < largestTreeRoot)
    ) {
      largestTreeDepth = hierarchy.depth;
      largestTreeRoot = hierarchy.root;
    }
  }

  return {
    ...identity,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary: {
      total_trees: totalTrees,
      total_cycles: totalCycles,
      largest_tree_root: largestTreeRoot
    }
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function serveStaticFile(res, filePath, contentType) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}

function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/bfhl') {
    let requestBody = '';
    req.on('data', (chunk) => {
      requestBody += chunk;
      if (requestBody.length > 1_000_000) {
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const parsed = JSON.parse(requestBody || '{}');
        const data = Array.isArray(parsed.data) ? parsed.data : [];
        const response = buildHierarchyResponse(data);
        sendJson(res, 200, response);
      } catch (error) {
        sendJson(res, 400, {
          error: 'Invalid JSON payload'
        });
      }
    });

    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    serveStaticFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
    return;
  }

  if (req.method === 'GET' && req.url === '/styles.css') {
    serveStaticFile(res, path.join(PUBLIC_DIR, 'styles.css'), 'text/css; charset=utf-8');
    return;
  }

  if (req.method === 'GET' && req.url === '/app.js') {
    serveStaticFile(res, path.join(PUBLIC_DIR, 'app.js'), 'application/javascript; charset=utf-8');
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

function startServer(port, attempt = 0) {
  const currentPort = port + attempt;
  const server = http.createServer(handleRequest);

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempt < 10) {
      startServer(port, attempt + 1);
      return;
    }

    console.error(error);
    process.exitCode = 1;
  });

  server.listen(currentPort, () => {
    console.log(`BFHL app listening on port ${currentPort}`);
  });
}

if (require.main === module) {
  startServer(DEFAULT_PORT);
}

module.exports = {
  buildHierarchyResponse,
  createServer: () => http.createServer(handleRequest),
  identity
};