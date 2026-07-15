# Bookmark List File Generator

An Obsidian plugin that generates a markdown file (`Bookmarks.md`) from your bookmarks, with statistics per group and per type.

## Usage

Generate the bookmark list in any of these ways:

- Click the **bookmark icon** in the left sidebar
- Open the Command Palette (`Ctrl+P`) and run **"Generate Bookmark List"**
- Click the **Generate Now** button in the plugin settings

Each run rewrites the output file with your current bookmarks and opens it. Auto-update refreshes the file in the background without opening it.

## Settings

| Setting | Description |
|---------|-------------|
| Exclude Deleted Notes | Leave out bookmarks whose note no longer exists in the vault (recommended) |
| Output Filename | Name of the generated file (default: `Bookmarks.md`) |
| Show Sidebar Icon | Add a bookmark icon to the left sidebar that generates the list with one click |
| Enable Auto-Update | Turn automatic regeneration on/off |
| Update Interval | Minutes between updates; the slider shows the current value |

## ⚠️ Notes

- **Don't edit the generated file by hand.** Its content is fully overwritten on every update — treat it as read-only.
- **The Bookmarks core plugin must be enabled** (Settings → Core plugins → Bookmarks).

## License

MIT
