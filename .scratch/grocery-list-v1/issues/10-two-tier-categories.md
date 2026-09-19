# T2A: Two-tier category display and management

**What to build:** Categories screen shows default categories (immutable name/existence) alongside custom categories (editable/deletable). All categories reorderable via drag-and-drop.

**Blocked by:** T1A (seed default categories)

**Status:** ready-for-agent

- [ ] Categories screen displays two sections: "Catégories par défaut" and "Mes catégories"
- [ ] Default categories: name cannot be edited or deleted. Only reorderable.
- [ ] Custom categories: create, edit, delete. Delete blocked if non-empty (shows "Déplacez ou supprimez d'abord les X articles de cette catégorie")
- [ ] Drag-and-drop reorder for ALL categories (default + custom) using `dnd-kit` library
- [ ] Custom category name uniqueness within household (case-insensitive) enforced at UI and DB level
- [ ] Install `@dnd-kit/core` and `@dnd-kit/sortable` packages
- [ ] `data-testid` attributes: `category-section-default`, `category-section-custom`, `category-item-{name}`, `category-drag-handle`, `category-create-button`, `category-edit-button`, `category-delete-button`, `category-delete-blocked-message`
