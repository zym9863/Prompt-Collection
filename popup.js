document.addEventListener('DOMContentLoaded', () => {
  // DOM元素
  const titleInput = document.getElementById('titleInput');
  const promptInput = document.getElementById('promptInput');
  const addPromptBtn = document.getElementById('addPromptBtn');
  const searchInput = document.getElementById('searchInput');
  const promptList = document.getElementById('promptList');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');

  // 从storage中加载prompts
  let prompts = [];
  chrome.storage.local.get(['prompts'], (result) => {
    prompts = result.prompts || [];
    renderPromptList();
  });

  // 添加新的prompt
  addPromptBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    const content = promptInput.value.trim();

    if (!title || !content) {
      alert('请填写标题和内容');
      return;
    }

    const prompt = {
      id: Date.now(),
      title,
      content,
      createdAt: new Date().toISOString()
    };

    prompts.unshift(prompt);
    savePrompts();
    clearForm();
    renderPromptList();
  });

  // 搜索prompts
  searchInput.addEventListener('input', () => {
    renderPromptList();
  });

  // 导出prompts
  exportBtn.addEventListener('click', () => {
    const data = JSON.stringify(prompts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // 导入prompts
  importBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedPrompts = JSON.parse(event.target.result);
          prompts = [...importedPrompts, ...prompts];
          savePrompts();
          renderPromptList();
        } catch (err) {
          alert('导入失败：文件格式错误');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // 保存prompts到storage
  function savePrompts() {
    chrome.storage.local.set({ prompts });
  }

  // 清空表单
  function clearForm() {
    titleInput.value = '';
    promptInput.value = '';
  }

  // 渲染prompt列表
  function renderPromptList() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredPrompts = prompts.filter(prompt =>
      prompt.title.toLowerCase().includes(searchTerm) ||
      prompt.content.toLowerCase().includes(searchTerm)
    );

    promptList.innerHTML = filteredPrompts.map(prompt => `
      <div class="prompt-item" data-id="${prompt.id}">
        <h3>${escapeHtml(prompt.title)}</h3>
        <p>${escapeHtml(prompt.content)}</p>
        <div class="prompt-actions">
          <button class="action-btn edit-btn" data-action="edit">编辑</button>
          <button class="action-btn copy-btn" data-action="copy">复制</button>
          <button class="action-btn delete-btn" data-action="delete">删除</button>
        </div>
      </div>
    `).join('');
  }

  // 使用事件委托处理prompt操作
  promptList.addEventListener('click', (e) => {
    const button = e.target.closest('.action-btn');
    if (!button) return;

    const promptItem = button.closest('.prompt-item');
    const id = parseInt(promptItem.dataset.id);
    const action = button.dataset.action;

    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;

    switch (action) {
      case 'edit':
        titleInput.value = prompt.title;
        promptInput.value = prompt.content;
        prompts = prompts.filter(p => p.id !== id);
        savePrompts();
        renderPromptList();
        break;

      case 'copy':
        navigator.clipboard.writeText(prompt.content).then(() => {
          alert('已复制到剪贴板');
        });
        break;

      case 'delete':
        if (confirm('确定要删除这个Prompt吗？')) {
          prompts = prompts.filter(p => p.id !== id);
          savePrompts();
          renderPromptList();
        }
        break;
    }
  });

  // HTML转义
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});