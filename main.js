// Bookmark List File Generator - Main Plugin Logic
// Generates a markdown file from Obsidian bookmarks

const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

// Default plugin settings
const DEFAULT_SETTINGS = {
  outputFileName: 'Bookmarks.md',
  autoUpdate: false,
  updateInterval: 60,
  excludeDeleted: false,
  showRibbonIcon: true
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

    // Show sidebar (ribbon) icon if enabled
    this.updateRibbonIcon();

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

  // Add or remove the sidebar (ribbon) icon to match the setting
  updateRibbonIcon() {
    if (this.ribbonIconEl) {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }
    if (this.settings.showRibbonIcon) {
      this.ribbonIconEl = this.addRibbonIcon('bookmark', 'Generate Bookmark List',
        () => this.generateBookmarkList());
    }
  }

  // Schedule periodic bookmark list generation
  scheduleAutoUpdate() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    this.updateTimer = setInterval(() => {
      // Background refresh — don't steal focus by opening the file
      this.generateBookmarkList(false);
    }, this.settings.updateInterval * 1000 * 60);
  }

  // Main function to generate bookmark list.
  // openFile: open the generated file afterwards (true for manual runs, false for auto-update)
  async generateBookmarkList(openFile = true) {
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
      let outputFile = this.app.vault.getAbstractFileByPath(this.settings.outputFileName);

      if (outputFile) {
        await this.app.vault.modify(outputFile, markdown);
      } else {
        outputFile = await this.app.vault.create(this.settings.outputFileName, markdown);
      }

      if (openFile) {
        await this.app.workspace.getLeaf().openFile(outputFile);
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

  // Single inclusion rule shared by rendering and statistics,
  // so the numbers always match what is actually listed
  isIncluded(item) {
    if (item.type === 'group') {
      return false;
    }
    return !(this.settings.excludeDeleted && this.isDeleted(item));
  }

  // Count total bookmarks (every included item; groups themselves are not counted)
  countBookmarks(data) {
    let count = 0;
    const traverse = (items) => {
      items.forEach(item => {
        if (this.isIncluded(item)) {
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

  // Tally included bookmarks by type, plus how many were excluded as deleted
  collectTypeCounts(items, counts) {
    items.forEach(item => {
      if (item.type === 'group') {
        if (item.items) {
          this.collectTypeCounts(item.items, counts);
        }
      } else if (this.isIncluded(item)) {
        const key = ['file', 'folder', 'url', 'search'].includes(item.type) ? item.type : 'other';
        counts[key]++;
        counts.total++;
      } else {
        counts.excluded++;
      }
    });
    return counts;
  }

  // Per-group counts, including nested groups (indented under their parent)
  renderGroupStats(items, depth) {
    let md = '';
    const indent = '  '.repeat(depth);
    items.filter(item => item.type === 'group').forEach(group => {
      const count = this.countBookmarks({ items: group.items || [] });
      md += `${indent}- **${group.title || 'Untitled group'}**: ${count} items\n`;
      if (group.items) {
        md += this.renderGroupStats(group.items, depth + 1);
      }
    });
    return md;
  }

  // Build markdown content from bookmark data
  buildMarkdown(data) {
    let md = '## 🔖 Bookmark List\n\n';

    md += this.renderItems(data.items, 0);

    // Add statistics
    md += '\n## 📊 Statistics\n\n';
    md += this.renderGroupStats(data.items, 0);
    const looseCount = this.countBookmarks({ items: data.items.filter(item => item.type !== 'group') });
    if (looseCount > 0) {
      md += `- **Ungrouped**: ${looseCount} items\n`;
    }
    const counts = this.collectTypeCounts(data.items,
      { file: 0, folder: 0, url: 0, search: 0, other: 0, total: 0, excluded: 0 });
    md += `- **Total**: ${counts.total} items\n`;
    const typeParts = [
      ['📄 Notes', counts.file],
      ['🗂️ Folders', counts.folder],
      ['🔗 URLs', counts.url],
      ['🔍 Searches', counts.search],
      ['📌 Others', counts.other]
    ].filter(([, n]) => n > 0).map(([label, n]) => `${label}: ${n}`);
    if (typeParts.length > 0) {
      md += `  - ${typeParts.join(' | ')}\n`;
    }
    if (counts.excluded > 0) {
      md += `- **Excluded (deleted)**: ${counts.excluded} items\n`;
    }

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
      } else if (this.isIncluded(item)) {
        if (item.type === 'file' && item.path) {
          // Keep heading/block subpaths so the link points at the exact bookmarked spot
          const target = item.path + (item.subpath || '');
          const link = item.title ? `[[${target}|${item.title}]]` : `[[${target}]]`;
          md += `${indent}- ${link}\n`;
        } else if (item.type === 'folder' && item.path) {
          md += `${indent}- 🗂️ ${item.path}\n`;
        } else if (item.type === 'url' && item.url) {
          md += `${indent}- 🔗 [${item.title || item.url}](${item.url})\n`;
        } else if (item.type === 'search' && item.query) {
          md += `${indent}- 🔍 \`${item.query}\`\n`;
        } else {
          // Unknown or incomplete item (e.g. graph bookmarks):
          // keep it visible instead of silently dropping it, so counts stay accurate
          md += `${indent}- 📌 ${item.title || item.type}\n`;
        }
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

    // Deleted-note handling toggle (first — turning it on is recommended)
    new Setting(containerEl)
      .setName('Exclude Deleted Notes')
      .setDesc('Recommended. Leave out bookmarks whose note no longer exists in the vault.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.excludeDeleted)
        .onChange(async (value) => {
          this.plugin.settings.excludeDeleted = value;
          await this.plugin.saveSettings();
        }));

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

    // Sidebar (ribbon) icon toggle
    new Setting(containerEl)
      .setName('Show Sidebar Icon')
      .setDesc('Add a bookmark icon to the left sidebar that generates the list with one click.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showRibbonIcon)
        .onChange(async (value) => {
          this.plugin.settings.showRibbonIcon = value;
          await this.plugin.saveSettings();
          this.plugin.updateRibbonIcon();
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
