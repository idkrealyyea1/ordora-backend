-- 024_item_preorder.sql — per-product pre-order mark plus order snapshots
--
-- Message-only timing per clarification: a flag plus an owner-written note.
-- Off/empty reproduces legacy behavior exactly; snapshots freeze the facts
-- at checkout so later edits never rewrite history.

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS preorder_note TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_preorder_note_check'
  ) THEN
    ALTER TABLE menu_items
      ADD CONSTRAINT menu_items_preorder_note_check CHECK (char_length(preorder_note) <= 300);
  END IF;
END
$$;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS preorder_note TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_preorder_note_check'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_preorder_note_check CHECK (char_length(preorder_note) <= 300);
  END IF;
END
$$;
