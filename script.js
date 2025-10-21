class TodoApp {
	constructor(opts = {}) {
		this.storageKey = opts.storageKey || 'todo_tasks_v1';
		this.taskListEl = document.getElementById('task_list');
		this.searchInput = document.querySelector('#topbar input[name="search"]');
		this.newTaskInput = document.querySelector('#downbar input[name="new_task_name"]');
		this.newTaskDate = document.querySelector('#downbar input[name="new_task_date"]');
		this.addButton = document.getElementById('add_task_button');

		if (this.newTaskDate) {
			const today = new Date();
			today.setHours(0,0,0,0);
			this.newTaskDate.min = today.toISOString().slice(0,10);
		}

		this.tasks = this.loadTasks();
		this.term = '';

		this.setupEventHandlers();
		this.draw();
	}

	loadTasks() {
		try {
			const raw = localStorage.getItem(this.storageKey);
			return raw ? JSON.parse(raw) : [];
		} catch (e) {
			console.error('Failed to load tasks', e);
			return [];
		}
	}

	saveTasks() {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(this.tasks));
		} catch (e) {
			console.error('Failed to save tasks', e);
		}
	}

	validateTaskName(name) {
		if (!name || name.length < 3 || name.length > 255) {
			alert('Nazwa zadania musi mieć od 3 do 255 znaków.');
			return false;
		}
		return true;
	}

	validateTaskDate(value) {
		if (!value) return true;
		const d = new Date(value + 'T00:00:00');
		const today = new Date();
		today.setHours(0,0,0,0);
		if (isNaN(d.getTime())) return false;
		return d.getTime() >= today.getTime();
	}

	escapeRegExp(string) {
		return string.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
	}

	highlightMatch(text, query) {
		const fragment = document.createDocumentFragment();
		if (!query) {
			fragment.appendChild(document.createTextNode(text));
			return fragment;
		}
		const re = new RegExp(this.escapeRegExp(query), 'gi');
		let lastIndex = 0;
		let match;
		while ((match = re.exec(text)) !== null) {
			if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
			const mark = document.createElement('span');
			mark.className = 'match-highlight';
			mark.textContent = match[0];
			fragment.appendChild(mark);
			lastIndex = match.index + match[0].length;
		}
		if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
		return fragment;
	}

	addTask(name, date) {
		if (!this.validateTaskName(name)) return false;
		if (date && !this.validateTaskDate(date)) { alert('Data musi być dzisiaj lub w przyszłości.'); return false; }
		const task = { id: Date.now().toString(36) + Math.random().toString(36).slice(2,6), name: name.trim(), date: date || '', done: false };
		this.tasks.push(task);
		this.saveTasks();
		this.draw();
		return true;
	}

	deleteTask(id) { this.tasks = this.tasks.filter(t => t.id !== id); this.saveTasks(); this.draw(); }

	updateTask(id, updates = {}) {
		const t = this.tasks.find(x => x.id === id); if (!t) return false;
		if (typeof updates.name !== 'undefined') { if (!this.validateTaskName(updates.name)) return false; t.name = updates.name.trim(); }
		if (typeof updates.date !== 'undefined') { // allow editing dates (including past dates) for existing tasks
			t.date = updates.date || '';
		}
		if (typeof updates.done !== 'undefined') t.done = !!updates.done;
		this.saveTasks(); this.draw(); return true;
	}

	get filteredTasks() {
		const q = (this.term || '').trim().toLowerCase();
		if (q.length < 2) return this.tasks.slice();
		return this.tasks.filter(t => t.name.toLowerCase().includes(q));
	}

	draw() {
		this.taskListEl.innerHTML = '';
		const q = (this.term || '').trim();
		const normalized = q.toLowerCase();
		const sorted = this.filteredTasks.slice().sort((a,b) => { if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1; return a.date.localeCompare(b.date); });
		for (const t of sorted) this.taskListEl.appendChild(this.createTaskElement(t, normalized));
	}

	createTaskElement(task, highlightQuery = '') {
		const el = document.createElement('div'); el.className = 'task-item'; el.dataset.id = task.id;
		const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'task-done'; checkbox.checked = !!task.done;
		const name = document.createElement('span'); name.className = 'task-name'; name.title = 'Kliknij aby edytować'; name.style.cursor = 'pointer'; if (task.done) name.style.textDecoration = 'line-through';
		if (highlightQuery && highlightQuery.length >= 2) name.appendChild(this.highlightMatch(task.name, highlightQuery)); else name.textContent = task.name;
		const date = document.createElement('span'); date.className = 'task-date'; date.textContent = task.date ? this.formatDate(task.date) : '(brak daty)'; date.style.cursor = 'pointer';
		const del = document.createElement('button'); del.className = 'task-delete'; del.textContent = 'Usuń';
		el.appendChild(checkbox); el.appendChild(name); el.appendChild(date); el.appendChild(del);
		el.style.display = 'flex'; el.style.gap = '8px'; el.style.alignItems = 'center'; el.style.padding = '6px 0';
		name.style.flex = '1 1 auto'; date.style.flex = '0 0 140px'; date.style.color = '#666'; date.style.fontSize = '0.95em';
		return el;
	}

	formatDate(iso) { if (!iso) return ''; try { const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString(); } catch(e) { return iso; } }

	setupEventHandlers() {
		this.addButton.addEventListener('click', (e) => { e.preventDefault(); this.handleAdd(); });
		this.newTaskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.handleAdd(); });
		if (this.searchInput) {
			const doSearch = () => { this.term = (this.searchInput.value || ''); this.draw(); };
			this.searchInput.addEventListener('input', doSearch);
			this.searchInput.addEventListener('keyup', doSearch);
		}
		this.taskListEl.addEventListener('click', (e) => {
			const item = e.target.closest('.task-item'); if (!item) return; const id = item.dataset.id;
			if (e.target.classList.contains('task-delete')) { this.deleteTask(id); return; }
			if (e.target.classList.contains('task-done')) { this.updateTask(id, { done: e.target.checked }); return; }
			if (e.target.classList.contains('task-name')) { this.startEditName(item, id); return; }
			if (e.target.classList.contains('task-date')) { this.startEditDate(item, id); return; }
		});
	}

	handleAdd() { const name = (this.newTaskInput.value || '').trim(); const date = this.newTaskDate.value || ''; if (this.addTask(name, date)) { this.newTaskInput.value = ''; this.newTaskDate.value = ''; this.newTaskInput.focus(); } }

	startEditName(itemEl, id) {
		const t = this.tasks.find(x => x.id === id); if (!t) return; const span = itemEl.querySelector('.task-name');
		const input = document.createElement('input'); input.type = 'text'; input.value = t.name; input.style.flex = span.style.flex; input.style.fontSize = 'inherit'; input.style.padding = '4px'; input.style.border = '1px solid #4CAF50'; input.style.borderRadius = '4px'; input.style.boxSizing = 'border-box';
		const save = () => { const newName = input.value.trim(); if (!this.validateTaskName(newName)) { input.focus(); return; } this.updateTask(id, { name: newName }); };
		const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Zapisz'; btn.style.marginLeft = '6px'; btn.className = 'inline-save';
		btn.addEventListener('click', (e) => { e.preventDefault(); save(); });
		input.addEventListener('blur', (ev) => { /* keep blur saving behavior */ save(); });
		input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); if (ev.key === 'Escape') this.draw(); });
		const container = document.createElement('span'); container.style.display = 'inline-flex'; container.style.alignItems = 'center'; container.style.gap = '6px'; container.appendChild(input); container.appendChild(btn);
		span.replaceWith(container); input.focus(); input.select();
	}

	startEditDate(itemEl, id) {
		const t = this.tasks.find(x => x.id === id); if (!t) return; const span = itemEl.querySelector('.task-date');
		const input = document.createElement('input'); input.type = 'date'; input.value = t.date || ''; input.style.flex = span.style.flex; input.style.fontSize = 'inherit'; input.style.padding = '4px'; input.style.border = '1px solid #4CAF50'; input.style.borderRadius = '4px'; input.style.boxSizing = 'border-box';
		const save = () => { const newDate = input.value || '';
			this.updateTask(id, { date: newDate }); };
		const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Zapisz'; btn.style.marginLeft = '6px'; btn.className = 'inline-save';
		btn.addEventListener('click', (e) => { e.preventDefault(); save(); });
		input.addEventListener('blur', () => { /* keep blur saving behavior */ save(); });
		input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); if (ev.key === 'Escape') this.draw(); });
		const container = document.createElement('span'); container.style.display = 'inline-flex'; container.style.alignItems = 'center'; container.style.gap = '6px'; container.appendChild(input); container.appendChild(btn);
		span.replaceWith(container); input.focus();
	}
}

document.addEventListener('DOMContentLoaded', () => { window.app = new TodoApp(); });

