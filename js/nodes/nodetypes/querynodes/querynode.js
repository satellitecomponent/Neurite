class QueryNode {
    static availableSources = [
        { id: 'longtitleexample', label: 'Long title example' }, { id: 'graph2', label: 'Graph 2' },
        { id: 'graph3', label: 'Graph 3' }, { id: 'graph4', label: 'Graph 4' },
        { id: 'graph5', label: 'Graph 5' }, { id: 'graph6', label: 'Graph 6' },
        { id: 'meta1', label: 'Meta 1' }, { id: 'meta2', label: 'Meta 2' },
        { id: 'meta3', label: 'Meta 3' }, { id: 'meta4', label: 'Meta 4' },
        { id: 'meta5', label: 'Meta 5' }, { id: 'meta6', label: 'Meta 6' },
        { id: 'meta7', label: 'Meta 7' }, { id: 'meta8', label: 'Meta 8' },
        { id: 'meta9', label: 'Meta 9' }, { id: 'meta10', label: 'Meta 10' }
    ];
    static snippets = [
        // Logical Operators
        ['AND', ' AND ', 'logic'],
        ['OR', ' OR ', 'logic'],
        ['NOT', ' NOT ', 'logic'],
        ['(', '(', 'paren'],
        [')', ')', 'paren'],
        [',', ',', 'logic'],

        ['↵', '\n', 'newline'],

        // Fields
        ['tag:', 'tag:', 'field', 'tag'],
        ['title:', 'title:', 'field', 'title'],
        ['date', 'date', 'field'], // no entity listing
        ['updated:', 'updated:', 'field'],
        ['source:', 'source:', 'field', 'source'],
        ['author:', 'author:', 'field'],
        ['type:', 'type:', 'field'],
        ['status:', 'status:', 'field'],
        ['pinned:', 'pinned:true', 'field'],
        ['ai:', 'ai:true', 'field'],
        ['has:media', 'has:media', 'field'],
        ['id:', 'id:', 'field'],
        ['related:', 'related:', 'field'],
        ['similar:', 'similar:', 'field'],
        ['depth:', 'depth:', 'field'],

        // Special (in operator)
        ['in', 'in', 'special'],
        ['in (...)', 'field in (a, b, c)', 'special']
    ];
    static fakeTags() {
        return ['neurite', 'brain', 'cognition', 'ai', 'fractal', 'knowledge'];
    }
    static fakeSources() {
        return ['Graph1', 'Graph2', 'Meta5', 'Meta8'];
    }

    static fakeTitles() {
        return ['Overview', 'Introduction', 'Summary', 'Deep Dive'];
    }
    static fieldPreview = [
        { id: 'title', label: 'Title', type: 'input', content: 'Example Title', className: 'preview-title-input', default: true },
        { id: 'tags', label: 'Tags', type: 'div', content: '#neurite', className: 'preview-tag', default: true },
        { id: 'date', label: 'Date', type: 'div', content: '2025-04-23', className: 'preview-date' },
        { id: 'source', label: 'Source', type: 'div', content: 'Graph A', className: 'preview-tag' },
        { id: 'excerpt', label: 'Excerpt', type: 'div', content: 'This is an excerpt...', className: 'preview-excerpt' },
        { id: 'links', label: 'Links', type: 'div', content: '[link]', className: 'preview-tag' }
    ];
    static actionPreview = [
        { id: 'save', label: 'Save', type: 'button', content: 'Save', className: 'linkbuttons', default: true },
        { id: 'load', label: 'Load', type: 'button', content: 'Load', className: 'linkbuttons', default: true },
        { id: 'export', label: 'Export', type: 'button', content: '↓', className: 'linkbuttons', default: true },
        { id: 'copy', label: 'Copy', type: 'button', content: 'Copy', className: 'linkbuttons' },
        { id: 'preview', label: 'Present', type: 'button', content: 'Present', className: 'linkbuttons' },
        { id: 'pin', label: 'Pin', type: 'button', content: 'Pin', className: 'linkbuttons' }
    ];
    static outputSelects = [
        {
            label: 'Arrange as',
            options: ['list', 'grid', 'compact', 'expanded'],
            name: 'view',
            wrapper: 'view-type'
        },
        {
            label: 'Sort by',
            options: ['date', 'title', 'source', 'relevance', 'tag count'],
            name: 'sort',
            wrapper: 'sort-by'
        }
    ];
    static fakeResults() {
        return [
            {
                title: 'Neuron Alpha',
                tags: ['#brain'],
                date: '2025-01-01',
                source: 'Graph1',
                excerpt: 'The Alpha neuron plays a critical role in initiating neural synchronization across multiple brain regions, often serving as the first signal in larger cascades of cognition.',
                links: '[link]'
            },
            {
                title: 'Neuron Beta',
                tags: ['#mind'],
                date: '2025-02-01',
                source: 'Meta5',
                excerpt: 'Beta neurons are specialized for maintaining attention and enhancing perceptual clarity, particularly under conditions requiring sustained focus or adaptive sensory filtering.',
                links: '[link]'
            },
            {
                title: 'Neuron Gamma',
                tags: ['#ai'],
                date: '2025-03-01',
                source: 'Graph2',
                excerpt: 'Gamma oscillations are associated with complex cognitive tasks and are believed to facilitate the binding of distributed neural representations into a unified perceptual experience.',
                links: '[link]'
            }
        ];
    }
    static create(name = '', sx, sy, x, y) {
        const wrapper = Html.make.div('query-node-wrapper');
        const nodeIndex = Date.now();
        const node = new Node();

        node.divView = NodeView.addAtNaturalScale(node, name, []).div;
        node.divView.appendChild(wrapper);
        node.divView.style.minWidth = 'fit-content';
        node.divView.style.minHeight = '300px';

        const configWrapper = Html.make.div('query-config-wrapper');
        configWrapper.append(
            this.makeSection('Sources', this.makeSourcesSection(nodeIndex), 'limit-height'),
            this.makeSection('Conditions', this.makeConditionsSection()),
            this.makeSection('', this.makeRunButton(), 'button')
        );

        const resultWrapper = Html.make.div('query-result-wrapper');
        resultWrapper.style.display = 'none'; // hidden initially
        resultWrapper.append(
            this.makeSection('Output Settings', this.makeOutputSection(nodeIndex, node), 'limit-height'),
            this.makeSection('Results', this.makeResultsList()),
            this.makeSection('', this.makeBackButton(), 'button')
        );

        wrapper.appendChild(configWrapper);
        wrapper.appendChild(resultWrapper);

        node._configWrapper = configWrapper;
        node._resultWrapper = resultWrapper;
        node._nodeIndex = nodeIndex;

        node.push_extra_cb((node) => ({
            f: 'textarea',
            a: { p: [0, 0, 1], v: node.view.titleInput.value }
        }));

        node.isQueryNode = true;
        this.init(node);
        return node;
    }
    static makeSection(titleText, contentElement, layoutStyle = 'normal') {
        const section = Html.make.div('query-section');

        if (layoutStyle !== 'normal') {
            section.classList.add(`${layoutStyle}`);
        }

        if (titleText) {
            const header = Html.make.div('section-header');
            const left = Html.make.div('header-side left');
            const center = Html.make.div('header-title');
            center.textContent = titleText;
            const right = Html.make.div('header-side right');
            header.append(left, center, right);
            section.append(header);
        }

        const inner = Html.make.div('inner-section');
        inner.append(contentElement);
        section.append(inner);

        return section;
    }
    static makeSourcesSection(nodeIndex) {
        const textarea = Html.make.textarea('custom-scrollbar query-source-textarea');
        textarea.placeholder = 'Enter sources (one per line)...';

        const checkboxes = createCheckboxArray(nodeIndex, this.availableSources);
        checkboxes.classList.add('query-source-checkboxes', 'custom-scrollbar');

        const container = Html.make.div('query-sources-body');
        container.append(textarea, checkboxes);
        return container;
    }
    static addSourceListeners(node) {
        const sourceCheckboxes = node.content.querySelectorAll('.query-source-checkboxes input[type=checkbox]');
        node.sourceTextarea.addEventListener('input', () => {
            const lines = new Set(node.sourceTextarea.value.split('\n').map(l => l.trim()));
            sourceCheckboxes.forEach(cb => cb.checked = lines.has(cb.dataset.sourceId));
        });
        sourceCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const lines = node.sourceTextarea.value.split('\n');
                const id = cb.dataset.sourceId;
                if (cb.checked && !lines.includes(id)) {
                    node.sourceTextarea.value += (node.sourceTextarea.value ? '\n' : '') + id;
                } else if (!cb.checked) {
                    node.sourceTextarea.value = lines.filter(l => l.trim() !== id).join('\n');
                }
            });
        });
    }
    static makeConditionsSection() {
        const textarea = Html.make.textarea('custom-scrollbar query-condition-textarea');
        textarea.placeholder = 'Enter your conditions here...';

        const toolbar = Html.make.div('condition-toolbar custom-scrollbar');
        const entityDisplay = Html.make.div('relevant-entities-display custom-scrollbar');
        entityDisplay.style.display = 'none';

        this.snippets.forEach(([label, snippet]) => {
            const btn = Html.make.button('condition-snippet-btn linkbuttons');
            btn.innerText = label;
            btn.dataset.snippet = snippet;
            toolbar.appendChild(btn);
        });

        const toolbarColumn = Html.make.div('condition-buttons-wrapper');
        toolbarColumn.append(toolbar, entityDisplay);

        const container = Html.make.div('query-conditions-body');
        container.append(textarea, toolbarColumn);

        return container;
    }
    static insertTextAtCursor(node, text) {
        const ta = node.conditionTextarea;
        const [start, end] = [ta.selectionStart, ta.selectionEnd];
        const value = ta.value;

        const before = value[start - 1] || '';
        const after = value[end] || '';
        const needsLeadingSpace = before && !/\s/.test(before);
        const needsTrailingSpace = after && !/\s/.test(after);

        let toInsert = '';
        if (needsLeadingSpace) toInsert += ' ';
        toInsert += text;
        if (needsTrailingSpace) toInsert += ' ';

        ta.value = value.slice(0, start) + toInsert + value.slice(end);
        const newCursor = start + toInsert.length;
        ta.selectionStart = ta.selectionEnd = newCursor;
        ta.focus();
    }
    static addConditionListeners(node) {
        const snippetButtons = node.content.querySelectorAll('.condition-snippet-btn');
        const ta = node.conditionTextarea;

        snippetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const snippet = btn.dataset.snippet;
                this.insertTextAtCursor(node, snippet);
                this.updateConditionButtonVisibility(node);
                this.updateRelevantEntities(node);
            });
        });

        ta.addEventListener('input', () => {
            this.updateConditionButtonVisibility(node);
            this.updateRelevantEntities(node);
        });
        ta.addEventListener('click', () => {
            this.updateConditionButtonVisibility(node);
            this.updateRelevantEntities(node);
        });
        ta.addEventListener('keyup', () => {
            this.updateConditionButtonVisibility(node);
            this.updateRelevantEntities(node);
        });
    }
    static updateRelevantEntities(node) {
        const ta = node.conditionTextarea;
        if (!ta) return;

        const entityDisplay = node.content.querySelector('.relevant-entities-display');
        const toolbar = node.content.querySelector('.condition-toolbar');
        if (!entityDisplay || !toolbar) return;

        const cursorPos = ta.selectionStart;
        const lines = ta.value.substring(0, cursorPos).split('\n');
        const currentLine = lines[lines.length - 1];

        const lineCursorOffset = cursorPos - (ta.value.lastIndexOf('\n', cursorPos - 1) + 1);

        const relevantType = this.getRelevantEntityType(currentLine, lineCursorOffset);
        const entities = relevantType ? this.getRelevantEntitiesForType(relevantType) : [];

        entityDisplay.innerHTML = '';

        if (entities.length === 0) {
            entityDisplay.style.display = 'none';
            toolbar.style.display = '';
        } else {
            entityDisplay.style.display = '';
            toolbar.style.display = 'none';
        }

        entities.forEach(label => {
            const btn = Html.make.button('entity-button linkbuttons');
            btn.innerText = label;

            btn.addEventListener('click', () => {
                this.insertTextAtCursor(node, label);
                this.updateConditionButtonVisibility(node);
                this.updateRelevantEntities(node);
            });

            entityDisplay.appendChild(btn);
        });
    }
    static getRelevantEntitiesForType(type) {
        switch (type) {
            case 'tag':
                return this.fakeTags().map(tag => `#${tag}`);
            case 'source':
                return this.fakeSources();
            case 'title':
                return this.fakeTitles();
            default:
                return [];
        }
    }
    static getRelevantEntityType(currentLine, cursorOffset) {
        const upToCursor = currentLine.slice(0, cursorOffset).trim();
        const tokens = upToCursor.split(/\s+/).filter(Boolean);

        if (tokens.length === 0) return null;

        const lastToken = tokens[tokens.length - 1];

        const snippetMeta = this.snippets.find(([label, snippet, type, relevantType]) =>
            type === 'field' && lastToken.startsWith(snippet)
        );

        if (snippetMeta && snippetMeta[3]) {
            return snippetMeta[3]; // return relevantType
        }

        return null;
    }
    static updateConditionButtonVisibility(node) {
        const ta = node.conditionTextarea;
        if (!ta) return;

        const snippetButtons = node.content.querySelectorAll('.condition-snippet-btn');
        const cursorPos = ta.selectionStart;
        const lines = ta.value.substring(0, cursorPos).split('\n');
        const currentLine = lines[lines.length - 1];

        const upToCursor = currentLine.slice(0, cursorPos - (ta.value.lastIndexOf('\n', cursorPos - 1) + 1));
        const tokens = upToCursor.split(/\s+/).filter(Boolean);
        const lastToken = tokens[tokens.length - 1] || '';

        const isFieldToken = (token) => {
            return this.snippets.some(([label, snippet, type]) =>
                type === 'field' && (token.startsWith(snippet) || token === snippet)
            );
        };

        const isLogicToken = (token) => {
            return this.snippets.some(([label, snippet, type]) =>
                type === 'logic' && (token.trim() === snippet.trim())
            );
        };

        const isEntityValue = (token) => {
            return token && !isLogicToken(token) && !token.includes(':');
        };

        const lastIsField = isFieldToken(lastToken);
        const lastIsLogic = isLogicToken(lastToken);
        const lastIsEntity = isEntityValue(lastToken);

        let nonNewlineSnippetsVisible = 0;

        snippetButtons.forEach(btn => {
            const snippet = btn.dataset.snippet.trim();
            const snippetMeta = this.snippets.find(([label, content, type]) => content.trim() === snippet);
            if (!snippetMeta) {
                btn.style.display = 'none';
                return;
            }
            const [, , type] = snippetMeta;

            if (type === 'newline') {
                // Only allow New Line if last token is NOT logic
                btn.style.display = (!lastIsLogic) ? '' : 'none';
                return;
            }

            if (type === 'field') {
                btn.style.display = (!lastToken || lastIsLogic) ? '' : 'none';
            } else if (type === 'logic') {
                btn.style.display = (lastIsField || lastIsEntity) ? '' : 'none';
            } else if (type === 'special') {
                btn.style.display = lastIsField ? '' : 'none';
            } else if (type === 'paren') {
                btn.style.display = '';
            } else {
                btn.style.display = 'none';
            }

            if (btn.style.display !== 'none' && type !== 'newline') {
                nonNewlineSnippetsVisible += 1;
            }
        });
        const entityDisplay = node.content.querySelector('.relevant-entities-display');
        const toolbar = node.content.querySelector('.condition-toolbar');

        if (nonNewlineSnippetsVisible === 0) {
            toolbar.style.display = 'none';
            entityDisplay.style.display = '';
        } else {
            toolbar.style.display = '';
            entityDisplay.style.display = 'none';
        }
    }
    static makeBackButton() {
        const btn = Html.make.button('Adjust Query');
        btn.classList.add('query-back-button', 'api-modal-button');
        btn.innerText = 'Adjust Query';
        return btn;
    }
    static addBackButtonListeners(node) {
        if (!node.backButton) return;
        node.backButton.addEventListener('click', () => {
            node._resultWrapper.style.display = 'none';
            node._configWrapper.style.display = '';
        });
    }
    static makeRunButton() {
        const btn = Html.make.button('Run');
        btn.classList.add('query-run-button', 'api-modal-button');
        btn.innerText = 'Run Query';
        return btn;
    }
    static addRunButtonListeners(node) {
        if (!node.runButton) return;
        node.runButton.addEventListener('click', () => {
            this.runQuery(node);
        });
    }
    static runQuery(node) {
        node._configWrapper.style.display = 'none';
        node._resultWrapper.style.display = '';
        node.resultsData = this.fakeResults();
        this.renderResults(node);
    }
    static renderResults(node) {
        const list = node.content.querySelector('.query-results-list');
        list.innerHTML = '';

        const selectedFields = Array.from(node.fieldCheckboxes).filter(cb => cb.checked).map(cb => cb.dataset.sourceId);
        const selectedActions = Array.from(node.actionCheckboxes).filter(cb => cb.checked).map(cb => cb.dataset.sourceId);

        let results = [...node.resultsData];

        const sortSel = node.content.querySelector('.sort-by select');
        if (sortSel && sortSel.value !== 'none') {
            const key = sortSel.value;
            results.sort((a, b) => (a[key] || '').localeCompare(b[key] || ''));
        }

        results.forEach(res => {
            const item = Html.make.div('result-item');

            const content = Html.make.div('result-content');
            const fieldsWrapper = Html.make.div('result-fields');
            const actions = Html.make.div('result-actions');

            selectedFields.forEach(field => {
                if (!res[field]) return;

                if (field === 'title') {
                    const titleEl = Html.make.div('result-title');
                    titleEl.textContent = res[field];
                    content.append(titleEl);
                } else {
                    const el = Html.make.div('result-field');
                    el.classList.add(`result-${field}`);

                    let textContent = Array.isArray(res[field]) ? res[field].join(', ') : res[field];

                    if (field === 'excerpt' && typeof textContent === 'string') {
                        const maxChars = 5;
                        const truncated = textContent.length > maxChars ? textContent.slice(0, maxChars) + '...' : textContent;
                        el.textContent = truncated;
                        item.title = textContent;
                    } else {
                        el.textContent = textContent;
                    }

                    fieldsWrapper.append(el);
                }
            });

            content.append(fieldsWrapper);

            selectedActions.forEach(actionId => {
                const actionMeta = this.actionPreview.find(a => a.id === actionId);
                if (actionMeta) {
                    const btn = Html.make.button('linkbuttons');
                    btn.innerText = actionMeta.content;
                    actions.append(btn);
                }
            });

            item.append(content, actions);
            list.append(item);
        });


        const viewSel = node.content.querySelector('.view-type select');
        if (viewSel?.value === 'grid') {
            list.style.display = 'grid';
            list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
        } else {
            list.style.display = 'flex';
            list.style.gridTemplateColumns = '';
        }
    }
    static makeResultsList() {
        const resultsList = Html.make.div('query-results-list');
        resultsList.classList.add('custom-scrollbar');
        return resultsList;
    }
    static makeOutputSection(nodeIndex, node) {
        const outputTextarea = Html.make.textarea('query-output-textarea custom-scrollbar');
        node.outputTextarea = outputTextarea;
        outputTextarea.placeholder = 'Live output configuration...';

        const fieldCheckboxes = createCheckboxArray(nodeIndex, this.fieldPreview);
        const actionCheckboxes = createCheckboxArray(nodeIndex, this.actionPreview);

        fieldCheckboxes.classList.add('output-checkboxes', 'output-config-fields', 'custom-scrollbar');
        actionCheckboxes.classList.add('output-checkboxes', 'output-config-actions', 'custom-scrollbar');

        node.fieldCheckboxes = fieldCheckboxes.querySelectorAll('input[type=checkbox]');
        node.actionCheckboxes = actionCheckboxes.querySelectorAll('input[type=checkbox]');
        function applyDefaultChecks(container, options) {
            options.forEach(option => {
                if (option.default) {
                    const checkbox = container.querySelector(`[data-source-id="${option.id}"]`);
                    if (checkbox) checkbox.checked = true;
                }
            });
        }

        applyDefaultChecks(fieldCheckboxes, this.fieldPreview);
        applyDefaultChecks(actionCheckboxes, this.actionPreview);

        const fieldColumn = Html.make.div('checkbox-column');
        const actionColumn = Html.make.div('checkbox-column');

        const fieldTitle = Html.make.div('checkbox-title');
        fieldTitle.textContent = 'Display';
        const actionTitle = Html.make.div('checkbox-title');
        actionTitle.textContent = 'Actions';

        fieldColumn.append(fieldTitle, fieldCheckboxes);
        actionColumn.append(actionTitle, actionCheckboxes);

        const checkboxWrapper = Html.make.div('checkbox-wrapper');
        checkboxWrapper.append(fieldColumn, actionColumn);

        const selectContainer = Html.make.div('output-select-grid');
        this.outputSelects.forEach(({ label, options, name, wrapper }) => {
            selectContainer.append(makeSelectWithLabel(label, options, name, wrapper, nodeIndex));
        });

        const scrollContainer = Html.make.div('output-checkbox-scroll');
        scrollContainer.classList.add('custom-scrollbar');
        scrollContainer.append(checkboxWrapper);

        const controls = Html.make.div('output-config-controls');
        controls.append(selectContainer, scrollContainer);

        const innerRow = Html.make.div('output-options-wrapper');
        innerRow.append(outputTextarea, controls);

        const container = Html.make.div('query-output-options');
        container.append(innerRow);

        return container;
    }
    static addOutputSettingsListeners(node) {
        const refresh = () => {
            this.syncTextareaFromOutputControls(node);
            this.renderResults(node);
        };

        node.fieldCheckboxes.forEach(cb => cb.addEventListener('change', refresh));
        node.actionCheckboxes.forEach(cb => cb.addEventListener('change', refresh));

        this.outputSelects.forEach(({ wrapper }) => {
            const sel = node.content.querySelector(`.${wrapper} select`);
            if (sel) sel.addEventListener('change', refresh);
        });

        node.outputTextarea.addEventListener('input', () => {
            this.syncOutputControlsFromTextarea(node);
            this.renderResults(node);
        });
    }
    static syncTextareaFromOutputControls(node) {
        const selectedFields = Array.from(node.fieldCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.dataset.sourceId);

        const selectedActions = Array.from(node.actionCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.dataset.sourceId);

        let text = '';

        if (selectedFields.length > 0) {
            text += `fields: ${selectedFields.join(', ')}\n`;
        }
        if (selectedActions.length > 0) {
            text += `actions: ${selectedActions.join(', ')}\n`;
        }

        node.outputTextarea.value = text.trim();
    }
    static syncOutputControlsFromTextarea(node) {
        const value = node.outputTextarea.value || '';

        // Very simple parsing:
        const selectedFields = [];
        const selectedActions = [];
        const fieldRegex = /fields:\s*(.+)/i;
        const actionRegex = /actions:\s*(.+)/i;

        const fieldMatch = value.match(fieldRegex);
        const actionMatch = value.match(actionRegex);

        if (fieldMatch) {
            selectedFields.push(...fieldMatch[1].split(',').map(f => f.trim()));
        }

        if (actionMatch) {
            selectedActions.push(...actionMatch[1].split(',').map(f => f.trim()));
        }

        // Update checkboxes
        node.fieldCheckboxes.forEach(cb => {
            cb.checked = selectedFields.includes(cb.dataset.sourceId);
        });
        node.actionCheckboxes.forEach(cb => {
            cb.checked = selectedActions.includes(cb.dataset.sourceId);
        });

        this.renderResults(node);
    }

    static init(node) {
        node.queryNodeWrapper = node.content.querySelector('.query-node-wrapper');
        node.sourceTextarea = node.content.querySelector('.query-source-textarea');
        node.conditionTextarea = node.content.querySelector('.query-condition-textarea');
        node.outputOptions = node.content.querySelector('.query-output-options');
        node.runButton = node.content.querySelector('.query-run-button');
        node.backButton = node.content.querySelector('.query-back-button');
        node.outputTextarea = node.content.querySelector('.query-output-textarea');

        this.addSourceListeners(node);
        this.addConditionListeners(node);
        this.addRunButtonListeners(node);
        this.addBackButtonListeners(node);
        this.addOutputSettingsListeners(node);

        this.updateConditionButtonVisibility(node);
        this.updateRelevantEntities(node);
        this.syncTextareaFromOutputControls(node);
    }
}
