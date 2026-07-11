# Bookmark List File Generator

An Obsidian plugin that generates a markdown file (`Bookmarks.md`) from your bookmarks.

## Usage

Generate the bookmark list in either way:

- Open the Command Palette (`Ctrl+P`) and run **"Generate Bookmark List"**
- Or click the **Generate Now** button in the plugin settings

Each run rewrites the output file with your current bookmarks.

## Settings

| Setting | Description |
|---------|-------------|
| Output Filename | Name of the generated file (default: `Bookmarks.md`) |
| Exclude Deleted Notes | Leave out bookmarks whose note no longer exists in the vault |
| Enable Auto-Update | Turn automatic regeneration on/off |
| Update Interval | Minutes between updates; the slider shows the current value |

## ⚠️ Notes

- **Don't edit the generated file by hand.** Its content is fully overwritten on every update — treat it as read-only.
- **The Bookmarks core plugin must be enabled** (Settings → Core plugins → Bookmarks).

## License

MIT
