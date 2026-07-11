document.addEventListener('DOMContentLoaded', () => {
    const editToggle = document.getElementById('edit-toggle');
    const cancelEdit = document.getElementById('cancel-edit');
    const saveBtn = document.getElementById('save-btn');
    const form = document.getElementById('character-form');
    const equipmentList = document.getElementById('equipment-list');
    const addEquipmentBtn = document.getElementById('add-equipment-btn');
    const featuresList = document.getElementById('features-list');

    let originalValues = {};
    let equipmentCount = window.initialEquipmentCount || 0;
    let featureCount = window.initialFeatureCount || 0;
    let isEditing = false;

    // Tab switching
    window.switchTab = function (tabId) {
        document.querySelectorAll('.rpg-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.rpg-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const activeBtn = Array.from(document.querySelectorAll('.rpg-tab-btn')).find(btn =>
            btn.getAttribute('onclick').includes(tabId)
        );
        if (activeBtn) activeBtn.classList.add('active');

        const activeContent = document.getElementById(tabId);
        if (activeContent) activeContent.classList.add('active');
    };

    // Inspiration toggle
    window.toggleInspiration = function () {
        if (!isEditing) return;
        const bubble = document.getElementById('inspiration-bubble');
        const checkbox = document.getElementById('inspiration');
        bubble.classList.toggle('filled');
        checkbox.checked = bubble.classList.contains('filled');
    };

    // Saving throw toggle
    window.toggleSaveBubble = function (bubble) {
        if (!isEditing) return;
        bubble.classList.toggle('filled');
        const name = bubble.dataset.save;
        const checkbox = form.querySelector(`input[name="savingThrows[${name}]"]`);
        if (checkbox) checkbox.checked = bubble.classList.contains('filled');
    };

    // Skill proficiency toggle
    window.toggleSkillBubble = function (bubble) {
        if (!isEditing) return;
        bubble.classList.toggle('filled');
        const name = bubble.dataset.skill;
        const checkbox = form.querySelector(`input[name="skills[${name}]"]`);
        if (checkbox) checkbox.checked = bubble.classList.contains('filled');
    };

    // Death save toggle
    window.toggleDeathSave = function (bubble, type) {
        if (!isEditing) return;
        bubble.classList.toggle('filled');
        const mapping = {
            'success1': 'deathSaveSuccess1',
            'success2': 'deathSaveSuccess2',
            'success3': 'deathSaveSuccess3',
            'fail1': 'deathSaveFail1',
            'fail2': 'deathSaveFail2',
            'fail3': 'deathSaveFail3'
        };
        const checkbox = form.querySelector(`input[name="${mapping[type]}"]`);
        if (checkbox) checkbox.checked = bubble.classList.contains('filled');
    };

    function saveOriginalValues() {
        originalValues = {};
        form.querySelectorAll('input[readonly], textarea[readonly]').forEach(input => {
            if (input.type === 'checkbox') {
                originalValues[input.name] = input.checked;
            } else {
                originalValues[input.name] = input.value;
            }
        });
        const equipItems = equipmentList.querySelectorAll('.equipment-item');
        originalValues.equipment = [];
        equipItems.forEach(item => {
            originalValues.equipment.push({
                name: item.querySelector('[name$="[name]"]').value,
                quantity: item.querySelector('[name$="[quantity]"]').value
            });
        });
        const featItems = featuresList.querySelectorAll('.feature-item');
        originalValues.features = [];
        featItems.forEach(item => {
            originalValues.features.push({
                name: item.querySelector('[name$="[name]"]').value,
                description: item.querySelector('[name$="[description]"]').value
            });
        });
    }

    function enableEditing() {
        isEditing = true;

        featuresList.querySelectorAll('input, textarea').forEach(el => {
            el.removeAttribute('readonly');
            el.classList.add('edit-active');
        });
        equipmentList.querySelectorAll('input').forEach(el => {
            el.removeAttribute('readonly');
            el.classList.add('edit-active');
        });
        form.querySelectorAll('input[readonly], select[readonly]').forEach(input => {
            input.removeAttribute('readonly');
            input.classList.add('edit-active');
        });
        form.querySelectorAll('select[disabled]').forEach(select => {
            select.removeAttribute('disabled');
            select.classList.add('edit-active');
        });

        addEquipmentBtn.classList.add('visible');
        showFeatureDeleteButtons();
        editToggle.classList.add('hidden');
        cancelEdit.classList.remove('hidden');
        saveBtn.classList.remove('hidden');
        saveOriginalValues();
        updatePreviews();
    }

    function disableEditing() {
        isEditing = false;

        featuresList.querySelectorAll('input, textarea').forEach(el => {
            el.setAttribute('readonly', '');
            el.classList.remove('edit-active');
        });
        equipmentList.querySelectorAll('input').forEach(el => {
            el.setAttribute('readonly', '');
            el.classList.remove('edit-active');
        });
        form.querySelectorAll('input:not([type="checkbox"]):not([type="radio"])').forEach(input => {
            if (!input.closest('.equipment-item') && !input.closest('.feature-item')) {
                input.setAttribute('readonly', '');
                input.classList.remove('edit-active');
            }
        });
        form.querySelectorAll('select').forEach(select => {
            select.setAttribute('disabled', '');
            select.classList.remove('edit-active');
        });

        addEquipmentBtn.classList.remove('visible');
        hideFeatureDeleteButtons();
        editToggle.classList.remove('hidden');
        cancelEdit.classList.add('hidden');
        saveBtn.classList.add('hidden');
        updatePreviews();
    }

    function restoreOriginalValues() {
        if (!originalValues || Object.keys(originalValues).length === 0) return;

        form.querySelectorAll('input, textarea').forEach(input => {
            if (originalValues.hasOwnProperty(input.name)) {
                if (input.type === 'checkbox') {
                    input.checked = originalValues[input.name];
                } else {
                    input.value = originalValues[input.name];
                }
            }
        });

        document.getElementById('inspiration-bubble').classList.toggle('filled', originalValues['inspiration'] || false);

        form.querySelectorAll('[data-save]').forEach(bubble => {
            const name = bubble.dataset.save;
            const checkbox = form.querySelector(`input[name="savingThrows[${name}]"]`);
            if (checkbox && originalValues[`savingThrows[${name}]`] !== undefined) {
                bubble.classList.toggle('filled', originalValues[`savingThrows[${name}]`]);
                checkbox.checked = originalValues[`savingThrows[${name}]`];
            }
        });

        form.querySelectorAll('[data-skill]').forEach(bubble => {
            const name = bubble.dataset.skill;
            const checkbox = form.querySelector(`input[name="skills[${name}]"]`);
            if (checkbox && originalValues[`skills[${name}]`] !== undefined) {
                bubble.classList.toggle('filled', originalValues[`skills[${name}]`]);
                checkbox.checked = originalValues[`skills[${name}]`];
            }
        });

        if (originalValues.equipment) {
            equipmentList.innerHTML = '';
            originalValues.equipment.forEach((eq, idx) => {
                addEquipmentHTML(idx, eq.name, eq.quantity, false);
            });
            equipmentCount = originalValues.equipment.length;
        }
        if (originalValues.features) {
            featuresList.innerHTML = '';
            originalValues.features.forEach((f, idx) => {
                addFeatureHTML(idx, f.name, f.description, false);
            });
            featureCount = originalValues.features.length;
        }
        updatePreviews();
    }

    window.addFeatureHTML = function (idx, name, description, editMode = false) {
        const div = document.createElement('div');
        div.className = 'feature-item';
        div.dataset.index = idx;
        const inputClass = editMode ? 'font-bold bg-white border-2 border-blue-400 text-xs' : 'font-bold bg-transparent border-none text-xs';
        const textareaClass = editMode ? 'w-full text-gray-600 mt-1 bg-white border-2 border-blue-400 resize-none' : 'w-full text-gray-600 mt-1 bg-transparent border-none resize-none hidden';
        div.innerHTML = `
      <div class="flex items-start justify-between gap-2 mb-1">
        <input type="text" name="features[${idx}][name]" value="${name || ''}" ${editMode ? '' : 'readonly'}
          class="${inputClass}" placeholder="Feature name">
        <span class="feature-delete" onclick="removeFeature(${idx})">&times;</span>
      </div>
      <div class="feature-desc-preview text-xs text-gray-300 mt-1 ${editMode ? 'hidden' : ''}">${parseDndTags(description || '')}</div>
      <textarea name="features[${idx}][description]" ${editMode ? '' : 'readonly'}
        class="${textareaClass}"
        rows="2" placeholder="Feature description">${description || ''}</textarea>
    `;
        featuresList.appendChild(div);
    };

    window.addEquipment = function () {
        addEquipmentHTML(equipmentCount, '', 1, true);
        equipmentCount++;
        updatePreviews();
    };

    window.addEquipmentHTML = function (idx, name, quantity, editMode = false) {
        const div = document.createElement('div');
        div.className = 'equipment-item flex items-center justify-between gap-4';
        div.dataset.index = idx;
        const inputClass = editMode ? 'w-full bg-white border-2 border-blue-400 text-xs' : 'w-full bg-transparent border-none text-xs hidden';
        const qtyClass = editMode ? 'w-16 bg-white border-2 border-blue-400 text-xs text-center' : 'w-16 bg-transparent border-none text-xs text-center';
        div.innerHTML = `
      <div class="flex items-center gap-2 flex-grow">
        <span class="equipment-delete" onclick="removeEquipment(${idx})">&times;</span>
        <span class="rpg-tooltip-trigger equipment-name-preview text-sm font-semibold text-gray-200 ${editMode ? 'hidden' : ''}" data-type="item" data-name="${name || ''}">${name || ''}</span>
        <input type="text" name="equipment[${idx}][name]" value="${name || ''}" ${editMode ? '' : 'readonly'}
          class="${inputClass}" placeholder="Item name">
      </div>
      <div class="flex items-center gap-1">
        <span class="text-xs text-gray-500">Qty:</span>
        <input type="number" name="equipment[${idx}][quantity]" value="${quantity || 1}" ${editMode ? '' : 'readonly'} min="1"
          class="${qtyClass}" placeholder="Qty">
      </div>
    `;
        equipmentList.appendChild(div);
    };

    window.removeEquipment = function (idx) {
        if (!isEditing) return;
        const item = equipmentList.querySelector(`[data-index="${idx}"]`);
        if (item) {
            item.remove();
            reindexEquipment();
            updatePreviews();
        }
    };

    function reindexEquipment() {
        const items = equipmentList.querySelectorAll('.equipment-item');
        items.forEach((item, i) => {
            item.dataset.index = i;
            item.querySelectorAll('input').forEach(input => {
                input.name = input.name.replace(/equipment\[\d+\]/, `equipment[${i}]`);
            });
        });
        equipmentCount = items.length;
    }

    window.addFeature = function () {
        addFeatureHTML(featureCount, '', '', true);
        featureCount++;
        updatePreviews();
    };

    window.removeFeature = function (idx) {
        if (!isEditing) return;
        const item = featuresList.querySelector(`[data-index="${idx}"]`);
        if (item) {
            item.remove();
            reindexFeatures();
            updatePreviews();
        }
    };

    function reindexFeatures() {
        const items = featuresList.querySelectorAll('.feature-item');
        items.forEach((item, i) => {
            item.dataset.index = i;
            item.querySelectorAll('input, textarea').forEach(el => {
                el.name = el.name.replace(/features\[\d+\]/, `features[${i}]`);
            });
            item.querySelector('.feature-delete').setAttribute('onclick', `removeFeature(${i})`);
        });
        featureCount = items.length;
    }

    function showFeatureDeleteButtons() {
        featuresList.querySelectorAll('.feature-delete').forEach(btn => {
            btn.classList.add('visible');
        });
    }

    function hideFeatureDeleteButtons() {
        featuresList.querySelectorAll('.feature-delete').forEach(btn => {
            btn.classList.remove('visible');
        });
    }

    editToggle.addEventListener('click', () => {
        enableEditing();
    });
    cancelEdit.addEventListener('click', () => {
        restoreOriginalValues();
        disableEditing();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const data = {};

        for (const [key, value] of formData.entries()) {
            if (key.includes('[')) {
                const match = key.match(/^([^[]+)\[([^\]]+)\](?:\[([^\]]+)\])?$/);
                if (match) {
                    const [, parent, child, grandchild] = match;
                    if (grandchild !== undefined) {
                        if (!data[parent]) data[parent] = {};
                        if (!data[parent][child]) data[parent][child] = {};
                        data[parent][child][grandchild] = value;
                    } else {
                        if (!data[parent]) data[parent] = {};
                        data[parent][child] = value;
                    }
                }
            } else if (key.startsWith('deathSave')) {
                data[key] = formData.has(key);
            } else {
                data[key] = value;
            }
        }

        data.inspiration = formData.has('inspiration');

        data.equipment = [];
        const equipItems = equipmentList.querySelectorAll('.equipment-item');
        equipItems.forEach(item => {
            const name = item.querySelector('[name$="[name]"]').value;
            const quantity = parseInt(item.querySelector('[name$="[quantity]"]').value) || 1;
            if (name) {
                data.equipment.push({ name, quantity });
            }
        });

        data.savingThrows = {};
        form.querySelectorAll('input[name^="savingThrows["]').forEach(cb => {
            const match = cb.name.match(/^savingThrows\[(\w+)\]$/);
            if (match) {
                data.savingThrows[match[1]] = cb.checked;
            }
        });

        data.skills = {};
        form.querySelectorAll('input[name^="skills["]').forEach(cb => {
            const match = cb.name.match(/^skills\[([\w\s]+)\]$/);
            if (match) {
                data.skills[match[1]] = cb.checked;
            }
        });

        data.skillExpertise = {};
        form.querySelectorAll('input[name^="skillExpertise["]').forEach(cb => {
            const match = cb.name.match(/^skillExpertise\[([\w\s]+)\]$/);
            if (match) {
                data.skillExpertise[match[1]] = cb.checked;
            }
        });

        data.otherProficiencies = data.otherProficienciesText ? data.otherProficienciesText.split('\n').filter(p => p.trim()) : [];

        data.features = [];
        const featureItems = featuresList.querySelectorAll('.feature-item');
        featureItems.forEach(item => {
            const name = item.querySelector('[name$="[name]"]').value;
            const description = item.querySelector('[name$="[description]"]').value;
            if (name) {
                data.features.push({ name, description });
            }
        });

        try {
            const response = await fetch(`/character/${window.characterId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                disableEditing();
                location.reload();
            } else {
                const error = await response.json();
                alert('Error saving: ' + (error.error || 'Unknown error'));
            }
        } catch (err) {
            alert('Error saving: ' + err.message);
        }
    });

    window.confirmDelete = async function () {
        const charName = window.characterName;
        if (confirm(`Are you sure you want to delete ${charName}? This action cannot be undone.`)) {
            try {
                const response = await fetch(`/character/${window.characterId}`, {
                    method: 'DELETE',
                });
                if (response.redirected) {
                    window.location.href = response.url;
                } else if (response.ok) {
                    window.location.href = '/hall';
                } else {
                    const error = await response.json();
                    alert('Error deleting: ' + (error.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Error deleting: ' + err.message);
            }
        }
    };

    // --- REGEX PARSER AND TOOLTIPS ---
    function parseDndTags(text) {
        if (!text) return "";
        const tagRegex = /\{@([a-zA-Z]+) ([^}]+)\}/g;
        return text.replace(tagRegex, (match, tag, content) => {
            const parts = content.split('|');
            const name = parts[0];
            const source = parts[1] || '';
            const validTags = ['spell', 'item', 'feat', 'condition', 'class', 'race', 'action', 'sense', 'skill'];
            if (validTags.includes(tag.toLowerCase())) {
                return `<span class="rpg-tooltip-trigger" data-type="${tag.toLowerCase()}" data-name="${name}" data-source="${source}">${name}</span>`;
            }
            return name;
        });
    }

    function updatePreviews() {
        // Update features
        featuresList.querySelectorAll('.feature-item').forEach(item => {
            const textarea = item.querySelector('textarea');
            let preview = item.querySelector('.feature-desc-preview');
            if (!preview) {
                preview = document.createElement('div');
                preview.className = 'feature-desc-preview text-xs text-gray-300 mt-1';
                textarea.parentNode.insertBefore(preview, textarea);
            }
            preview.innerHTML = parseDndTags(textarea.value);
            if (isEditing) {
                preview.classList.add('hidden');
                textarea.classList.remove('hidden');
            } else {
                preview.classList.remove('hidden');
                textarea.classList.add('hidden');
            }
        });

        // Update equipment
        equipmentList.querySelectorAll('.equipment-item').forEach(item => {
            const input = item.querySelector('input[name$="[name]"]');
            let preview = item.querySelector('.equipment-name-preview');
            if (!preview) {
                preview = document.createElement('span');
                preview.className = 'rpg-tooltip-trigger equipment-name-preview text-sm font-semibold text-gray-200';
                preview.dataset.type = 'item';
                input.parentNode.insertBefore(preview, input);
            }
            preview.textContent = input.value;
            preview.dataset.name = input.value;
            if (isEditing) {
                preview.classList.add('hidden');
                input.classList.remove('hidden');
            } else {
                preview.classList.remove('hidden');
                input.classList.add('hidden');
            }
        });

        // Update other profs
        const otherProfsTextarea = form.querySelector('textarea[name="otherProficienciesText"]');
        if (otherProfsTextarea) {
            let preview = otherProfsTextarea.parentNode.querySelector('.other-profs-preview');
            if (!preview) {
                preview = document.createElement('div');
                preview.className = 'other-profs-preview text-sm text-gray-300 whitespace-pre-line';
                otherProfsTextarea.parentNode.insertBefore(preview, otherProfsTextarea);
            }
            preview.innerHTML = parseDndTags(otherProfsTextarea.value);
            if (isEditing) {
                preview.classList.add('hidden');
                otherProfsTextarea.classList.remove('hidden');
            } else {
                preview.classList.remove('hidden');
                otherProfsTextarea.classList.add('hidden');
            }
        }

        // Update traits
        const traitNames = ['personalityTrait', 'ideal', 'bond', 'flaw'];
        traitNames.forEach(name => {
            const textarea = form.querySelector(`textarea[name="traits[${name}]"]`);
            if (textarea) {
                let preview = textarea.parentNode.querySelector('.trait-preview');
                if (!preview) {
                    preview = document.createElement('div');
                    preview.className = 'trait-preview text-sm text-gray-300 whitespace-pre-line';
                    textarea.parentNode.insertBefore(preview, textarea);
                }
                preview.innerHTML = parseDndTags(textarea.value);
                if (isEditing) {
                    preview.classList.add('hidden');
                    textarea.classList.remove('hidden');
                } else {
                    preview.classList.remove('hidden');
                    textarea.classList.add('hidden');
                }
            }
        });
    }

    // Tooltip logic
    const tooltip = document.getElementById('rpg-tooltip') || (() => {
        const el = document.createElement('div');
        el.id = 'rpg-tooltip';
        el.className = 'rpg-tooltip hidden';
        document.body.appendChild(el);
        return el;
    })();

    document.body.addEventListener('mouseover', async (e) => {
        const trigger = e.target.closest('.rpg-tooltip-trigger');
        if (!trigger) return;

        const type = trigger.dataset.type;
        const name = trigger.dataset.name;
        const source = trigger.dataset.source || '';

        if (!name) return;

        tooltip.innerHTML = '<div class="rpg-tooltip-title">Loading...</div>';
        tooltip.classList.remove('hidden');

        // Position the tooltip
        const rect = trigger.getBoundingClientRect();
        let left = rect.left + window.scrollX;
        let top = rect.bottom + window.scrollY + 8;

        const tooltipWidth = 320;
        if (left + tooltipWidth > window.innerWidth) {
            left = window.innerWidth - tooltipWidth - 20;
        }
        tooltip.style.left = `${Math.max(10, left)}px`;
        tooltip.style.top = `${top}px`;

        try {
            const res = await fetch(`/api/lookup?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&source=${encodeURIComponent(source)}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();

            let title = data.name || name;
            let meta = '';
            let desc = '';

            if (type === 'spell') {
                const levelStr = data.level === 0 ? 'Cantrip' : `Level ${data.level}`;
                const schoolStr = data.school ? ` (${data.school})` : '';
                meta = `${levelStr}${schoolStr} | Cast: ${formatSpellTime(data.time)} | Range: ${formatSpellRange(data.range)} | Dur: ${formatSpellDuration(data.duration)}`;
                desc = flattenSpellEntries(data.entries);
            } else if (type === 'item') {
                meta = `Item | Value: ${data.value || '—'} | Weight: ${data.weight || '—'}`;
                desc = flattenSpellEntries(data.entries || [data.detail || '']);
            } else if (type === 'feat') {
                meta = `Feat | Source: ${data.source || '—'}`;
                desc = flattenSpellEntries(data.entries);
            } else if (type === 'condition') {
                meta = `Condition`;
                desc = flattenSpellEntries(data.entries);
            } else if (type === 'action') {
                meta = `Action`;
                desc = flattenSpellEntries(data.entries);
            } else if (type === 'sense') {
                meta = `Sense`;
                desc = flattenSpellEntries(data.entries);
            } else {
                meta = type.charAt(0).toUpperCase() + type.slice(1);
                desc = data.description || flattenSpellEntries(data.entries) || '';
            }

            tooltip.innerHTML = `
        <div class="rpg-tooltip-title">${title}</div>
        ${meta ? `<div class="rpg-tooltip-meta">${meta}</div>` : ''}
        <div class="rpg-tooltip-desc">${desc}</div>
      `;
        } catch (err) {
            tooltip.innerHTML = `<div class="rpg-tooltip-title">${name}</div><div class="rpg-tooltip-desc">No additional details found.</div>`;
        }
    });

    document.body.addEventListener('mouseout', (e) => {
        if (e.target.closest('.rpg-tooltip-trigger')) {
            tooltip.classList.add('hidden');
        }
    });

    function formatSpellTime(timeArr) {
        if (!timeArr || !timeArr.length) return "—";
        return `${timeArr[0].number} ${timeArr[0].unit}`;
    }

    function formatSpellRange(range) {
        if (!range) return "—";
        if (range.type === "point") {
            const d = range.distance;
            if (d.type === "self") return "Self";
            if (d.type === "touch") return "Touch";
            return `${d.amount} ${d.type}`;
        }
        return "Special";
    }

    function formatSpellDuration(durArr) {
        if (!durArr || !durArr.length) return "—";
        const d = durArr[0];
        if (d.type === "instant") return "Instant";
        if (d.type === "timed") {
            return `${d.concentration ? 'Conc. ' : ''}${d.duration.amount} ${d.duration.type}`;
        }
        return "Special";
    }

    function flattenSpellEntries(entries) {
        if (!entries) return "";
        const parts = [];
        for (const e of entries) {
            if (typeof e === "string") {
                parts.push(e.replace(/\{@[a-zA-Z]+ ([^|}]+)[^}]*\}/g, "$1"));
            } else if (e.entries) {
                parts.push(flattenSpellEntries(e.entries));
            } else if (e.items) {
                parts.push(flattenSpellEntries(e.items));
            }
        }
        return parts.join(" ");
    }

    // Initialize previews
    updatePreviews();
});
