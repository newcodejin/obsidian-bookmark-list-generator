// Bookmark List File Generator - Main Plugin Logic
// Generates a markdown file from Obsidian bookmarks

const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

// Default plugin settings
const DEFAULT_SETTINGS = {
  outputFileName: 'Bookmarks.md',
  autoUpdate: false,
  updateInterval: 60,
  excludeDeleted: false
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
      // Read live bookmark data from the core Bookmarks plugin
      // (always current, unlike bookmarks.json which Obsidian writes with a delay)
      const bookmarksPlugin = this.app.internalPlugins.getPluginById('bookmarks');
      if (!bookmarksPlugin || !bookmarksPlugin.enabled) {
        new Notice('❌ The Bookmarks core plugin is disabled');
        return;
      }
      const data = { items: bookmarksPlugin.instance.items || [] };

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

  // True if the bookmark points to a file/folder that no longer exists in the vault
  isDeleted(item) {
    if ((item.type === 'file' || item.type === 'folder') && item.path) {
      return !this.app.vault.getAbstractFileByPath(item.path);
    }
    return false;
  }

  // Count total bookmarks (every item except groups themselves)
  countBookmarks(data) {
    let count = 0;
    const traverse = (items) => {
      items.forEach(item => {
        if (item.type !== 'group') {
          if (!(this.settings.excludeDeleted && this.isDeleted(item))) {
            count++;
          }
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

    md += this.renderItems(data.items, 0);

    // Add statistics
    md += '\n---\n\n';
    md += '## 📊 Statistics\n\n';
    const groups = data.items.filter(item => item.type === 'group');
    groups.forEach(group => {
      const count = this.countBookmarks({ items: group.items || [] });
      md += `- **${group.title || 'Untitled group'}**: ${count} items\n`;
    });
    const looseCount = this.countBookmarks({ items: data.items.filter(item => item.type !== 'group') });
    if (looseCount > 0) {
      md += `- **Ungrouped**: ${looseCount} items\n`;
    }
    md += `- **Total**: ${this.countBookmarks(data)} items\n`;

    return md;
  }

  // Recursively render all bookmark items, preserving group hierarchy
  renderItems(items, depth) {
    let md = '';
    const indent = '  '.repeat(depth);
    items.forEach(item => {
      if (item.type === 'group') {
        md += `${indent}- 📁 **${item.title || 'Untitled group'}**\n`;
        if (item.items) {
          md += this.renderItems(item.items, depth + 1);
        }
      } else if (item.type === 'file' && item.path) {
        if (!(this.settings.excludeDeleted && this.isDeleted(item))) {
          const link = item.title ? `[[${item.path}|${item.title}]]` : `[[${item.path}]]`;
          md += `${indent}- ${link}\n`;
        }
      } else if (item.type === 'folder' && item.path) {
        if (!(this.settings.excludeDeleted && this.isDeleted(item))) {
          md += `${indent}- 🗂️ ${item.path}\n`;
        }
      } else if (item.type === 'url' && item.url) {
        md += `${indent}- 🔗 [${item.title || item.url}](${item.url})\n`;
      } else if (item.type === 'search' && item.query) {
        md += `${indent}- 🔍 \`${item.query}\`\n`;
      }
    });
    return md;
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

    // Deleted-note handling toggle
    new Setting(containerEl)
      .setName('Exclude Deleted Notes')
      .setDesc('Leave out bookmarks whose note no longer exists in the vault.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.excludeDeleted)
        .onChange(async (value) => {
          this.plugin.settings.excludeDeleted = value;
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
      const intervalSetting = new Setting(containerEl)
        .setName('Update Interval (minutes)')
        .setDesc(`How often to regenerate the bookmark list. Current: ${this.plugin.settings.updateInterval} minutes`)
        .addSlider(slider => slider
          .setLimits(1, 1440, 1)
          .setValue(this.plugin.settings.updateInterval)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.updateInterval = value;
            intervalSetting.setDesc(`How often to regenerate the bookmark list. Current: ${value} minutes`);
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
