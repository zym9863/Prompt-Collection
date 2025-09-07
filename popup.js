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
      <div class="prompt-item" data-id="${prompt.id}" draggable="true">
        <div class="drag-handle"></div>
        <h3>${escapeHtml(prompt.title)}</h3>
        <p>${escapeHtml(prompt.content)}</p>
        <div class="prompt-actions">
          <button class="action-btn edit-btn" data-action="edit">编辑</button>
          <button class="action-btn copy-btn" data-action="copy">复制</button>
          <button class="action-btn delete-btn" data-action="delete">删除</button>
        </div>
      </div>
    `).join('');
    
    // 为新渲染的元素添加拖拽事件监听器
    addDragListeners();
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

  // 拖拽相关变量
  let draggedItem = null;
  let draggedIndex = -1;

  // 添加拖拽事件监听器
  function addDragListeners() {
    const promptItems = promptList.querySelectorAll('.prompt-item');
    
    promptItems.forEach((item, index) => {
      // 拖拽开始
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        draggedIndex = Array.from(promptItems).indexOf(item);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', item.outerHTML);
      });

      // 拖拽结束
      item.addEventListener('dragend', (e) => {
        item.classList.remove('dragging');
        draggedItem = null;
        draggedIndex = -1;
        
        // 清除所有拖拽样式
        promptItems.forEach(p => {
          p.classList.remove('drag-over');
        });
      });

      // 拖拽进入
      item.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (item !== draggedItem) {
          item.classList.add('drag-over');
        }
      });

      // 拖拽悬停
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      // 拖拽离开
      item.addEventListener('dragleave', (e) => {
        // 只有当真正离开元素时才移除样式
        if (!item.contains(e.relatedTarget)) {
          item.classList.remove('drag-over');
        }
      });

      // 放置
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        
        if (draggedItem && item !== draggedItem) {
          const currentIndex = Array.from(promptItems).indexOf(item);
          reorderPrompts(draggedIndex, currentIndex);
        }
      });
    });
  }

  // 重新排序prompts数组
  function reorderPrompts(fromIndex, toIndex) {
    // 获取当前显示的prompts（考虑搜索过滤）
    const searchTerm = searchInput.value.toLowerCase();
    const filteredPrompts = prompts.filter(prompt =>
      prompt.title.toLowerCase().includes(searchTerm) ||
      prompt.content.toLowerCase().includes(searchTerm)
    );

    // 如果有搜索过滤，需要找到在原数组中的真实索引
    if (searchTerm) {
      const movedPrompt = filteredPrompts[fromIndex];
      const targetPrompt = filteredPrompts[toIndex];
      
      const realFromIndex = prompts.findIndex(p => p.id === movedPrompt.id);
      const realToIndex = prompts.findIndex(p => p.id === targetPrompt.id);
      
      // 移动元素
      const [removed] = prompts.splice(realFromIndex, 1);
      prompts.splice(realToIndex, 0, removed);
    } else {
      // 没有搜索过滤时直接操作
      const [removed] = prompts.splice(fromIndex, 1);
      prompts.splice(toIndex, 0, removed);
    }

    // 保存到存储并重新渲染
    savePrompts();
    renderPromptList();
  }
});