// Shirushi Agent Swarm Visualization
// D3.js force-directed graph with real-time WebSocket updates

class SwarmVisualization {
    constructor() {
        this.ws = null;
        this.agents = [];
        this.links = [];
        this.simulation = null;
        this.svg = null;
        this.width = 0;
        this.height = 0;

        this.init();
    }

    init() {
        this.setupSVG();
        this.connectWebSocket();
        window.addEventListener('resize', () => this.resize());
    }

    setupSVG() {
        const container = document.querySelector('.visualization');
        this.width = container.clientWidth;
        this.height = container.clientHeight || 500;

        this.svg = d3.select('#graph')
            .attr('width', this.width)
            .attr('height', this.height);

        this.svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 25)
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#404040');

        this.linkGroup = this.svg.append('g').attr('class', 'links');
        this.nodeGroup = this.svg.append('g').attr('class', 'nodes');

        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(60));
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.updateConnectionStatus(true);
            console.log('WebSocket connected');
        };

        this.ws.onclose = () => {
            this.updateConnectionStatus(false);
            console.log('WebSocket disconnected, reconnecting...');
            setTimeout(() => this.connectWebSocket(), 3000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onmessage = (event) => {
            const messages = event.data.split('\n');
            messages.forEach(msg => {
                if (msg.trim()) {
                    try {
                        const data = JSON.parse(msg);
                        this.handleMessage(data);
                    } catch (e) {
                        console.error('Parse error:', e);
                    }
                }
            });
        };
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        const dot = statusEl.querySelector('.status-dot');
        const text = statusEl.querySelector('.status-text');

        if (connected) {
            dot.classList.remove('disconnected');
            dot.classList.add('connected');
            text.textContent = 'Connected';
        } else {
            dot.classList.remove('connected');
            dot.classList.add('disconnected');
            text.textContent = 'Disconnected';
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'init':
                this.initializeGraph(message.data);
                break;
            case 'event':
                this.handleEvent(message.data);
                break;
        }
    }

    initializeGraph(data) {
        this.agents = data.agents.map(a => ({
            ...a,
            x: this.width / 2 + (Math.random() - 0.5) * 200,
            y: this.height / 2 + (Math.random() - 0.5) * 200
        }));

        this.links = data.links.map(l => ({
            source: l.source,
            target: l.target
        }));

        this.updateAgentList();
        this.renderGraph();
    }

    updateAgentList() {
        const container = document.getElementById('agent-list');
        container.innerHTML = this.agents.map(agent => `
            <div class="agent-card" id="agent-${agent.id}">
                <div class="agent-icon">
                    ${agent.name.charAt(0)}
                </div>
                <div class="agent-info">
                    <h3>${agent.name}</h3>
                    <p>${agent.role} (Kind ${agent.kind})</p>
                </div>
                <span class="agent-status">Idle</span>
            </div>
        `).join('');
    }

    renderGraph() {
        const link = this.linkGroup
            .selectAll('.link')
            .data(this.links)
            .join('line')
            .attr('class', 'link')
            .attr('marker-end', 'url(#arrowhead)');

        const node = this.nodeGroup
            .selectAll('.node')
            .data(this.agents, d => d.id)
            .join('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', (event, d) => this.dragStarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragEnded(event, d)));

        node.selectAll('*').remove();

        node.append('circle')
            .attr('r', 28)
            .attr('fill', '#262626')
            .attr('stroke', '#525252');

        node.append('text')
            .attr('dy', -5)
            .text(d => d.name);

        node.append('text')
            .attr('class', 'subtitle')
            .attr('dy', 10)
            .text(d => d.role);

        this.simulation.nodes(this.agents);
        this.simulation.force('link').links(this.links);

        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        this.simulation.alpha(1).restart();
    }

    handleEvent(event) {
        this.addEventToStream(event);

        switch (event.type) {
            case 'job_request':
                this.animateJobRequest(event);
                break;
            case 'job_result':
                this.animateJobResult(event);
                break;
            case 'feedback':
                this.updateAgentStatus(event.from, event.status, event.percentage);
                break;
        }
    }

    addEventToStream(event) {
        const container = document.getElementById('events');
        const time = new Date(event.timestamp).toLocaleTimeString();

        const eventEl = document.createElement('div');
        eventEl.className = `event ${event.type}`;
        eventEl.innerHTML = `
            <div class="event-header">
                <span class="event-type">${event.type.replace('_', ' ')}</span>
                <span class="event-time">${time}</span>
            </div>
            <div class="event-flow">${event.from} -> ${event.to}</div>
            <div class="event-content">${this.truncate(event.content, 80)}</div>
        `;

        const waiting = container.querySelector('.event.info');
        if (waiting) waiting.remove();

        container.insertBefore(eventEl, container.firstChild);

        while (container.children.length > 50) {
            container.removeChild(container.lastChild);
        }
    }

    animateJobRequest(event) {
        const link = this.linkGroup.selectAll('.link')
            .filter(d =>
                (d.source.id === event.from && d.target.id === event.to) ||
                (d.source.id === 'coordinator' && d.target.id === event.to)
            );

        link.classed('active', true);
        setTimeout(() => link.classed('active', false), 2000);

        this.highlightNode(event.to);
        this.updateAgentStatus(event.to, 'processing');
    }

    animateJobResult(event) {
        const link = this.linkGroup.selectAll('.link')
            .filter(d => d.source.id === event.from && d.target.id === event.to);

        link.classed('active', true);
        setTimeout(() => link.classed('active', false), 2000);

        this.updateAgentStatus(event.from, 'complete');
        setTimeout(() => this.updateAgentStatus(event.from, 'idle'), 3000);
    }

    highlightNode(agentId) {
        const node = this.nodeGroup.selectAll('.node')
            .filter(d => d.id === agentId);

        node.classed('active', true);
        setTimeout(() => node.classed('active', false), 3000);
    }

    updateAgentStatus(agentId, status, percentage) {
        const card = document.getElementById(`agent-${agentId}`);
        if (!card) return;

        const statusEl = card.querySelector('.agent-status');
        statusEl.textContent = status === 'processing'
            ? `Processing${percentage ? ` ${percentage}%` : ''}`
            : status === 'complete' ? 'Complete' : 'Idle';

        card.classList.toggle('active', status === 'processing');
        statusEl.classList.toggle('processing', status === 'processing');
    }

    dragStarted(event, d) {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    dragEnded(event, d) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    resize() {
        const container = document.querySelector('.visualization');
        this.width = container.clientWidth;
        this.height = container.clientHeight || 500;

        this.svg
            .attr('width', this.width)
            .attr('height', this.height);

        this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
        this.simulation.alpha(0.3).restart();
    }

    truncate(str, n) {
        if (!str) return '';
        return str.length > n ? str.slice(0, n) + '...' : str;
    }
}

const swarm = new SwarmVisualization();

function submitTask() {
    const input = document.getElementById('task-input');
    const btn = document.getElementById('submit-btn');
    const task = input.value.trim();

    if (!task) return;

    btn.disabled = true;
    btn.textContent = 'Submitting...';

    if (swarm.ws && swarm.ws.readyState === WebSocket.OPEN) {
        swarm.ws.send(JSON.stringify({
            type: 'submit_task',
            data: { input: task }
        }));
    }

    const container = document.getElementById('events');
    const eventEl = document.createElement('div');
    eventEl.className = 'event job_request';
    eventEl.innerHTML = `
        <div class="event-header">
            <span class="event-type">TASK SUBMITTED</span>
            <span class="event-time">${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="event-flow">user -> coordinator</div>
        <div class="event-content">${swarm.truncate(task, 80)}</div>
    `;
    container.insertBefore(eventEl, container.firstChild);

    setTimeout(() => {
        input.value = '';
        btn.disabled = false;
        btn.textContent = 'Submit to Swarm';
    }, 1000);
}

document.getElementById('task-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        submitTask();
    }
});
