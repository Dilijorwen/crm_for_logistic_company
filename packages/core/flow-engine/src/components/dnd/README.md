# Grid Drag Planner


## Background

- This module powers grid block drag preview and layout simulation, replacing the legacy direction-based `moveBlock` helper.

## Key Concepts

- **Snapshot**: Captures `rows`, `sizes`, and DOM slots on drag start so previews can be reverted safely.
- **Slots**: Drop targets described by DOM `data-grid-*` attributes covering column, column-edge, row-gap and empty container.
- **Simulation**: `simulateLayoutForSlot` works on a cloned snapshot, removing the source first and inserting into the chosen slot.

## Drag Lifecycle

1. `handleDragStart`: Build the snapshot, reset overlay state, schedule slot refresh.
2. `handleDragMove`: Resolve pointer position, match the closest slot, call `simulateLayoutForSlot`, and update overlay.
3. `handleDragEnd`: Commit `rows/sizes` and persist when a valid slot exists, otherwise restore snapshot.
4. `handleDragCancel`: Restore snapshot immediately and clear the overlay.

## Slot Types & Data Attributes

- The `Grid` component emits `data-grid-row-id`, `data-grid-column-index`, `data-grid-item-index`, etc.; `buildLayoutSnapshot` uses them to compute slot rectangles. Supported slot types:
  - **ColumnSlot**: Column internal insert position with `position: 'before' | 'after'` indicating insertion above or below an element
  - **ColumnEdgeSlot**: Column edge with `direction: 'left' | 'right'` indicating creating a new column on the left or right
  - **RowGapSlot**: Row gap with `position: 'above' | 'below'` indicating inserting a new row above or below
  - **EmptyRowSlot**: Empty container insertion position when no elements exist
  - **EmptyColumnSlot**: Empty column insertion position when no items in the column (unaffected by config)

## Size Handling

- Column widths always sum to 24 units.
- `distributeSizesWithNewColumn` allocates width for newly inserted columns.
- `normalizeRowSizes` keeps sizes consistent after column add/remove operations.

## Drag Overlay Configuration

- `GridModel` supports configuring drag overlay dimensions and offsets via the `dragOverlayConfig` property.
- Configuration options:
  - `columnInsert.before/after`: Configure `height` and `offsetTop` for column insert positions
  - `columnEdge.left/right`: Configure `width` and `offsetLeft` for column edge positions
  - `rowGap.above/below`: Configure `height` and `offsetTop` for row gap positions
- Empty rows (EmptyRowSlot) and empty columns (EmptyColumnSlot) always use full container dimensions, unaffected by configuration.
- Example:

  ```typescript
  model.dragOverlayConfig = {
    columnInsert: {
      before: { height: 20, offsetTop: -2 },
      after: { height: 20, offsetTop: -2 },
    },
    columnEdge: {
      left: { width: 16, offsetLeft: -4 },
      right: { width: 16, offsetLeft: 4 },
    },
    rowGap: {
      above: { height: 32, offsetTop: -8 },
      below: { height: 32, offsetTop: 8 },
    },
  };
  ```

## Testing Strategy

- `gridDragPlanner.test.ts` (22 tests): Covers core functions like `getSlotKey`, `resolveDropIntent`, `simulateLayoutForSlot`, including all slot types (column, column-edge, row-gap, empty-row, empty-column).
- `GridModel.dragOverlay.test.ts` (9 tests): Verifies `DragOverlayConfig` interface type definitions and configuration structure.
- `GridModel.computeOverlayRect.test.ts` (15 tests): Tests overlay dimension calculations under various configurations, ensuring all slot types and position combinations apply config correctly, and empty rows/columns remain unaffected.
- Add more test cases whenever new slot types or behaviours are introduced.

## Future Notes

- DOM slot discovery depends on the current `Grid` structure; update `buildLayoutSnapshot` when UI markup changes.
- Overlay placement uses container scroll offsets; re-run drag tests if scroll handling changes.
- When adding new slot types, synchronize updates in:
  1. Define slot interface and add to `LayoutSlot` union type
  2. Update `getSlotKey` function to handle the new type
  3. Update `simulateLayoutForSlot` function with layout logic
  4. Update `GridModel.computeOverlayRect` for config application
  5. Update `DragOverlayRect` type and styles in `Grid/index.tsx`
  6. Add corresponding test cases
