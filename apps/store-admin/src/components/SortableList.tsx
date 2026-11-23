import React, { useEffect, useId, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';

/** What a row receives from SortableList so it can place the ordering controls itself. */
export interface SortableRowContext {
  /** Zero-based index in the list. */
  index: number;
  /** One-based position shown to the merchant. */
  position: number;
  /** Drag handle, position box and up/down buttons. Render it once inside the row. */
  controls: React.ReactNode;
  /** True while this row is being dragged. */
  isDragging: boolean;
}

/** Props for {@link SortableList}. */
interface SortableListProps<T> {
  /** Items in their current order. */
  items: T[];
  /** Stable unique id of an item. */
  getId: (item: T) => string;
  /** Called with the full new order after a drag, a typed position or an arrow click. */
  onReorder: (next: T[]) => void;
  /** Renders the content of one row. */
  renderItem: (item: T, row: SortableRowContext) => React.ReactNode;
  /** Accessible name of the list, for example "Products". */
  label: string;
  /** Turns every ordering control off, for example while a save is running. */
  disabled?: boolean;
  /** Class of the list container; use it to lay rows out as a grid. */
  className?: string;
  /** Extra class for the row at an index (for example to make the first tile larger). */
  rowClassName?: (index: number) => string;
  /** Content rendered before the row at an index, for example a divider. It sits outside the draggable row. */
  renderBefore?: (index: number) => React.ReactNode;
}

/** Returns a copy of `list` with the item at `from` moved to `to`. Out-of-range indexes are clamped. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/** Props for the typed position box. */
interface PositionBoxProps {
  position: number;
  total: number;
  disabled: boolean;
  label: string;
  onCommit: (position: number) => void;
}

/**
 * Number box showing an item's position. Typing a new number and pressing Enter (or leaving the box) moves
 * the item there. A value that is not a whole number resets to the current position; a number outside the
 * list is moved to the nearest end.
 */
const PositionBox: React.FC<PositionBoxProps> = ({ position, total, disabled, label, onCommit }) => {
  const [draft, setDraft] = useState(String(position));

  useEffect(() => {
    setDraft(String(position));
  }, [position]);

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() === '' || !Number.isInteger(parsed)) {
      setDraft(String(position));
      return;
    }
    const clamped = Math.max(1, Math.min(total, parsed));
    setDraft(String(clamped));
    if (clamped !== position) onCommit(clamped);
  };

  return (
    <input
      type="number"
      className="sortable-position"
      min={1}
      max={total}
      value={draft}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
};

/**
 * A list the merchant can reorder three ways: drag a row by its handle, type a position number, or use the
 * up and down buttons. The list never keeps its own order: it calls `onReorder` and shows whatever `items`
 * it is given next, so the parent decides when a change is saved or rolled back.
 */
export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  label,
  disabled = false,
  className,
  rowClassName,
  renderBefore,
}: SortableListProps<T>): React.ReactElement {
  const dragType = `application/x-sortable-${useId().replace(/[^a-z0-9]/gi, "")}`;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    const next = moveItem(items, from, to);
    if (next !== items) onReorder(next);
  };

  return (
    <div role="list" aria-label={label} className={className ?? 'sortable-list'}>
      {items.map((item, index) => {
        const id = getId(item);
        const controls = (
          <div className="sortable-controls">
            <span className="sortable-handle" aria-hidden="true" title="Drag to reorder">
              <GripVertical size={16} />
            </span>
            <button
              type="button"
              className="sortable-step"
              disabled={disabled || index === 0}
              aria-label={`Move item ${index + 1} up`}
              onClick={() => move(index, index - 1)}
            >
              <ArrowUp size={13} />
            </button>
            <PositionBox
              position={index + 1}
              total={items.length}
              disabled={disabled}
              label={`Position of item ${index + 1}`}
              onCommit={(position) => move(index, position - 1)}
            />
            <button
              type="button"
              className="sortable-step"
              disabled={disabled || index === items.length - 1}
              aria-label={`Move item ${index + 1} down`}
              onClick={() => move(index, index + 1)}
            >
              <ArrowDown size={13} />
            </button>
          </div>
        );

        const classes = ['sortable-row', rowClassName ? rowClassName(index) : ''];
        if (dragIndex === index) classes.push('is-dragging');
        if (overIndex === index && dragIndex !== null && dragIndex !== index) classes.push('is-drop-target');

        return (
          <React.Fragment key={id}>
            {renderBefore ? renderBefore(index) : null}
            <div
              role="listitem"
              className={classes.filter(Boolean).join(' ')}
              draggable={!disabled}
              onDragStart={(e) => {
                // A row nested inside this one (category children) is dragged by its own list.
                if (e.target !== e.currentTarget) return;
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData(dragType, String(index));
              }}
              onDragOver={(e) => {
                if (dragIndex === null || !e.dataTransfer.types.includes(dragType)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (overIndex !== index) setOverIndex(index);
              }}
              onDrop={(e) => {
                if (!e.dataTransfer.types.includes(dragType)) return;
                e.preventDefault();
                const from = Number(e.dataTransfer.getData(dragType));
                setDragIndex(null);
                setOverIndex(null);
                if (Number.isInteger(from)) move(from, index);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
            >
              {renderItem(item, { index, position: index + 1, controls, isDragging: dragIndex === index })}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
