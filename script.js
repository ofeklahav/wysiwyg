const editor = document.getElementById('editor');
const visual = document.getElementById('visualEditor');
const gutter = document.getElementById('gutter');
const themeIcon = document.getElementById('themeIcon');
const customModal = document.getElementById('customModal');
const modalTitle = document.getElementById('modalTitle');
const modalInputs = document.getElementById('modalInputs');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel = document.getElementById('modalCancel');

const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndownService.use(turndownPluginGfm.gfm);

// --- Utils ---
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function saveToLocal() {
    localStorage.setItem('md_content', editor.value);
}

function updateGutter() {
    const lines = editor.value.split('\n').length;
    gutter.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
}

// --- Sync Logic ---
const syncCodeToVisual = debounce(() => {
    visual.innerHTML = marked.parse(editor.value);
    updateGutter();
    saveToLocal();
}, 50);

const syncVisualToCode = debounce(() => {
    editor.value = turndownService.turndown(visual.innerHTML);
    updateGutter();
    saveToLocal();
}, 50);

// --- Event Listeners ---
editor.addEventListener('input', () => { syncCodeToVisual(); });
visual.addEventListener('input', () => { syncVisualToCode(); });
editor.addEventListener('scroll', () => gutter.scrollTop = editor.scrollTop);

// --- Commands ---
function execCmd(command, value = null) {
    document.execCommand(command, false, value);
    syncVisualToCode();
}

function insertTextAtCursor(text, selectionOffset = 0) {
    editor.focus();
    // Use execCommand to preserve undo history
    if (document.queryCommandSupported('insertText')) {
        document.execCommand('insertText', false, text);
    } else {
        // Fallback for browsers that don't support insertText
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + text.length;
        syncCodeToVisual(); // Manually sync since value setter doesn't fire input event
    }

    // Adjust cursor position if an offset is provided
    if (selectionOffset > 0) {
        const newPos = editor.selectionEnd - selectionOffset;
        editor.selectionStart = editor.selectionEnd = newPos;
    }
}

function insertCode() {
    insertTextAtCursor("\n```javascript\n// כתוב את הקוד שלך כאן\n```\n\n", 4); // Offset to be inside the block? No, just after.
}

async function insertImage() {
    const results = await showCustomPrompt("הוספת תמונה", [
        { id: 'url', label: "כתובת URL לתמונה", defaultValue: 'https://' },
        { id: 'alt', label: "טקסט חלופי (Alt Text)" }
    ]);
    if (results) insertTextAtCursor(`![${results.alt || 'תמונה'}](${results.url})\n\n`);
}

async function insertMarkdownTable() {
    const results = await showCustomPrompt("יצירת טבלה", [
        { id: 'rows', label: "שורות", type: 'number', defaultValue: '3' },
        { id: 'cols', label: "עמודות", type: 'number', defaultValue: '2' }
    ]);
    if (!results) return;

    const rows = Math.max(2, parseInt(results.rows) || 3);
    const cols = Math.max(1, parseInt(results.cols) || 2);

    const header = `| ${Array(cols).fill(0).map((_, i) => `כותרת ${i + 1}`).join(' | ')} |\n`;
    const sep = `| ${Array(cols).fill('---').join(' | ')} |\n`;
    const data = `| ${Array(cols).fill('נתונים').join(' | ')} |\n`.repeat(rows - 1);

    insertTextAtCursor(`\n${header}${sep}${data}\n`);
}

// --- Modal ---
function showCustomPrompt(title, fields) {
    return new Promise(resolve => {
        modalTitle.textContent = title;
        modalInputs.innerHTML = '';
        fields.forEach(f => {
            const lbl = document.createElement('label'); lbl.textContent = f.label;
            const inp = document.createElement('input');
            inp.type = f.type || 'text'; inp.id = f.id; inp.value = f.defaultValue || '';
            modalInputs.append(lbl, inp);
        });
        customModal.style.display = 'flex';

        const close = (val) => {
            customModal.style.display = 'none';
            modalConfirm.onclick = modalCancel.onclick = null;
            resolve(val);
        };

        modalConfirm.onclick = () => {
            const res = {};
            fields.forEach(f => res[f.id] = document.getElementById(f.id).value);
            close(res);
        };
        modalCancel.onclick = () => close(null);
    });
}

// --- Export/Import ---
function exportToDocx() {
    const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
        <head><meta charset='utf-8'><title>Export</title>
        <style>
            body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            td, th { border: 1px solid #000; padding: 8px; }
            img { max-width: 100%; height: auto; }
        </style></head><body>${visual.innerHTML}</body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = 'document.doc';
    link.click();
}

function downloadFile() {
    const blob = new Blob([editor.value], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'document.md';
    a.click();
}

function copyCode() {
    editor.select();
    document.execCommand('copy');
    alert('הקוד הועתק!');
}

function clearAll() {
    if (confirm('למחוק הכל?')) {
        editor.value = '';
        visual.innerHTML = '';
        updateGutter();
        saveToLocal();
    }
}

// --- Init ---
window.onload = () => {
    const saved = localStorage.getItem('md_content');
    editor.value = saved || "# עורך היברידי\n\nהתחל לכתוב...";
    syncCodeToVisual();
    if (document.body.getAttribute('data-theme') === 'dark') themeIcon.classList.replace('fa-moon', 'fa-sun');
};

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeIcon.classList.toggle('fa-sun');
    themeIcon.classList.toggle('fa-moon');
}

function toggleDir() {
    document.body.classList.toggle('rtl-content');
    document.body.classList.toggle('ltr-content');
}

// --- Resizer ---
const resizer = document.getElementById('resizer');
const leftPane = document.getElementById('codePane');
const rightPane = document.getElementById('visualPane');
let isResizing = false;

resizer.addEventListener('mousedown', (e) => { isResizing = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); });
document.addEventListener('mouseup', () => { isResizing = false; document.body.style.cursor = 'default'; });
document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const percent = (e.clientX / document.getElementById('workspace').offsetWidth) * 100;
    if (percent > 20 && percent < 80) {
        leftPane.style.flexBasis = percent + '%';
        rightPane.style.flexBasis = (100 - percent) + '%';
    }
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && document.activeElement !== editor) {
        if (e.key.toLowerCase() === 'z') { e.preventDefault(); execCmd('undo'); }
        if (e.key.toLowerCase() === 'y') { e.preventDefault(); execCmd('redo'); }
    }
});
