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

    // Portrait upload logic
    const portraitContainer = document.getElementById('portrait-container');
    const portraitUpload = document.getElementById('portrait-upload');
    const portraitImg = document.getElementById('portrait-img');
    const portraitData = document.getElementById('portrait-data');

    if (portraitContainer && portraitUpload) {
        portraitContainer.addEventListener('click', (e) => {
            if (isEditing && !e.target.closest('input')) {
                portraitUpload.click();
            }
        });

        portraitUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    portraitImg.src = event.target.result;
                    portraitData.value = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }

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
        recalculateDynamicStats();
    };

    // Skill proficiency toggle
    window.toggleSkillBubble = function (bubble) {
        if (!isEditing) return;
        bubble.classList.toggle('filled');
        const name = bubble.dataset.skill;
        const checkbox = form.querySelector(`input[name="skills[${name}]"]`);
        if (checkbox) checkbox.checked = bubble.classList.contains('filled');
        recalculateDynamicStats();
    };

    // Real-time Ability, Saving Throw, Skill, and Spell Save DC / Attack Bonus Recalculator
    window.recalculateDynamicStats = function () {
        const pb = window.proficiencyBonus || 2;
        const spellAbilityKey = (window.spellcastingAbilityKey || 'int').toLowerCase();

        // 1. Recalculate Ability Modifiers
        const mods = {};
        document.querySelectorAll('input[name^="abilityScores["]').forEach(input => {
            const key = input.dataset.abilityKey || (input.name.match(/\[(\w+)\]/) ? input.name.match(/\[(\w+)\]/)[1] : null);
            if (!key) return;
            const score = parseInt(input.value) || 10;
            const mod = Math.floor((score - 10) / 2);
            mods[key] = mod;

            const modEl = document.querySelector(`.rpg-ability-mod[data-ability-mod="${key}"]`);
            if (modEl) {
                modEl.textContent = (mod >= 0 ? '+' : '') + mod;
            }
        });

        // 2. Recalculate Saving Throws
        document.querySelectorAll('[data-save-mod]').forEach(el => {
            const saveKey = el.dataset.saveMod;
            const mod = mods[saveKey] !== undefined ? mods[saveKey] : 0;
            const cb = form.querySelector(`input[name="savingThrows[${saveKey}]"]`);
            const isProf = cb ? cb.checked : false;
            const total = mod + (isProf ? pb : 0);
            el.textContent = (total >= 0 ? '+' : '') + total;
        });

        // 3. Recalculate Skills
        document.querySelectorAll('[data-skill-mod]').forEach(el => {
            const skillKey = el.dataset.skillMod;
            const abilityKey = el.dataset.skillAbility;
            const mod = mods[abilityKey] !== undefined ? mods[abilityKey] : 0;
            const profCb = form.querySelector(`input[name="skills[${skillKey}]"]`);
            const expCb = form.querySelector(`input[name="skillExpertise[${skillKey}]"]`);
            const isProf = profCb ? profCb.checked : false;
            const isExp = expCb ? expCb.checked : false;

            let total = mod;
            if (isExp) {
                total += (2 * pb);
            } else if (isProf) {
                total += pb;
            }
            el.textContent = (total >= 0 ? '+' : '') + total;
        });

        // 4. Recalculate Spell Save DC & Attack Bonus
        const spellMod = mods[spellAbilityKey] !== undefined ? mods[spellAbilityKey] : (mods['int'] || 0);
        const saveDCInput = document.querySelector('input[name="spellSaveDC"]');
        const attackBonusInput = document.querySelector('input[name="spellAttackBonus"]');

        if (saveDCInput) {
            saveDCInput.value = 8 + pb + spellMod;
        }
        if (attackBonusInput) {
            attackBonusInput.value = pb + spellMod;
        }
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
        form.querySelectorAll('input, select, textarea').forEach(input => {
            if (input.name) {
                if (input.type === 'checkbox') {
                    originalValues[input.name] = input.checked;
                } else {
                    originalValues[input.name] = input.value;
                }
            }
        });
        const equipItems = equipmentList.querySelectorAll('.equipment-item');
        originalValues.equipment = [];
        equipItems.forEach(item => {
            const nameEl = item.querySelector('[name$="[name]"]');
            const qtyEl = item.querySelector('[name$="[quantity]"]');
            if (nameEl && qtyEl) {
                originalValues.equipment.push({
                    name: nameEl.value,
                    quantity: qtyEl.value
                });
            }
        });
        const featItems = featuresList.querySelectorAll('.feature-item');
        originalValues.features = [];
        featItems.forEach(item => {
            const nameEl = item.querySelector('[name$="[name]"]');
            const descEl = item.querySelector('[name$="[description]"]');
            if (nameEl && descEl) {
                originalValues.features.push({
                    name: nameEl.value,
                    description: descEl.value
                });
            }
        });
        originalValues.portrait = document.getElementById('portrait-data') ? document.getElementById('portrait-data').value : '';
        originalValues.portraitSrc = document.getElementById('portrait-img') ? document.getElementById('portrait-img').src : '';
        originalValues.moniker = document.getElementById('character-moniker') ? document.getElementById('character-moniker').value : '';
        originalValues.theme = document.getElementById('theme-input') ? document.getElementById('theme-input').value : 'classic';
        originalValues.customSections = JSON.parse(JSON.stringify(customSections));
    }

    function enableEditing() {
        saveOriginalValues();
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

        const portraitContainerEl = document.getElementById('portrait-container');
        if (portraitContainerEl) {
            portraitContainerEl.classList.add('edit-active');
        }

        addEquipmentBtn.classList.add('visible');
        showFeatureDeleteButtons();

        document.querySelectorAll('.spell-add').forEach(btn => btn.classList.remove('hidden'));
        document.querySelectorAll('.spell-delete').forEach(btn => btn.classList.remove('hidden'));
        document.querySelectorAll('.cantrip-name-preview, .spell-name-preview').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.cantrip-item input[type="text"], .spell-item input[type="text"]').forEach(input => {
            input.classList.remove('hidden');
            input.removeAttribute('readonly');
            input.classList.add('edit-active');
        });
        document.querySelectorAll('.cantrip-empty-msg, .spell-empty-msg').forEach(el => el.classList.add('hidden'));

        editToggle.classList.add('hidden');
        cancelEdit.classList.remove('hidden');
        saveBtn.classList.remove('hidden');
        
        const customizerToggle = document.getElementById('customizer-toggle');
        if (customizerToggle) customizerToggle.classList.remove('hidden');

        const portraitBadge = document.getElementById('portrait-change-badge');
        if (portraitBadge) portraitBadge.classList.remove('hidden');

        updatePreviews();
        if (typeof renderCustomSections === 'function') renderCustomSections();
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

        const portraitContainerEl = document.getElementById('portrait-container');
        if (portraitContainerEl) {
            portraitContainerEl.classList.remove('edit-active');
        }

        addEquipmentBtn.classList.remove('visible');
        hideFeatureDeleteButtons();

        document.querySelectorAll('.spell-add').forEach(btn => btn.classList.add('hidden'));
        document.querySelectorAll('.spell-delete').forEach(btn => btn.classList.add('hidden'));
        document.querySelectorAll('.cantrip-name-preview, .spell-name-preview').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.cantrip-item input[type="text"], .spell-item input[type="text"]').forEach(input => {
            input.classList.add('hidden');
            input.setAttribute('readonly', '');
            input.classList.remove('edit-active');
        });
        document.querySelectorAll('.cantrip-empty-msg, .spell-empty-msg').forEach(el => {
            if (el.parentElement.querySelectorAll('.cantrip-item, .spell-item').length === 0) {
                el.classList.remove('hidden');
            }
        });

        const customizerToggle = document.getElementById('customizer-toggle');
        if (customizerToggle) customizerToggle.classList.add('hidden');

        const customizerDrawer = document.getElementById('customizer-drawer');
        if (customizerDrawer) customizerDrawer.classList.add('hidden');

        const portraitBadge = document.getElementById('portrait-change-badge');
        if (portraitBadge) portraitBadge.classList.add('hidden');

        editToggle.classList.remove('hidden');
        cancelEdit.classList.add('hidden');
        saveBtn.classList.add('hidden');
        updatePreviews();
        if (typeof renderCustomSections === 'function') renderCustomSections();
    }

    function restoreOriginalValues() {
        if (!originalValues || Object.keys(originalValues).length === 0) return;

        form.querySelectorAll('input, textarea, select').forEach(input => {
            if (input.name && originalValues.hasOwnProperty(input.name)) {
                if (input.type === 'checkbox') {
                    input.checked = originalValues[input.name];
                } else {
                    input.value = originalValues[input.name];
                }
            }
        });

        const inspBubble = document.getElementById('inspiration-bubble');
        if (inspBubble) {
            inspBubble.classList.toggle('filled', originalValues['inspiration'] || false);
        }

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
        if (document.getElementById('portrait-data')) {
            document.getElementById('portrait-data').value = originalValues.portrait || '';
        }
        if (document.getElementById('portrait-img')) {
            document.getElementById('portrait-img').src = originalValues.portraitSrc || '/images/aasimar_artificer.png';
        }
        if (document.getElementById('character-moniker')) {
            document.getElementById('character-moniker').value = originalValues.moniker || '';
        }
        if (document.getElementById('theme-input')) {
            document.getElementById('theme-input').value = originalValues.theme || 'classic';
            changeTheme(originalValues.theme || 'classic');
        }
        if (originalValues.customSections) {
            customSections = JSON.parse(JSON.stringify(originalValues.customSections));
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

    window.addCantrip = function () {
        const list = document.getElementById('cantrips-list');
        const idx = list.querySelectorAll('.cantrip-item').length;
        const div = document.createElement('div');
        div.className = 'cantrip-item flex items-center justify-between gap-2 py-1 px-2 border-b border-gray-800 text-sm text-gray-200';
        div.dataset.index = idx;
        div.innerHTML = `
            <div class="flex items-center gap-2 flex-grow">
                <span class="spell-delete cursor-pointer text-red-500 font-bold" onclick="removeCantrip(${idx})">&times;</span>
                <span class="rpg-tooltip-trigger cantrip-name-preview hidden" data-type="spell" data-name=""></span>
                <input type="text" name="cantrips[${idx}][name]" value="" 
                    class="w-full bg-white border-2 border-blue-400 p-0 text-sm text-gray-600 edit-active"
                    placeholder="Cantrip name" />
            </div>
        `;
        list.appendChild(div);
        list.querySelector('.cantrip-empty-msg')?.classList.add('hidden');
    };

    window.removeCantrip = function (idx) {
        if (!isEditing) return;
        const list = document.getElementById('cantrips-list');
        const item = list.querySelector(`[data-index="${idx}"]`);
        if (item) {
            item.remove();
            const items = list.querySelectorAll('.cantrip-item');
            items.forEach((it, i) => {
                it.dataset.index = i;
                it.querySelector('input').name = `cantrips[${i}][name]`;
                it.querySelector('.spell-delete').setAttribute('onclick', `removeCantrip(${i})`);
            });
            if (items.length === 0) {
                list.querySelector('.cantrip-empty-msg')?.classList.remove('hidden');
            }
        }
    };

    window.addSpell = function (lvl) {
        const list = document.getElementById(`spells-list-${lvl}`);
        const idx = list.querySelectorAll('.spell-item').length;
        const div = document.createElement('div');
        div.className = 'spell-item flex items-center justify-between gap-2 py-1 px-2 border-b border-gray-800 text-sm text-gray-200';
        div.dataset.index = `new-${idx}`;
        div.innerHTML = `
            <div class="flex items-center gap-2 flex-grow">
                <span class="spell-delete cursor-pointer text-red-500 font-bold" onclick="removeSpell(this)">&times;</span>
                <div class="bubble spell-checkbox"></div>
                <span class="rpg-tooltip-trigger spell-name-preview hidden" data-type="spell" data-name=""></span>
                <input type="text" name="spells[${lvl}][${idx}][name]" value="" 
                    class="w-full bg-white border-2 border-blue-400 p-0 text-sm text-gray-600 edit-active spell-name-input"
                    placeholder="Spell name" />
                <input type="hidden" class="spell-level-input" value="${lvl}" />
            </div>
        `;
        list.appendChild(div);
        list.querySelector('.spell-empty-msg')?.classList.add('hidden');
    };

    window.removeSpell = function (btn) {
        if (!isEditing) return;
        const item = btn.closest('.spell-item');
        const list = item.parentElement;
        if (item) {
            item.remove();
            const items = list.querySelectorAll('.spell-item');
            const lvl = list.id.replace('spells-list-', '');
            items.forEach((it, i) => {
                it.dataset.index = `new-${i}`;
                it.querySelector('.spell-name-input').name = `spells[${lvl}][${i}][name]`;
            });
            if (items.length === 0) {
                list.querySelector('.spell-empty-msg')?.classList.remove('hidden');
            }
        }
    };

    editToggle.addEventListener('click', () => {
        enableEditing();
    });
    cancelEdit.addEventListener('click', (e) => {
        e.preventDefault();
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

        data.cantrips = [];
        document.querySelectorAll('.cantrip-item').forEach(item => {
            const name = item.querySelector('input[type="text"]').value;
            if (name) data.cantrips.push({ name });
        });

        data.spells = [];
        document.querySelectorAll('.spell-item').forEach(item => {
            const name = item.querySelector('.spell-name-input').value;
            const level = item.querySelector('.spell-level-input').value;
            if (name) data.spells.push({ name, level });
        });

        data.moniker = document.getElementById('character-moniker') ? document.getElementById('character-moniker').value : '';
        data.theme = document.getElementById('theme-input') ? document.getElementById('theme-input').value : 'classic';
        data.customSections = customSections;

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
        let parsed = text;
        const tagRegex = /\{@([a-zA-Z]+) ([^}]+)\}/g;
        parsed = parsed.replace(tagRegex, (match, tag, content) => {
            const parts = content.split('|');
            const name = parts[0];
            const source = parts[1] || '';
            const validTags = ['spell', 'item', 'feat', 'condition', 'class', 'race', 'action', 'sense', 'skill'];
            if (validTags.includes(tag.toLowerCase())) {
                return `<span class="rpg-tooltip-trigger" data-type="${tag.toLowerCase()}" data-name="${name}" data-source="${source}">${name}</span>`;
            }
            return name;
        });
        if (typeof renderMarkdown === 'function') {
            return renderMarkdown(parsed);
        }
        return parsed;
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
        recalculateDynamicStats();
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
        const updatePosition = () => {
            const rect = trigger.getBoundingClientRect();
            const tooltipWidth = tooltip.offsetWidth || 320;
            const tooltipHeight = tooltip.offsetHeight || 100;

            let left = rect.left + window.scrollX;
            let top = rect.bottom + window.scrollY + 8;

            // Smart positioning
            if (left + tooltipWidth > window.innerWidth + window.scrollX) {
                left = window.innerWidth + window.scrollX - tooltipWidth - 20;
            }
            if (left < window.scrollX + 10) {
                left = window.scrollX + 10;
            }

            if (top + tooltipHeight > window.innerHeight + window.scrollY) {
                // Not enough space below, put it above
                top = rect.top + window.scrollY - tooltipHeight - 8;
                if (top < window.scrollY + 10) {
                    // Not enough space above either, put it to the right
                    top = rect.top + window.scrollY;
                    left = rect.right + window.scrollX + 8;
                    if (left + tooltipWidth > window.innerWidth + window.scrollX) {
                        // Not enough space to the right, put it to the left
                        left = rect.left + window.scrollX - tooltipWidth - 8;
                    }
                }
            }

            tooltip.style.left = `${Math.max(10, left)}px`;
            tooltip.style.top = `${Math.max(10, top)}px`;
        };

        updatePosition();

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
        <div class="rpg-tooltip-desc">${parseDndTags(desc)}</div>
      `;
            updatePosition();
        } catch (err) {
            tooltip.innerHTML = `<div class="rpg-tooltip-title">${name}</div><div class="rpg-tooltip-desc">No additional details found.</div>`;
            updatePosition();
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

    // --- Custom Sections & Dynamic Tables Studio ---
    let customSections = window.initialCustomSections || [];

    window.renderCustomSections = function () {
        const containers = {
            custom: document.getElementById('custom-sections-custom'),
            attributes: document.getElementById('custom-sections-attributes'),
            inventory: document.getElementById('custom-sections-inventory'),
            features: document.getElementById('custom-sections-features'),
            spellbook: document.getElementById('custom-sections-spellbook')
        };

        // Clear all section containers
        Object.values(containers).forEach(el => {
            if (el) el.innerHTML = '';
        });

        if (customSections.length === 0 && containers.custom) {
            containers.custom.innerHTML = `
                <div class="text-center py-8 text-gray-500 italic bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                    No custom sections yet. Enter Edit Mode to add text blocks, dynamic tables, sticky notes, or highlight callouts!
                </div>
            `;
            return;
        }

        customSections.forEach((sec) => {
            const card = document.createElement('div');
            let typeClass = 'custom-section-card';
            if (sec.type === 'note') typeClass += ' section-sticky-note';
            if (sec.type === 'highlight') typeClass += ' section-highlight';
            card.className = typeClass;
            card.dataset.id = sec.id;

            let contentHTML = '';
            if (sec.type === 'table') {
                const headers = sec.headers || ['Column 1', 'Column 2'];
                const rows = sec.rows || [['Row 1 Cell 1', 'Row 1 Cell 2']];

                let headerHTML = headers.map((h, colIdx) => `
                    <th class="relative group">
                        <div class="flex items-center justify-between gap-1">
                            <input type="text" value="${escapeHtml(h)}" ${isEditing ? '' : 'readonly'}
                                oninput="updateCustomTableHead('${sec.id}', ${colIdx}, this.value)" class="w-full bg-transparent font-bold" />
                            ${isEditing && headers.length > 1 ? `<button type="button" class="text-red-400 font-bold hover:text-red-300 px-1 text-sm" title="Delete Column" onclick="removeCustomTableColumn('${sec.id}', ${colIdx})">&times;</button>` : ''}
                        </div>
                    </th>
                `).join('');

                let rowsHTML = rows.map((row, rowIdx) => `
                    <tr>
                        ${row.map((cell, colIdx) => `
                            <td>
                                <input type="text" value="${escapeHtml(cell)}" ${isEditing ? '' : 'readonly'}
                                    oninput="updateCustomTableCell('${sec.id}', ${rowIdx}, ${colIdx}, this.value)" class="w-full bg-transparent" />
                            </td>
                        `).join('')}
                        ${isEditing ? `<td class="w-8 text-center"><button type="button" class="text-red-400 font-bold hover:text-red-300" title="Delete Row" onclick="removeCustomTableRow('${sec.id}', ${rowIdx})">&times;</button></td>` : ''}
                    </tr>
                `).join('');

                contentHTML = `
                    <div class="overflow-x-auto">
                        <table class="custom-table">
                            <thead>
                                <tr>
                                    ${headerHTML}
                                    ${isEditing ? '<th class="w-8"></th>' : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsHTML}
                            </tbody>
                        </table>
                    </div>
                    ${isEditing ? `
                        <div class="flex gap-2 mt-3 text-xs">
                            <button type="button" class="rpg-btn rpg-btn-secondary text-[11px] px-2 py-1" onclick="addCustomTableRow('${sec.id}')">+ Add Row</button>
                            <button type="button" class="rpg-btn rpg-btn-secondary text-[11px] px-2 py-1" onclick="addCustomTableColumn('${sec.id}')">+ Add Column</button>
                        </div>
                    ` : ''}
                `;
            } else if (sec.type === 'note' || sec.type === 'highlight' || sec.type === 'text') {
                if (isEditing) {
                    contentHTML = `
                        <textarea class="w-full bg-transparent border-none p-0 text-sm focus:ring-0 resize-y"
                            rows="3" placeholder="Enter content..."
                            oninput="updateCustomSectionContent('${sec.id}', this.value)">${escapeHtml(sec.content || '')}</textarea>
                    `;
                } else {
                    const rendered = typeof renderMarkdown === 'function' ? renderMarkdown(sec.content || '') : parseDndTags(sec.content || '');
                    contentHTML = `
                        <div class="custom-section-rendered text-sm leading-relaxed">${rendered}</div>
                    `;
                }
            }

            const targetTab = sec.targetTab || 'custom';
            card.innerHTML = `
                <div class="custom-section-header flex items-center justify-between gap-2">
                    <input type="text" class="custom-section-title bg-transparent border-none p-0 text-base font-bold focus:ring-0 flex-grow"
                        value="${escapeHtml(sec.title || 'Untitled Section')}" ${isEditing ? '' : 'readonly'}
                        oninput="updateCustomSectionTitle('${sec.id}', this.value)" placeholder="Section Title" />
                    ${isEditing ? `
                        <div class="flex items-center gap-2">
                            <select class="bg-slate-800 text-[11px] text-yellow-400 border border-slate-700 rounded px-1.5 py-0.5"
                                onchange="updateCustomSectionTargetTab('${sec.id}', this.value)">
                              <option value="custom" ${targetTab === 'custom' ? 'selected' : ''}>Placement: Custom Tab</option>
                              <option value="attributes" ${targetTab === 'attributes' ? 'selected' : ''}>Placement: Attributes Tab</option>
                              <option value="inventory" ${targetTab === 'inventory' ? 'selected' : ''}>Placement: Inventory Tab</option>
                              <option value="features" ${targetTab === 'features' ? 'selected' : ''}>Placement: Features Tab</option>
                              <option value="spellbook" ${targetTab === 'spellbook' ? 'selected' : ''}>Placement: Spells Tab</option>
                            </select>
                            <button type="button" class="text-red-400 hover:text-red-300 font-bold text-lg px-2" onclick="deleteCustomSection('${sec.id}')" title="Delete Section">&times;</button>
                        </div>
                    ` : ''}
                </div>
                ${contentHTML}
            `;

            const targetContainer = containers[targetTab] || containers.custom;
            if (targetContainer) targetContainer.appendChild(card);
        });
    };

    window.addCustomSection = function (type) {
        const id = 'sec_' + Date.now();
        if (type === 'table') {
            customSections.push({
                id,
                type: 'table',
                targetTab: 'custom',
                title: 'Custom Dynamic Table',
                headers: ['Item / Subject', 'Description', 'Notes'],
                rows: [
                    ['Sample Item 1', 'First detail note', 'Active'],
                    ['Sample Item 2', 'Second detail note', 'Pending']
                ]
            });
        } else if (type === 'note') {
            customSections.push({
                id,
                type: 'note',
                targetTab: 'custom',
                title: 'Quick Sticky Note',
                content: 'Important note for session details, DM clues, or reminders.'
            });
        } else if (type === 'highlight') {
            customSections.push({
                id,
                type: 'highlight',
                targetTab: 'custom',
                title: 'Featured Oath or Key Rule',
                content: 'Callout text highlighting a key feature, character quote, or house rule.'
            });
        } else {
            customSections.push({
                id,
                type: 'text',
                targetTab: 'custom',
                title: 'Custom Notes Section',
                content: 'Write any additional backstory, quest details, or companion information here.'
            });
        }
        renderCustomSections();
        switchTab('tab-custom');
    };

    window.updateCustomSectionTargetTab = function (id, targetTab) {
        const sec = customSections.find(s => s.id === id);
        if (sec) {
            sec.targetTab = targetTab;
            renderCustomSections();
        }
    };

    window.updateCustomSectionTitle = function (id, title) {
        const sec = customSections.find(s => s.id === id);
        if (sec) sec.title = title;
    };

    window.updateCustomSectionContent = function (id, content) {
        const sec = customSections.find(s => s.id === id);
        if (sec) sec.content = content;
    };

    window.updateCustomTableHead = function (id, colIdx, val) {
        const sec = customSections.find(s => s.id === id);
        if (sec && sec.headers) sec.headers[colIdx] = val;
    };

    window.updateCustomTableCell = function (id, rowIdx, colIdx, val) {
        const sec = customSections.find(s => s.id === id);
        if (sec && sec.rows && sec.rows[rowIdx]) sec.rows[rowIdx][colIdx] = val;
    };

    window.addCustomTableRow = function (id) {
        const sec = customSections.find(s => s.id === id);
        if (sec && sec.rows) {
            const newRow = (sec.headers || ['']).map(() => '');
            sec.rows.push(newRow);
            renderCustomSections();
        }
    };

    window.removeCustomTableRow = function (id, rowIdx) {
        const sec = customSections.find(s => s.id === id);
        if (sec && sec.rows) {
            sec.rows.splice(rowIdx, 1);
            renderCustomSections();
        }
    };

    window.addCustomTableColumn = function (id) {
        const sec = customSections.find(s => s.id === id);
        if (sec) {
            sec.headers = sec.headers || [];
            sec.headers.push(`Column ${sec.headers.length + 1}`);
            sec.rows = sec.rows || [];
            sec.rows.forEach(r => r.push(''));
            renderCustomSections();
        }
    };

    window.removeCustomTableColumn = function (id, colIdx) {
        const sec = customSections.find(s => s.id === id);
        if (sec && sec.headers && sec.headers.length > 1) {
            sec.headers.splice(colIdx, 1);
            if (sec.rows) {
                sec.rows.forEach(row => row.splice(colIdx, 1));
            }
            renderCustomSections();
        }
    };

    window.deleteCustomSection = function (id) {
        customSections = customSections.filter(s => s.id !== id);
        renderCustomSections();
    };

    function escapeHtml(str) {
        if (typeof str !== 'string') return str || '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // Theme Switcher & Drawer
    window.changeTheme = function (themeName) {
        const container = document.getElementById('sheet-container');
        if (container) container.dataset.theme = themeName;
        const themeInput = document.getElementById('theme-input');
        if (themeInput) themeInput.value = themeName;
    };

    window.toggleCustomizerDrawer = function () {
        const drawer = document.getElementById('customizer-drawer');
        if (drawer) drawer.classList.toggle('hidden');
    };

    // Initialize custom studio components
    renderCustomSections();

    // Initialize previews
    updatePreviews();
});
