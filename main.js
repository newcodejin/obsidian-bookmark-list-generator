// Bookmark List File Generator - Main Plugin Logic
// Generates a markdown file from Obsidian bookmarks

const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');
const fs = require('fs');
const path = require('path');

// Default plugin settings
const DEFAULT_SETTINGS = {
  outputFileName: 'Bookmarks.md',
  autoUpdate: false,
  updateInterval: 60
};

class BookmarkListGeneratorPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    // Register command for manual bookmark organization
    this.addCommand({
      id: 'generate-bookmark-list',
      name: 'Generate Bookmark List',
      callback: () => this.generateBookmarkList()
    });

    // Add settings tab
    this.addSettingTab(new GeneratorSettingTab(this.app, this));

    // Schedule auto-update if enabled
    if (this.settings.autoUpdate) {
      this.scheduleAutoUpdate();
    }
  }

  onunload() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Schedule periodic bookmark list generation
  scheduleAutoUpdate() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.updateTimer = setInterval(() => {
      this.generateBookmarkList();
    }, this.settings.updateInterval * 1000 * 60);
  }

  // Main function to generate bookmark list
  async generateBookmarkList() {
    try {
      const vaultPath = this.app.vault.adapter.basePath;
      const bookmarksPath = path.join(vaultPath, '.obsidian', 'bookmarks.json');

      if (!fs.existsSync(bookmarksPath)) {
        new Notice('❌ bookmarks.json not found');
        return;
      }

      const content = fs.readFileSync(bookmarksPath, 'utf-8');
      const data = JSON.parse(content);

      const markdown = this.buildMarkdown(data);
      const outputFile = this.app.vault.getAbstractFileByPath(this.settings.outputFileName);

      if (outputFile) {
        await this.app.vault.modify(outputFile, markdown);
      } else {
        await this.app.vault.create(this.settings.outputFileName, markdown);
      }

      const count = this.countBookmarks(data);
      new Notice(`✅ Bookmark list generated! (${count} items)`);
    } catch (error) {
      console.error('Error:', error);
      new Notice('❌ Error: ' + error.message);
    }
  }

  // Count total bookmarks
  countBookmarks(data) {
    let count = 0;
    const traverse = (items) => {
      items.forEach(item => {
        if (item.type === 'file' || item.type === 'folder') {
          count++;
        }
        if (item.items) {
          traverse(item.items);
        }
      });
    };
    traverse(data.items);
    return count;
  }

  // Build markdown content from bookmark data
  buildMarkdown(data) {
    let md = '# 📚 Bookmarks\n\n';
    md += '> Auto-generated bookmark list | ' + new Date().toISOString().split('T')[0] + '\n\n';
    md += '---\n\n';

    const groups = data.items.filter(item => item.type === 'group');

    groups.forEach((group, idx) => {
      md += `## 📌 Group ${idx + 1}\n\n`;

      if (group.items) {
        const files = this.flattenFiles(group.items);
        files.forEach((file, fileIdx) => {
          if (file.path) {
            md += `${fileIdx + 1}. [[${file.path}]]\n`;
          }
        });
      }

      md += '\n---\n\n';
    });

    // Add statistics
    md += '## 📊 Statistics\n\n';
    groups.forEach((group, idx) => {
      const count = this.countBookmarks({ items: [group] });
      md += `- **Group ${idx + 1}**: ${count} items\n`;
    });
    md += `- **Total**: ${this.countBookmarks(data)} items\n\n`;
    md += '> 💡 Click any filename to navigate to that note.\n';

    return md;
  }

  // Flatten nested bookmark items to get all files
  flattenFiles(items) {
    let result = [];
    items.forEach(item => {
      if (item.type === 'file') {
        result.push(item);
      } else if (item.type === 'group' && item.items) {
        result = result.concat(this.flattenFiles(item.items));
      }
    });
    return result;
  }
}

// Settings tab UI
class GeneratorSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Bookmark List Generator' });

    // Output filename setting
    new Setting(containerEl)
      .setName('Output Filename')
      .setDesc('Name of the markdown file to create')
      .addText(text => text
        .setPlaceholder('Bookmarks.md')
        .setValue(this.plugin.settings.outputFileName)
        .onChange(async (value) => {
          this.plugin.settings.outputFileName = value || 'Bookmarks.md';
          await this.plugin.saveSettings();
        }));

    // Auto-update toggle
    new Setting(containerEl)
      .setName('Enable Auto-Update')
      .setDesc('Automatically regenerate bookmark list at intervals')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoUpdate)
        .onChange(async (value) => {
          this.plugin.settings.autoUpdate = value;
          await this.plugin.saveSettings();
          if (value) {
            this.plugin.scheduleAutoUpdate();
          } else if (this.plugin.updateTimer) {
            clearInterval(this.plugin.updateTimer);
            this.plugin.updateTimer = null;
          }
          this.display();
        }));

    // Update interval setting (only show if auto-update is enabled)
    if (this.plugin.settings.autoUpdate) {
      new Setting(containerEl)
        .setName('Update Interval (minutes)')
        .setDesc('How often to regenerate the bookmark list')
        .addSlider(slider => slider
          .setLimits(1, 1440, 1)
          .setValue(this.plugin.settings.updateInterval)
          .onChange(async (value) => {
            this.plugin.settings.updateInterval = value;
            await this.plugin.saveSettings();
            this.plugin.scheduleAutoUpdate();
          }));
    }

    containerEl.createEl('hr');

    // Manual generation button
    const btn = containerEl.createEl('button', { text: 'Generate Now' });
    btn.onclick = () => this.plugin.generateBookmarkList();
  }
}

module.exports = BookmarkListGeneratorPlugin;
